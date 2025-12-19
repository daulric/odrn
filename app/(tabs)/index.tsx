import { Image } from 'expo-image';
import { ScrollView, Text, View, TouchableOpacity, Dimensions, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { SwipeBetweenTabs } from '@/components/swipe-between-tabs';

const { width } = Dimensions.get('window');

interface Friend {
  id: string;
  username: string;
  email: string;
  status: 'online' | 'offline';
  last_seen?: string;
}

interface MediaItem {
  id: string;
  type: 'image';
  url: string;
  username: string;
  caption: string;
  likes: number;
}

const mockMediaFeed: MediaItem[] = [
  {
    id: '1',
    type: 'image',
    url: 'https://picsum.photos/seed/1/800/600',
    username: 'Sarah Chen',
    caption: 'Beautiful sunset at the beach',
    likes: 234,
  },
  {
    id: '2',
    type: 'image',
    url: 'https://picsum.photos/seed/2/800/600',
    username: 'Mike Ross',
    caption: 'Coffee and code',
    likes: 189,
  },
  {
    id: '3',
    type: 'image',
    url: 'https://picsum.photos/seed/3/800/600',
    username: 'Emma Wilson',
    caption: 'Mountain views',
    likes: 456,
  },
  {
    id: '4',
    type: 'image',
    url: 'https://picsum.photos/seed/4/800/600',
    username: 'James Taylor',
    caption: 'City lights at night',
    likes: 321,
  },
];

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const getGravatarUrl = (emailAddress: string) => {
    const address = String(emailAddress).trim().toLowerCase();
    const hash = CryptoJS.MD5(address).toString();
    return `https://www.gravatar.com/avatar/${hash}?s=200&d=mp`;
  };

  const avatarSource = { uri: getGravatarUrl(user?.email || "test@test.com") };

  // Helper to check if a user is truly online based on last_seen
  const isUserOnline = (isOnline: boolean, lastSeen?: string) => {
    if (!isOnline) return false;
    if (!lastSeen) return false;
    
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const oneMinute = 60 * 1000;
    
    // Consider offline if last_seen is older than 1 minute
    return (now - lastSeenTime) < oneMinute;
  };

  // Update last_seen timestamp (acts as heartbeat)
  const updateHeartbeat = async () => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', user.id);
  };

  // Set user offline
  const setOffline = async () => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', user.id);
  };

  // Send heartbeat every 30 seconds while app is active
  useEffect(() => {
    if (!user) return;

    const heartbeatInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        updateHeartbeat();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [user]);

  // Track app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        await updateHeartbeat();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - mark as offline
        await setOffline();
      }
      appState.current = nextAppState;
    });

    // Set online when component mounts
    updateHeartbeat();

    return () => {
      subscription.remove();
      // Try to set offline on unmount (may not execute if app is killed)
      setOffline();
    };
  }, [user]);

  // Fetch friends and determine online status
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;

      try {
        const { data: friendships, error } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (error) {
          console.error('Error fetching friends:', error);
          return;
        }

        if (!friendships || friendships.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }

        const friendIds = friendships.map((f: any) => 
          f.user_id === user.id ? f.friend_id : f.user_id
        );

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, email, is_online, last_seen')
          .in('id', friendIds);

        if (profilesError) {
          console.error('Error fetching friend profiles:', profilesError);
          return;
        }

        if (profiles) {
          const formattedFriends: Friend[] = profiles.map((p: any) => ({
            id: p.id,
            username: p.username || 'User',
            email: p.email || '',
            status: isUserOnline(p.is_online, p.last_seen) ? 'online' : 'offline',
            last_seen: p.last_seen,
          }));

          setFriends(formattedFriends);
        }
      } catch (error) {
        console.error('Error in fetchFriends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();

    // Check for stale online statuses every 30 seconds
    const staleCheckInterval = setInterval(() => {
      setFriends(prevFriends => 
        prevFriends.map(friend => ({
          ...friend,
          status: isUserOnline(friend.status === 'online', friend.last_seen) ? 'online' : 'offline'
        }))
      );
    }, 30000);

    // Set up realtime subscription
    const channel = supabase
      .channel('profiles-online-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'ordn',
          table: 'profiles',
        },
        (payload) => {
          const updatedProfile = payload.new as any;
          
          setFriends((prevFriends) => 
            prevFriends.map((friend) => 
              friend.id === updatedProfile.id
                ? { 
                    ...friend, 
                    status: isUserOnline(updatedProfile.is_online, updatedProfile.last_seen) ? 'online' : 'offline',
                    last_seen: updatedProfile.last_seen 
                  }
                : friend
            )
          );
        }
      )
      .subscribe();

    return () => {
      clearInterval(staleCheckInterval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleFriendPress = (friendId: string, username: string) => {
    router.push(`/chat/${friendId}?username=${username}`);
  };

  return (
    <SwipeBetweenTabs current="index">
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#d946ef']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
          >
            <View className="px-6 pt-4 pb-8">
              <Text className="text-4xl font-bold text-white mb-6">Home</Text>
              
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

          <View className="mt-6">
            <View className="flex-row items-center justify-between px-6 mb-4">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                Friends
              </Text>
              {friends.length > 0 && (
                <Text className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">
                  {friends.length} friends
                </Text>
              )}
            </View>

            {loading ? (
              <View className="px-6 py-8">
                <ActivityIndicator size="large" color="#6366f1" />
              </View>
            ) : friends.length === 0 ? (
              <View className="px-6 py-8 items-center">
                <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                  No friends yet. Start connecting with others!
                </Text>
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="px-6"
                contentContainerStyle={{ gap: 12 }}
              >
                {friends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    onPress={() => handleFriendPress(friend.id, friend.username)}
                    className="items-center"
                    style={{ width: 80 }}
                  >
                    <View className="relative">
                      <Image
                        source={{ uri: getGravatarUrl(friend.email) }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 20,
                          borderWidth: 2,
                          borderColor: friend.status === 'online' ? '#22c55e' : '#e5e7eb',
                        }}
                      />
                      {friend.status === 'online' && (
                        <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-950" />
                      )}
                    </View>
                    <Text 
                      className="text-sm font-medium text-gray-900 dark:text-white mt-2 text-center"
                      numberOfLines={1}
                    >
                      {friend.username.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View className="mt-8 px-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                Feed
              </Text>
              <Ionicons name="grid-outline" size={24} color="#6366f1" />
            </View>

            {mockMediaFeed.map((media) => (
              <View key={media.id} className="mb-6 bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm">
                <View className="flex-row items-center p-4">
                  <Image
                    source={{ uri: getGravatarUrl(media.username) }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                    }}
                  />
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white">
                      {media.username}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      2 hours ago
                    </Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#9CA3AF" />
                </View>

                <Image
                  source={{ uri: media.url }}
                  style={{
                    width: width - 48,
                    height: (width - 48) * 0.75,
                  }}
                  contentFit="cover"
                />

                <View className="p-4">
                  <View className="flex-row items-center gap-4 mb-3">
                    <TouchableOpacity className="flex-row items-center gap-1">
                      <Ionicons name="heart-outline" size={26} color="#ef4444" />
                      <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                        {media.likes}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Ionicons name="chatbubble-outline" size={24} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Ionicons name="paper-plane-outline" size={24} color="#8b5cf6" />
                    </TouchableOpacity>
                    <View className="flex-1" />
                    <TouchableOpacity>
                      <Ionicons name="bookmark-outline" size={24} color="#d946ef" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-gray-900 dark:text-white">
                    <Text className="font-semibold">{media.username}</Text>
                    {' '}
                    {media.caption}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SwipeBetweenTabs>
  );
}