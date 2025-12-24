import { sendExpoPushAsync } from "@/lib/notifications/push"
import { supabase } from "@/lib/supabase"

function isProbablyOnline(isOnline: boolean | null, lastSeen: string | null) {
  if (!isOnline) return false
  if (!lastSeen) return false
  const last = new Date(lastSeen).getTime()
  if (!Number.isFinite(last)) return false
  return Date.now() - last < 60 * 1000 // 1 minute
}

export async function sendIncomingCallPush(params: { callId: string; callerId: string; calleeId: string }) {
  const { callId, callerId, calleeId } = params

  // Fetch callee presence + token
  const { data: callee } = await supabase
    .from("profiles")
    .select("id, is_online, last_seen, expo_push_token")
    .eq("id", calleeId)
    .maybeSingle()

  const calleeToken = (callee as any)?.expo_push_token as string | null | undefined
  const calleeOnline = isProbablyOnline((callee as any)?.is_online ?? null, (callee as any)?.last_seen ?? null)

  // If callee is online, realtime popup is enough.
  if (calleeOnline) return
  if (!calleeToken) return

  // Best-effort caller display name
  let callerName = "Someone"
  try {
    const { data: caller } = await supabase.from("profiles").select("username").eq("id", callerId).maybeSingle()
    callerName = ((caller as any)?.username as string) || callerName
  } catch {
    // ignore
  }

  await sendExpoPushAsync({
    to: calleeToken,
    sound: "default",
    priority: "high",
    title: "Incoming call",
    body: `${callerName} is calling you.`,
    data: { type: "incoming_call", callId },
    categoryId: "incoming_call",
    channelId: "calls", // android
  })
}


