import { router } from 'expo-router';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  // use state instead
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/auth');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to log out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center p-5 space-y-4">
        <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
          {profile?.username || 'User'}
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          disabled={loading}
          className={`w-full max-w-sm h-12 bg-red-500 rounded-lg justify-center items-center ${
            loading ? 'opacity-60' : ''
          }`}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Log out</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

