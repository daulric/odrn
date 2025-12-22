import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { createOutgoingCall } from "@/lib/calling/signaling"
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native"
import { IconButton, Surface, Text, TextInput, useTheme } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"

interface Message {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
  seen: boolean
}

export default function ChatScreen() {
  const { id, username } = useLocalSearchParams()
  const receiverId = Array.isArray(id) ? id[0] : id
  const { user } = useAuth()
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [startingCall, setStartingCall] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const theme = useTheme()

  // <CHANGE> Helper function to scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  const markMessagesAsSeen = async () => {
    if (!user || !receiverId) return

    const { error } = await (supabase as any)
      .from("messages")
      .update({ seen: true })
      .eq("receiver_id", user.id)
      .eq("sender_id", receiverId)
      .eq("seen", false)

    if (error) {
      console.error("Error marking messages as seen:", error)
    }
  }

  // <CHANGE> Add keyboard listeners to scroll when keyboard shows
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        scrollToBottom()
      }
    )

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        scrollToBottom()
      }
    )

    return () => {
      keyboardDidShowListener.remove()
      keyboardDidHideListener.remove()
    }
  }, [])

  // <CHANGE> Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  useEffect(() => {
    if (!user || !receiverId) return
  
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
  
      if (error) {
        console.error("Error fetching messages:", error)
      } else if (data) {
        setMessages(data)
        markMessagesAsSeen()
      }
    }
  
    fetchMessages()
  
    const channelName = `chat:${[user.id, receiverId].sort().join('-')}`
  
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "ordn",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message
  
          const isRelevant = 
            (newMessage.sender_id === user.id && newMessage.receiver_id === receiverId) ||
            (newMessage.sender_id === receiverId && newMessage.receiver_id === user.id)
  
          if (isRelevant) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMessage.id)) {
                return prev
              }
              return [...prev, newMessage]
            })
  
            if (newMessage.receiver_id === user.id) {
              markMessagesAsSeen()
            }
          }
        },
      )
      .subscribe()
  
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, receiverId])

  const handleSend = async () => {
    if (!message.trim() || !user || !receiverId) return
  
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const content = message.trim()
    setMessage("")
  
    const tempId = `temp-${Date.now()}-${Math.random()}`
  
    const optimisticMessage: Message = {
      id: tempId,
      content,
      sender_id: user.id,
      receiver_id: receiverId,
      created_at: new Date().toISOString(),
      seen: false,
    }
  
    setMessages((prev) => [...prev, optimisticMessage])
    // <CHANGE> Scroll to bottom immediately after adding optimistic message
    scrollToBottom()
  
    const { data, error } = await (supabase as any)
      .from("messages")
      .insert({
        content,
        sender_id: user.id,
        receiver_id: receiverId,
        seen: false,
      })
      .select()
      .single()
  
    if (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setMessage(content)
    } else if (data) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId)
        if (filtered.some((m) => m.id === data.id)) {
          return filtered
        }
        return [...filtered, data]
      })
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Return",
          title: (username as string) || "Chat",
          headerRight: () => (
            <IconButton
              icon="phone"
              disabled={!user || !receiverId || startingCall}
              onPress={async () => {
                if (!user || !receiverId) return
                try {
                  setStartingCall(true)
                  const call = await createOutgoingCall({ callerId: user.id, calleeId: receiverId })
                  router.push(`/call/${call.id}`)
                } catch (e: any) {
                  console.error('Failed to start call:', e)
                  Alert.alert('Cannot start call', 'You can only call accepted friends.')
                } finally {
                  setStartingCall(false)
                }
              }}
            />
          ),
        }}
      />
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }} edges={["bottom"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ScrollView
            className="flex-1 px-4 py-4"
            style={{ backgroundColor: theme.colors.background }}
            ref={scrollViewRef}
            onContentSizeChange={scrollToBottom}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id
              return (
                <View key={msg.id} className={`mb-2 ${isMe ? "items-end" : "items-start"}`}>
                  <Surface
                    style={{
                      maxWidth: "75%",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isMe ? theme.colors.primary : theme.colors.surface,
                      borderRadius: 18,
                      borderBottomRightRadius: isMe ? 6 : 18,
                      borderBottomLeftRadius: isMe ? 18 : 6,
                      elevation: 1,
                    }}
                  >
                    <Text style={{ fontSize: 16, color: isMe ? theme.colors.onPrimary : theme.colors.onSurface }}>
                      {msg.content}
                    </Text>
                    <View className="flex-row items-center justify-end mt-1" style={{ gap: 4 }}>
                      <Text style={{ fontSize: 12, color: isMe ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                        {formatTime(msg.created_at)}
                      </Text>
                      {isMe && (
                        <Ionicons 
                          name={msg.seen ? "checkmark-done" : "checkmark"} 
                          size={16} 
                          color={msg.seen ? theme.colors.onPrimary : theme.colors.onPrimary}
                        />
                      )}
                    </View>
                  </Surface>
                </View>
              )
            })}
          </ScrollView>

          <View className="px-2 pb-6 pt-2 bg-transparent">
            <Surface
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                elevation: 6,
              }}
            >
              <TextInput
                mode="flat"
                placeholder="Message"
                value={message}
                onChangeText={setMessage}
                maxLength={500}
                style={{ flex: 1, backgroundColor: "transparent", maxHeight: 100 }}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                dense
              />
              <IconButton
                icon="send"
                size={22}
                onPress={handleSend}
                disabled={!message.trim()}
                mode="contained-tonal"
                containerColor={theme.colors.primary}
                iconColor={theme.colors.onPrimary}
                style={{ marginLeft: 4 }}
              />
            </Surface>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}