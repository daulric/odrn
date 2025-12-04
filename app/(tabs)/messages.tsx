import { Image } from 'expo-image';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CryptoJS from 'crypto-js';

import { useAuth } from '@/contexts/AuthContext';

// Mock chat data - replace with your actual data source
const mockChats = [
  {
    id: '1',
    username: 'John Doe',
    email: 'john@example.com',
    lastMessage: 'Hey! How are you doing?',
    timestamp: '2:30 PM',
    unread: 2,
  },
  {
    id: '2',
    username: 'Jane Smith',
    email: 'jane@example.com',
    lastMessage: 'Thanks for the photo!',
    timestamp: '1:15 PM',
    unread: 0,
  },
  {
    id: '3',
    username: 'Mike Johnson',
    email: 'mike@example.com',
    lastMessage: 'See you tomorrow',
    timestamp: 'Yesterday',
    unread: 0,
  },
  {
    id: '4',
    username: 'Sarah Wilson',
    email: 'sarah@example.com',
    lastMessage: 'That sounds great!',
    timestamp: 'Yesterday',
    unread: 0,
  },
];

export default function MessagesScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const getGravatarUrl = (emailAddress: string) => {
    const address = String(emailAddress).trim().toLowerCase();
    const hash = CryptoJS.MD5(address).toString();
    return `https://www.gravatar.com/avatar/${hash}?s=200&d=mp`;
  };

  const handleChatPress = (chatId: string, username: string) => {
    // Navigate to individual chat screen
    router.push(`/chat/${chatId}?username=${username}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
      <View className="flex-1">
        {/* Header */}
        <View className="px-5 py-4 bg-white dark:bg-gray-900">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            Messages
          </Text>
        </View>

        {/* Chat List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {mockChats.map((chat, index) => (
            <TouchableOpacity
              key={chat.id}
              onPress={() => handleChatPress(chat.id, chat.username)}
              className="bg-white dark:bg-gray-900 active:bg-gray-50 dark:active:bg-gray-800"
            >
              <View className="flex-row items-center px-5 py-3">
                {/* Avatar */}
                <Image
                  source={{ uri: getGravatarUrl(chat.email) }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                  }}
                />

                {/* Chat Info */}
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                      {chat.username}
                    </Text>
                    <Text className={`text-xs ${chat.unread > 0 ? 'text-green-600 dark:text-green-500 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {chat.timestamp}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-sm flex-1 ${chat.unread > 0 ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                      numberOfLines={1}
                    >
                      {chat.lastMessage}
                    </Text>
                    {chat.unread > 0 && (
                      <View className="ml-2 min-w-[22px] h-[22px] bg-green-500 rounded-full items-center justify-center px-1.5">
                        <Text className="text-xs font-bold text-white">
                          {chat.unread}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              
              {/* Divider */}
              <View className="ml-[84px] h-px bg-gray-200 dark:bg-gray-800" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}