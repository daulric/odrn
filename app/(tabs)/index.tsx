import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { profile } = useAuth();
  const avatarSource =
    profile?.avatar && profile.avatar.trim().length > 0
      ? { uri: profile.avatar }
      : require('@/assets/images/icon.png');

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1">
        <ScrollView className="flex-1">
          <View className="p-5 space-y-4">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white">Home</Text>
            <View className="flex-row items-center space-x-4">
              <Image
                source={avatarSource}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                }}
              />
              <View>
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {profile?.username || 'User'}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">Online</Text>
              </View>
            </View>
            <Text className="text-lg opacity-70 text-gray-700 dark:text-gray-300">
              Welcome, {profile?.username || 'User'}!
            </Text>
            <Text className="text-base leading-6 text-gray-700 dark:text-gray-300">
              This is where you can view photos uploaded by users.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

