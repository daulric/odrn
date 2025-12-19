import { SwipeBetweenTabs } from '@/components/swipe-between-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { getGravatarUrl } from '@/lib/getUserProfile';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image'; // Using expo-image for better caching
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
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
const COLUMN_Count = 3;
const IMAGE_SIZE = width / COLUMN_Count;

// A simple utility to generate a consistent color
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 60%)`;
};

type PostImageRow = {
  post_id: string | null;
  image_url: string;
  order_index?: number | null;
};

type Post = {
  id: string;
  content: string | null;
  created_at?: string | null;
  post_images: { image_url: string }[];
};

export default function ProfileScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [headerColor, setHeaderColor] = useState('#93c5fd');

  const avatarUrl = user?.email ? getGravatarUrl(user.email) : null;

  useEffect(() => {
    if (profile?.username) {
      setHeaderColor(stringToColor(profile.username));
    } else if (user?.email) {
      setHeaderColor(stringToColor(user.email));
    }
  }, [profile?.username, user?.email]);

  const fetchFriendCount = async () => {
    if (!profile?.id) return;
    try {
      const { count: sentCount } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('status', 'accepted');

      const { count: receivedCount } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', profile.id)
        .eq('status', 'accepted');

      setFriendCount((sentCount || 0) + (receivedCount || 0));
    } catch (error) {
      console.error('Error fetching friend count:', error);
    }
  };

  const fetchUserPosts = async () => {
    if (!profile?.id) return;
    try {
      const { data: postData, error: postsError } = await supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('userid', profile.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!postData?.length) {
        setPosts([]);
      } else {
        const { data: imageData, error: imagesError } = await supabase
          .from('post_images')
          .select('post_id, image_url, order_index')
          .in(
            'post_id',
            postData.map((post) => post.id)
          )
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
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.all([fetchFriendCount(), fetchUserPosts()]);
  };

  useEffect(() => {
    loadData();
  }, [profile]);

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

  // --- RENDER COMPONENTS ---

  const renderHeader = () => (
    <View className="mb-4">
      {/* Cover Background */}
      <View 
        className="h-48 items-center justify-center mb-16"
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

      {/* User Stats */}
      <View className="px-6 items-center">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-1">
          {profile?.username || 'User'}
        </Text>

        <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full mt-2">
          <Ionicons name="people" size={18} color="#2563eb" />
          <Text className="ml-2 text-blue-700 dark:text-blue-400 font-semibold">
            {friendCount !== null ? `${friendCount} Friends` : '...'}
          </Text>
        </View>
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
          borderWidth: 1 
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

  return (
    <SwipeBetweenTabs current="profile">
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
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
    </SwipeBetweenTabs>
  );
}