import { useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';

export default function ChatScreen() {
  const { id, username } = useLocalSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('');

  // Mock messages - replace with actual data
  const messages = [
    { id: '1', text: 'Hey! How are you doing?', sender: 'other', time: '2:30 PM' },
    { id: '2', text: 'I am great, thanks! How about you?', sender: 'me', time: '2:31 PM' },
    { id: '3', text: 'Doing well! Want to catch up later?', sender: 'other', time: '2:32 PM' },
    { id: '4', text: 'What time works for you?', sender: 'me', time: '2:33 PM' },
  ];

  const handleSend = () => {
    if (message.trim()) {
      console.log('Sending:', message);
      setMessage('');
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerBackTitle: 'Return',
          title: username as string || 'Chat',
        }} 
      />
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
        <KeyboardAvoidingView 
          className="flex-1" 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Messages */}
          <ScrollView className="flex-1 px-4 py-4 bg-gray-50 dark:bg-gray-900">
            {messages.map((msg) => (
              <View
                key={msg.id}
                className={`mb-2 ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
              >
                <View
                  className={`max-w-[75%] px-3 py-2 ${
                    msg.sender === 'me'
                      ? 'bg-green-500 rounded-2xl rounded-br-md'
                      : 'bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md shadow-sm'
                  }`}
                >
                  <Text className={`text-base ${msg.sender === 'me' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {msg.text}
                  </Text>
                  <Text className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-green-50' : 'text-gray-500 dark:text-gray-400'}`}>
                    {msg.time}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Input - Floating Dynamic Island Style */}
          <View className="px-3 pb-6 pt-2 bg-transparent">
            <View 
              className="flex-row items-center bg-white dark:bg-gray-800 rounded-full px-4 py-2.5 shadow-lg"
              style={{
                shadowColor: '#000',
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
                  shadowColor: '#22c55e',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Text className="text-white text-xl font-bold">➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}