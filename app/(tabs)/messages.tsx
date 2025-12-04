import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';

export default function MessagesScreen() {
  const { profile } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1">
        <ScrollView className="flex-1">
          <View className="p-5 space-y-4">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white">Messages</Text>
            <Text className="text-lg opacity-70 text-gray-700 dark:text-gray-300">
              Chat with other users
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              You are chatting as {profile?.username || 'User'}.
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              This is where you can message other people.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

