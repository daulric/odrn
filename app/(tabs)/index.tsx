import { SwipeBetweenTabs } from '@/components/navigation';
import { PostCard, PostData } from '@/components/posts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import CryptoJS from 'crypto-js';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Appbar, Avatar, Badge, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface Friend {
  id: string;
  username: string;
  email: string;
  status: 'online' | 'offline';
  last_seen?: string;
}

type FeedPost = {
  id: string;
  userid: string;
  content: string | null;
  created_at: string | null;
  post_images: { image_url: string; order_index: number | null }[];
  profiles: { username: string | null; email: string | null; id?: string } | null;
};

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const appState = useRef(AppState.currentState);
  const FRIEND_GAP = 12;
  const PAGE_HORIZONTAL_PADDING = 16;
  const FRIENDS_PER_VIEW = Math.min(Math.max(friends.length, 3), 5); // scale up to 5 cards wide
  const availableWidth = width - PAGE_HORIZONTAL_PADDING * 2;
  const friendCardWidth = Math.floor(
    Math.max(76, Math.min(92, (availableWidth - FRIEND_GAP * (FRIENDS_PER_VIEW - 1)) / FRIENDS_PER_VIEW))
  );

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
  const fetchFriends = useCallback(async () => {
    if (!user) return;

    setLoading(true);
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
        return;
      }

      const friendIds = friendships.map((f: any) => (f.user_id === user.id ? f.friend_id : f.user_id));

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
  }, [user]);

  useEffect(() => {
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
  }, [user, fetchFriends]);

  // Fetch feed posts
  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(
          `
          id,
          userid,
          content,
          created_at,
          post_images (
            image_url,
            order_index
          ),
          profiles (
            id,
            username,
            email
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;
      const posts = (data as any) ?? [];
      setFeedPosts(posts);
    } catch (e) {
      console.error('Error fetching feed:', e);
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchFriends(), fetchFeed()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFeed, fetchFriends]);

  const handleFriendPress = (friendId: string, username: string) => {
    router.push(`/profiles/${friendId}?username=${username}`);
  };

  return (
    <SwipeBetweenTabs current="index">
      {/* Avoid double top inset: Appbar.Header already accounts for the status bar/safe area. */}
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['left', 'right', 'bottom']}>
        <Appbar.Header elevated>
          <Appbar.Content title="Home" />
          <Appbar.Action icon="magnify" onPress={() => {}} />
        </Appbar.Header>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Profile / status card */}
          <Surface
            style={{
              borderRadius: 20,
              padding: 16,
              backgroundColor: theme.colors.primaryContainer,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View>
                <Avatar.Image
                  size={64}
                  source={avatarSource}
                  style={{ backgroundColor: theme.colors.surface }}
                />
                <Badge
                  visible
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 2,
                    bottom: 2,
                    backgroundColor: theme.colors.primary,
                  }}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text variant="titleLarge" style={{ fontWeight: '700' }}>
                  {profile?.username || 'User'}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, marginTop: 2 }}>
                  Online
                </Text>
              </View>

              <IconButton
                icon="cog-outline"
                onPress={() => router.push('/(tabs)/more')}
                iconColor={theme.colors.onPrimaryContainer}
              />
            </View>
          </Surface>

          {/* Friends */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 10 }}>
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>
              Friends
            </Text>
            <View style={{ flex: 1 }} />
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
            </Text>
          </View>

          {loading ? (
            <Surface style={{ borderRadius: 16, padding: 16, elevation: 0, backgroundColor: theme.colors.surface }}>
              <ActivityIndicator animating size="large" color={theme.colors.primary} />
            </Surface>
          ) : friends.length === 0 ? (
            <Surface style={{ borderRadius: 16, padding: 16, elevation: 0, backgroundColor: theme.colors.surface }}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Ionicons name="people-outline" size={42} color={theme.colors.onSurfaceVariant} />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                  No friends yet. Start connecting with others!
                </Text>
              </View>
            </Surface>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: FRIEND_GAP,
                paddingVertical: 4,
                // If we have only a few friends, center the row within the available width.
                flexGrow: friends.length <= FRIENDS_PER_VIEW ? 1 : 0,
                justifyContent: friends.length <= FRIENDS_PER_VIEW ? 'center' : 'flex-start',
              }}
            >
              {friends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  onPress={() => handleFriendPress(friend.id, friend.username)}
                  activeOpacity={0.7}
                >
                  <Surface
                    style={{
                      width: friendCardWidth,
                      borderRadius: 18,
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      alignItems: 'center',
                      backgroundColor: theme.colors.surface,
                      elevation: 1,
                    }}
                  >
                    <View>
                      <Avatar.Image
                        size={56}
                        source={{ uri: getGravatarUrl(friend.email) }}
                        style={{ backgroundColor: theme.colors.surfaceVariant }}
                      />
                      {friend.status === 'online' && (
                        <Badge
                          visible
                          size={12}
                          style={{
                            position: 'absolute',
                            right: 2,
                            bottom: 2,
                            backgroundColor: '#22c55e',
                          }}
                        />
                      )}
                    </View>
                    <Text
                      variant="labelMedium"
                      numberOfLines={1}
                      style={{ marginTop: 8, fontWeight: '600', textAlign: 'center' }}
                    >
                      {friend.username.split(' ')[0]}
                    </Text>
                  </Surface>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Feed */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>
              Feed
            </Text>
            <View style={{ flex: 1 }} />
            <IconButton icon="view-grid-outline" onPress={() => {}} />
          </View>

          {feedLoading ? (
            <Surface style={{ borderRadius: 16, padding: 16, elevation: 0, backgroundColor: theme.colors.surface }}>
              <ActivityIndicator animating size="large" color={theme.colors.primary} />
            </Surface>
          ) : feedPosts.length === 0 ? (
            <Surface style={{ borderRadius: 16, padding: 16, elevation: 0, backgroundColor: theme.colors.surface }}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Ionicons name="images-outline" size={42} color={theme.colors.onSurfaceVariant} />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                  No posts yet.
                </Text>
              </View>
            </Surface>
          ) : (
            feedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post as PostData}
                expanded={false}
                horizontalPadding={0}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SwipeBetweenTabs>
  );
}