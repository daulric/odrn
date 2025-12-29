import Constants from "expo-constants"
import { Platform } from "react-native"

export type ExpoPushToken = string

async function getNotificationsModule() {
  // `expo-notifications` is not available on web/SSR and may be missing in some builds.
  if (Platform.OS === "web") return null
  try {
    const Notifications = await import("expo-notifications")
    // Double-check critical methods exist, as import might succeed but return partial/mock module
    if (!Notifications.getPermissionsAsync || !Notifications.getExpoPushTokenAsync) {
      return null
    }
    return Notifications
  } catch {
    return null
  }
}

export async function initCallNotificationChannelsAndCategories() {
  const Notifications = await getNotificationsModule()
  if (!Notifications) return

  // Ensure notifications show while the app is foregrounded.
  if (Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
  }

  // Android requires channels for high-priority / heads-up notifications.
  if (Platform.OS === "android" && Notifications.setNotificationChannelAsync) {
    await Notifications.setNotificationChannelAsync("calls", {
      name: "Calls",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
  }

  // Interactive actions (Accept / Decline)
  if (Notifications.setNotificationCategoryAsync) {
    await Notifications.setNotificationCategoryAsync("incoming_call", [
      {
        identifier: "ACCEPT_CALL",
        buttonTitle: "Accept",
        options: { opensAppToForeground: true },
      },
      {
        identifier: "DECLINE_CALL",
        buttonTitle: "Decline",
        options: { opensAppToForeground: true, isDestructive: true },
      },
    ])
  }
}

export async function registerForPushNotificationsAsync(): Promise<ExpoPushToken | null> {
  const Notifications = await getNotificationsModule()
  if (!Notifications) return null

  // Physical device only (Expo push tokens aren't supported on simulators in most cases).
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== "granted") return null

    // SDK 49+ requires a projectId on some setups (EAS).
    const projectId =
      (Constants as any).expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      undefined

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )

    return token.data
  } catch (error) {
    console.warn("Failed to register for push notifications:", error)
    return null
  }
}

export async function sendExpoPushAsync(message: Record<string, any>) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  })

  // Expo returns JSON even on some failures; ignore body here and let callers log if needed.
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Expo push failed: ${res.status} ${text}`)
  }
}

export function addNotificationResponseReceivedListener(
  handler: (response: any) => void
): { remove: () => void } {
  // Best-effort: if notifications aren't available, no-op.
  const sub = { remove: () => {} }
  void (async () => {
    const Notifications = await getNotificationsModule()
    if (!Notifications || !Notifications.addNotificationResponseReceivedListener) return
    const real = Notifications.addNotificationResponseReceivedListener((r: any) => handler(r))
    ;(sub as any).remove = () => real.remove()
  })()
  return sub
}

export async function getLastNotificationResponseAsync(): Promise<any | null> {
  const Notifications = await getNotificationsModule()
  if (!Notifications || !Notifications.getLastNotificationResponseAsync) return null
  return Notifications.getLastNotificationResponseAsync()
}
