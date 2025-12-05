"use client"

import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native"
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
  const scrollViewRef = useRef<ScrollView>(null)

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
        }}
      />
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <ScrollView
            className="flex-1 px-4 py-4 bg-gray-50 dark:bg-gray-900"
            ref={scrollViewRef}
            onContentSizeChange={scrollToBottom}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id
              return (
                <View key={msg.id} className={`mb-2 ${isMe ? "items-end" : "items-start"}`}>
                  <View
                    className={`max-w-[75%] px-3 py-2 ${
                      isMe
                        ? "bg-green-500 rounded-2xl rounded-br-md"
                        : "bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md"
                    }`}
                  >
                    <Text className={`text-base ${isMe ? "text-white" : "text-gray-900 dark:text-white"}`}>
                      {msg.content}
                    </Text>
                    <View className="flex-row items-center justify-end mt-1 gap-1">
                      <Text className={`text-xs ${isMe ? "text-green-50" : "text-gray-500 dark:text-gray-400"}`}>
                        {formatTime(msg.created_at)}
                      </Text>
                      {isMe && (
                        <Ionicons 
                          name={msg.seen ? "checkmark-done" : "checkmark"} 
                          size={16} 
                          color={msg.seen ? "#dcfce7" : "#f0fdf4"} 
                        />
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </ScrollView>

          <View className="px-2 pb-6 pt-2 bg-transparent">
            <View
              className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-1 shadow-lg"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <TextInput
                className="flex-1 text-gray-900 dark:text-white text-base py-1.5 px-1"
                placeholder="Message"
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                style={{ maxHeight: 100 }}
              />
              <TouchableOpacity
                onPress={handleSend}
                className="ml-2 w-11 h-11 bg-green-500 rounded-full items-center justify-center active:scale-95"
                disabled={!message.trim()}
                style={{
                  shadowColor: "#22c55e",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Ionicons name="send" size={20} color="white" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  )
}