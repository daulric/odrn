import { useAuth } from '@/contexts/AuthContext';
import { getGravatarUrl } from '@/lib/getUserProfile';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// A simple utility to generate a consistent color from a string (username or email)
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const h = Math.abs(hash % 360);
  const s = 70; 
  const l = 60;

  return `hsl(${h}, ${s}%, ${l}%)`;
};

export default function ProfileScreen() {
  const { profile, user } = useAuth();
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [headerColor, setHeaderColor] = useState('#93c5fd');

  // Generate gravatar URL if email is available
  const avatarUrl = user?.email ? getGravatarUrl(user.email) : null;

  useEffect(() => {
    // If we have a username, use it to seed the color
    if (profile?.username) {
      setHeaderColor(stringToColor(profile.username));
    } else if (user?.email) {
       // Fallback to email
      setHeaderColor(stringToColor(user.email));
    }
  }, [profile?.username, user?.email]);


  const fetchFriendCount = async () => {
    if (!profile?.id) return;

    try {
      // Count friends where user is sender
      const { count: sentCount, error: sentError } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'accepted');

      // Count friends where user is receiver
      const { count: receivedCount, error: receivedError } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', profile.id)
        .eq('status', 'accepted');

      if (sentError || receivedError) {
        console.error('Error fetching friend count:', sentError || receivedError);
        return;
      }

      setFriendCount((sentCount || 0) + (receivedCount || 0));
    } catch (error) {
      console.error('Error fetching friend count:', error);
    }
  };

  useEffect(() => {
    fetchFriendCount();
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriendCount();
    setRefreshing(false);
  };

  const handleOpenGravatar = async () => {
    const url = 'https://gravatar.com/profile';
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open Gravatar URL');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header / Cover Area */}
        <View 
          className="h-48 items-center justify-center"
          style={{ backgroundColor: headerColor }}
        >
          <View className="absolute -bottom-16 w-32 h-32 rounded-full bg-white dark:bg-gray-800 p-1 justify-center items-center shadow-lg">
            <View className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center overflow-hidden relative">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-4xl font-bold text-gray-500 dark:text-gray-400">
                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                </Text>
              )}

              {/* Edit Button Overlay */}
              <TouchableOpacity
                onPress={handleOpenGravatar}
                className="absolute bottom-0 w-full h-8 bg-black/50 items-center justify-center"
                activeOpacity={0.7}
              >
                <Text className="text-white text-[10px] font-medium">EDIT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="mt-20 px-6 items-center">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-1">
            {profile?.username || 'User'}
          </Text>

          <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full mt-2">
            <Ionicons name="people" size={18} color="#2563eb" />
            <Text className="ml-2 text-blue-700 dark:text-blue-400 font-semibold">
              {friendCount !== null ? `${friendCount} Friends` : '...'}
            </Text>
          </View>
          
          <View className="mt-8 px-6 w-full items-center">
             <Text className="text-gray-400 dark:text-gray-500 text-center italic">
                Your profile is looking great!
             </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
