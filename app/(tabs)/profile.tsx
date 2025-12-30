import { ProfileView } from '@/components/profiles';
import { SwipeBetweenTabs } from '@/components/navigation';
import { useAuth } from '@/contexts/AuthContext';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function ProfileScreen() {
  const { profile } = useAuth();

  if (!profile?.id) {
    return (
      <SwipeBetweenTabs current="profile">
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SwipeBetweenTabs>
    );
  }

  return (
    <SwipeBetweenTabs current="profile">
      <ProfileView userId={profile.id} showBackButton={false} />
    </SwipeBetweenTabs>
  );
}
