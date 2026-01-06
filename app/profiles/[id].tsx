import { ProfileView } from '@/components/profiles';
import { getAvatarUrl } from '@/lib/getUserProfile';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  is_online: boolean | null;
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, is_online')
        .eq('id', id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    };

    fetchProfile();
  }, [id]);

  const avatarUrl = profile?.username || profile?.email ? getAvatarUrl(profile.username || profile.email || '') : null;
  const displayName = profile?.username || 'Profile';

  if (!id) {
    return null;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: 'Back',
          title: displayName,
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => {
                void Haptics.selectionAsync();
                // Already on profile, could refresh or do nothing
              }}
              className="flex-row items-center"
              activeOpacity={0.7}
            >
              <View className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center overflow-hidden mr-2">
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
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
                {profile?.is_online && (
                  <Text style={{ fontSize: 11, color: '#22c55e' }}>Online</Text>
                )}
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <ProfileView userId={id} showBackButton={false} />
    </>
  );
}
