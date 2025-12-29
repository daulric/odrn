import { sendExpoPushAsync } from "@/lib/notifications/push"
import { supabase } from "@/lib/supabase"

function isProbablyOnline(isOnline: boolean | null, lastSeen: string | null) {
  if (!isOnline) return false
  if (!lastSeen) return false
  const last = new Date(lastSeen).getTime()
  if (!Number.isFinite(last)) return false
  return Date.now() - last < 60 * 1000 // 1 minute
}

async function getProfileInfo(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, is_online, last_seen, expo_push_token, username")
    .eq("id", userId)
    .maybeSingle()
  return data
}

export async function sendIncomingCallPush(params: { callId: string; callerId: string; calleeId: string }) {
  const { callId, callerId, calleeId } = params

  const callee = await getProfileInfo(calleeId)
  const calleeToken = (callee as any)?.expo_push_token as string | null | undefined
  const calleeOnline = isProbablyOnline((callee as any)?.is_online ?? null, (callee as any)?.last_seen ?? null)

  // If callee is online, realtime popup is enough.
  if (calleeOnline) {
    console.log("Incoming call push skipped: User is online", calleeId)
    return
  }
  if (!calleeToken) {
    console.log("Incoming call push skipped: No token for user", calleeId)
    return
  }

  console.log("Sending incoming call push to", calleeToken)

  let callerName = "Someone"
  const caller = await getProfileInfo(callerId)
  if (caller && (caller as any).username) callerName = (caller as any).username

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

export async function sendNewMessagePush(params: { senderId: string; receiverId: string; messageContent: string; chatId?: string }) {
  const { senderId, receiverId, messageContent, chatId } = params

  const receiver = await getProfileInfo(receiverId)
  const receiverToken = (receiver as any)?.expo_push_token as string | null | undefined
  const receiverOnline = isProbablyOnline((receiver as any)?.is_online ?? null, (receiver as any)?.last_seen ?? null)

  // If receiver is online, they'll see the message via realtime subscription.
  if (receiverOnline) {
    console.log("Message push skipped: User is online", receiverId)
    return
  }
  if (!receiverToken) {
    console.log("Message push skipped: No token for user", receiverId)
    return
  }

  console.log("Sending message push to", receiverToken)

  let senderName = "New Message"
  const sender = await getProfileInfo(senderId)
  if (sender && (sender as any).username) senderName = (sender as any).username

  await sendExpoPushAsync({
    to: receiverToken,
    sound: "default",
    title: senderName,
    body: messageContent,
    data: { type: "new_message", senderId, chatId }, // Pass extra data if you want to route to chat on tap
    channelId: "messages", // Android requirement
  })
}
