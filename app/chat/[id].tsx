import { useAuth } from "@/contexts/AuthContext"
import { isCallingSupported } from "@/lib/calling/isCallingSupported"
import { sendNewMessagePush } from "@/lib/calling/push"
import { createOutgoingCall } from "@/lib/calling/signaling"
import { getAvatarUrl } from "@/lib/getUserProfile"
import { supabase } from "@/lib/supabase"
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TouchableOpacity, View } from "react-native"
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

interface ReceiverProfile {
  id: string
  username: string | null
  email: string | null
  avatar: string | null
  is_online: boolean | null
}

interface ReceiverProfile {
  id: string
  username: string | null
  email: string | null
  avatar: string | null
  is_online: boolean | null
}

export default function ChatScreen() {
  const { id, username } = useLocalSearchParams()
  const receiverId = Array.isArray(id) ? id[0] : id
  const { user } = useAuth()
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [startingCall, setStartingCall] = useState(false)
  const [receiverProfile, setReceiverProfile] = useState<ReceiverProfile | null>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const theme = useTheme()
  const callingSupported = isCallingSupported()

  // Fetch receiver's profile
  useEffect(() => {
    if (!receiverId) return
    
    const fetchReceiverProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, avatar, is_online")
        .eq("id", receiverId)
        .single()
      
      if (!error && data) {
        setReceiverProfile(data)
      }
    }
    
    fetchReceiverProfile()
  }, [receiverId])

  const receiverAvatarUrl = receiverProfile?.username || receiverProfile?.email ? getAvatarUrl(receiverProfile.username || receiverProfile.email || '') : null
  const displayName = receiverProfile?.username || (username as string) || "Chat"

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Fire-and-forget push if recipient is offline
      void sendNewMessagePush({
        senderId: user.id,
        receiverId,
        messageContent: content,
      }).catch((e) => console.warn("Failed to send message push:", e))
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
          title: displayName,
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => {
                void Haptics.selectionAsync()
                router.push(`/profiles/${receiverId}`)
              }}
              className="flex-row items-center"
              activeOpacity={0.7}
            >
              <View className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center overflow-hidden mr-2">
                {receiverAvatarUrl ? (
                  <Image
                    source={{ uri: receiverAvatarUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#6b7280' }}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.onSurface }}>
                  {displayName}
                </Text>
                {receiverProfile?.is_online && (
                  <Text style={{ fontSize: 11, color: '#22c55e' }}>Online</Text>
                )}
              </View>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <Pressable
              disabled={!callingSupported || !user || !receiverId || startingCall}
              hitSlop={10}
              onPress={async () => {
                if (!callingSupported) {
                  Alert.alert('Calling unavailable', 'Calling requires a development build (not Expo Go).')
                  return
                }
                if (!user || !receiverId) return
                try {
                  setStartingCall(true)
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  const call = await createOutgoingCall({ callerId: user.id, calleeId: receiverId })
                  router.push(`/call/${call.id}`)
                } catch (e: any) {
                  console.error('Failed to start call:', e)
                  Alert.alert('Cannot start call', 'You can only call accepted friends.')
                } finally {
                  setStartingCall(false)
                }
              }}
              style={({ pressed }) => {
                return {
                  marginRight: 12,
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'center',
                  backgroundColor: 'transparent',
                  opacity: (!callingSupported || !user || !receiverId || startingCall ? 0.45 : 1) * (pressed ? 0.6 : 1),
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Call"
            >
              {startingCall ? (
                <ActivityIndicator size="small" color={theme.colors.onSurface} />
              ) : (
                <Ionicons name="call-outline" size={18} color={theme.colors.onSurface} style={{ transform: [{ translateX: 1 }] }} />
              )}
            </Pressable>
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