import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getGravatarUrl } from '@/lib/getUserProfile';

import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { profile, user } = useAuth();

  const avatarSource = { uri: getGravatarUrl(user?.email || "test@test.com") }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Section with Gradient */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#d946ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View className="px-6 pt-4 pb-8">
            <Text className="text-4xl font-bold text-white mb-6">Home</Text>
            
            {/* Profile Card */}
            <View className="bg-white/20 backdrop-blur-lg rounded-3xl p-5 flex-row items-center">
              <View className="relative">
                <Image
                  source={avatarSource}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: 'white',
                  }}
                />
                <View className="absolute bottom-0 right-0 w-5 h-5 bg-green-400 rounded-full border-2 border-white" />
              </View>
              
              <View className="ml-4 flex-1">
                <Text className="text-xl font-bold text-white">
                  {profile?.username || 'User'}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                  <Text className="text-sm text-white/90 font-medium">Online</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Content Section */}
        <View className="px-6 mt-6">
          {/* Welcome Card */}
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome back, {profile?.username || 'User'}! 👋
            </Text>
            <Text className="text-base leading-6 text-gray-600 dark:text-gray-300">
              Discover and explore amazing photos uploaded by our community members.
            </Text>
          </View>

          {/* Info Card */}
          <View className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 mb-4">
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 bg-indigo-500 rounded-full items-center justify-center mr-3">
                <Text className="text-white text-lg">📸</Text>
              </View>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Photo Gallery
              </Text>
            </View>
            <Text className="text-gray-700 dark:text-gray-300 leading-6">
              Browse through a curated collection of stunning photos from talented users around the world.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}