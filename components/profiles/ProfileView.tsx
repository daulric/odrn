import { useAuth } from '@/contexts/AuthContext';
import { getAvatarUrl } from '@/lib/getUserProfile';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = width / COLUMN_COUNT;

// Generate a consistent color from a string
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 60%)`;
};

// Generate a unique abstract background image URL based on email/username
const getBackgroundImageUrl = (seed: string) => {
  // Using DiceBear's "shapes" style for abstract geometric backgrounds
  const encodedSeed = encodeURIComponent(seed);
  return `https://api.dicebear.com/7.x/shapes/png?seed=${encodedSeed}&size=800&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

type Profile = {
  id: string;
  username: string | null;
  email: string | null;
  avatar: string | null;
  is_online: boolean | null;
  last_seen: string | null;
};

type Post = {
  id: string;
  content: string | null;
  created_at?: string | null;
  post_images: { image_url: string }[];
};

type PostImageRow = {
  post_id: string | null;
  image_url: string;
  order_index?: number | null;
};

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface ProfileViewProps {
  userId: string;
  showBackButton?: boolean;
}

export default function ProfileView({ userId, showBackButton = true }: ProfileViewProps) {
  const { profile: currentUserProfile } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [headerColor, setHeaderColor] = useState('#93c5fd');
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnProfile = currentUserProfile?.id === userId;
  const avatarUrl = profile?.username || profile?.email ? getAvatarUrl(profile.username || profile.email || '') : null;
  const backgroundImageUrl = profile?.email 
    ? getBackgroundImageUrl(profile.email) 
    : profile?.username 
      ? getBackgroundImageUrl(profile.username) 
      : null;

  useEffect(() => {
    if (profile?.username) {
      setHeaderColor(stringToColor(profile.username));
    } else if (profile?.email) {
      setHeaderColor(stringToColor(profile.email));
    }
  }, [profile?.username, profile?.email]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar, is_online, last_seen')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const fetchFriendCount = async () => {
    try {
      const { count: sentCount } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const { count: receivedCount } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      setFriendCount((sentCount || 0) + (receivedCount || 0));
    } catch (error) {
      console.error('Error fetching friend count:', error);
    }
  };

  const fetchFriendshipStatus = async () => {
    if (!currentUserProfile?.id || isOwnProfile) return;

    try {
      // Check if current user sent a request
      const { data: sentRequest } = await supabase
        .from('friends')
        .select('status')
        .eq('user_id', currentUserProfile.id)
        .eq('friend_id', userId)
        .maybeSingle();

      if (sentRequest) {
        setFriendshipStatus(sentRequest.status === 'accepted' ? 'accepted' : 'pending_sent');
        return;
      }

      // Check if current user received a request
      const { data: receivedRequest } = await supabase
        .from('friends')
        .select('status')
        .eq('user_id', userId)
        .eq('friend_id', currentUserProfile.id)
        .maybeSingle();

      if (receivedRequest) {
        setFriendshipStatus(receivedRequest.status === 'accepted' ? 'accepted' : 'pending_received');
        return;
      }

      setFriendshipStatus('none');
    } catch (error) {
      console.error('Error fetching friendship status:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const { data: postData, error: postsError } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('userid', userId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!postData?.length) {
        setPosts([]);
      } else {
        const { data: imageData, error: imagesError } = await supabase
          .from('post_images')
          .select('post_id, image_url, order_index')
          .in('post_id', postData.map((post) => post.id))
          .order('order_index', { ascending: true });

        if (imagesError) throw imagesError;

        const imagesByPost: Record<string, { image_url: string }[]> = {};
        (imageData || []).forEach((img: PostImageRow) => {
          if (!img.post_id) return;
          if (!imagesByPost[img.post_id]) imagesByPost[img.post_id] = [];
          imagesByPost[img.post_id].push({ image_url: img.image_url });
        });

        const postsWithImages: Post[] = postData.map((post) => ({
          ...post,
          post_images: imagesByPost[post.id] || [],
        }));

        setPosts(postsWithImages);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProfile(),
      fetchFriendCount(),
      fetchUserPosts(),
      fetchFriendshipStatus(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenGravatar = async () => {
    const url = 'https://gravatar.com/profile';
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open Gravatar URL');
    }
  };

  const handleAddFriend = async () => {
    if (!currentUserProfile?.id) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: currentUserProfile.id,
          friend_id: userId,
          status: 'pending',
        });

      if (error) throw error;
      setFriendshipStatus('pending_sent');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptFriend = async () => {
    if (!currentUserProfile?.id) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('user_id', userId)
        .eq('friend_id', currentUserProfile.id);

      if (error) throw error;
      setFriendshipStatus('accepted');
      setFriendCount((prev) => (prev !== null ? prev + 1 : 1));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentUserProfile?.id) return;
    
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${profile?.username || 'this user'} as a friend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              // Delete in both directions
              await supabase
                .from('friends')
                .delete()
                .or(`and(user_id.eq.${currentUserProfile.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserProfile.id})`);

              setFriendshipStatus('none');
              setFriendCount((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMessage = () => {
    void Haptics.selectionAsync();
    router.push(`/chat/${userId}?username=${encodeURIComponent(profile?.username || 'User')}`);
  };

  // --- RENDER COMPONENTS ---

  const renderHeader = () => (
    <View className="mb-4">
      {/* Back Button */}
      {showBackButton && (
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-12 left-4 z-10 bg-black/30 rounded-full p-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Cover Background */}
      <View className="mb-16">
        <View
          className="h-48 overflow-hidden"
          style={{ backgroundColor: headerColor }}
        >
          {backgroundImageUrl && (
            <ExpoImage
              source={{ uri: backgroundImageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={300}
            />
          )}
        </View>
        
        {/* Profile Picture - positioned outside the overflow-hidden container */}
        <View className="absolute bottom-0 left-0 right-0 items-center" style={{ transform: [{ translateY: 64 }] }}>
          <View className="w-32 h-32 rounded-full bg-white dark:bg-gray-800 p-1 justify-center items-center shadow-lg">
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
              {isOwnProfile && (
                <TouchableOpacity
                  onPress={handleOpenGravatar}
                  className="absolute bottom-0 w-full h-8 bg-black/50 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-white text-[10px] font-medium">EDIT</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* User Info */}
      <View className="px-6 items-center">
        {/* Online Status */}
        {profile?.is_online && (
          <View className="flex-row items-center bg-green-500 px-3 py-1 rounded-full mb-2">
            <View className="w-2 h-2 bg-white rounded-full mr-1.5" />
            <Text className="text-white text-xs font-medium">Online</Text>
          </View>
        )}

        <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-1">
          {profile?.username || 'User'}
        </Text>

        <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full mt-2">
          <Ionicons name="people" size={18} color="#2563eb" />
          <Text className="ml-2 text-blue-700 dark:text-blue-400 font-semibold">
            {friendCount !== null ? `${friendCount} Friends` : '...'}
          </Text>
        </View>

        {/* Action Buttons (for other users) */}
        {!isOwnProfile && (
          <View className="flex-row gap-3 mt-4">
            {friendshipStatus === 'none' && (
              <TouchableOpacity
                onPress={handleAddFriend}
                disabled={actionLoading}
                className="flex-row items-center bg-blue-500 px-4 py-2 rounded-full"
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={18} color="white" />
                    <Text className="ml-2 text-white font-semibold">Add Friend</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {friendshipStatus === 'pending_sent' && (
              <View className="flex-row items-center bg-gray-400 px-4 py-2 rounded-full">
                <Ionicons name="time" size={18} color="white" />
                <Text className="ml-2 text-white font-semibold">Request Sent</Text>
              </View>
            )}

            {friendshipStatus === 'pending_received' && (
              <TouchableOpacity
                onPress={handleAcceptFriend}
                disabled={actionLoading}
                className="flex-row items-center bg-green-500 px-4 py-2 rounded-full"
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="white" />
                    <Text className="ml-2 text-white font-semibold">Accept Request</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {friendshipStatus === 'accepted' && (
              <>
                <TouchableOpacity
                  onPress={handleMessage}
                  className="flex-row items-center bg-blue-500 px-4 py-2 rounded-full"
                >
                  <Ionicons name="chatbubble" size={18} color="white" />
                  <Text className="ml-2 text-white font-semibold">Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRemoveFriend}
                  disabled={actionLoading}
                  className="flex-row items-center bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-full"
                >
                  <Ionicons name="person-remove" size={18} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {/* Posts Divider */}
      <View className="flex-row items-center mt-8 mx-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <Ionicons name="grid" size={20} color="#6366f1" />
        <Text className="ml-2 text-lg font-bold text-gray-800 dark:text-gray-100">Posts</Text>
        <Text className="ml-auto text-gray-500 text-sm">{posts.length}</Text>
      </View>
    </View>
  );

  const renderPostItem = ({ item }: { item: Post }) => {
    const hasImage = item.post_images && item.post_images.length > 0;

    return (
      <TouchableOpacity
        onPress={() => {
          void Haptics.selectionAsync();
          router.push({
            pathname: '/posts/[id]',
            params: { id: item.id },
          });
        }}
        className="bg-gray-200 dark:bg-gray-800 border-white dark:border-gray-900"
        style={{
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
          borderWidth: 1,
        }}
      >
        {hasImage ? (
          <ExpoImage
            source={{ uri: item.post_images[0].image_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-2">
            <Text className="text-gray-500 text-xs text-center" numberOfLines={4}>
              {item.content}
            </Text>
          </View>
        )}

        {/* Multiple Images Indicator */}
        {item.post_images && item.post_images.length > 1 && (
          <View className="absolute top-2 right-2 bg-black/60 rounded px-1.5 py-0.5">
            <Ionicons name="albums-outline" size={12} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => (
    <View className="items-center justify-center py-10">
      <View className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-4">
        <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
      </View>
      <Text className="text-gray-500 dark:text-gray-400 font-medium">No posts yet</Text>
    </View>
  );

  if (loading && !profile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <FlatList
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmptyComponent : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

