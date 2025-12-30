import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import CryptoJS from 'crypto-js';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    TouchableOpacity,
    View,
} from 'react-native';
import { Avatar, Card, IconButton, Text, useTheme } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
export interface PostImage {
  id?: string;
  image_url: string;
  order_index: number | null;
}

export interface PostProfile {
  id?: string;
  username: string | null;
  email: string | null;
  avatar?: string | null;
}

export interface PostData {
  id: string;
  userid: string;
  content: string | null;
  created_at: string | null;
  post_images: PostImage[];
  profiles: PostProfile | null;
}

interface PostCardProps {
  post: PostData;
  /** Show full content without truncation */
  expanded?: boolean;
  /** Horizontal padding for the card */
  horizontalPadding?: number;
  /** Image height */
  imageHeight?: number;
  /** Show the options menu button */
  showOptionsMenu?: boolean;
  /** Callback when the card (not actions) is pressed */
  onPress?: () => void;
  /** Children to render after the content (e.g., comments) */
  children?: React.ReactNode;
  /** Callback when like state changes */
  onLikeChange?: (postId: string, isLiked: boolean, count: number) => void;
}

// Utility functions
const getGravatarUrl = (emailAddress: string) => {
  const address = String(emailAddress || '').trim().toLowerCase();
  const hash = CryptoJS.MD5(address).toString();
  return `https://www.gravatar.com/avatar/${hash}?s=200&d=mp`;
};

const formatTimeAgo = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

export function PostCard({
  post,
  expanded = false,
  horizontalPadding = 16,
  imageHeight = 240,
  showOptionsMenu = true,
  onPress,
  children,
  onLikeChange,
}: PostCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Likes state
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Derived values
  const username = post.profiles?.username || 'User';
  const avatarEmail = post.profiles?.email || post.profiles?.username || '';
  const avatarUrl = getGravatarUrl(avatarEmail);
  const profileId = post.profiles?.id || post.userid;
  
  const sortedImages = [...(post.post_images || [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );
  const firstImage = sortedImages[0]?.image_url;
  const hasMultipleImages = sortedImages.length > 1;

  // Fetch likes
  const fetchLikes = useCallback(async () => {
    try {
      const { count, error: countError } = await supabase
        .from('posts_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (countError) throw countError;
      setLikesCount(count || 0);

      if (user?.id) {
        const { data: likeData, error: likeError } = await supabase
          .from('posts_likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (likeError) throw likeError;
        setIsLiked(!!likeData);
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  }, [post.id, user?.id]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  // Toggle like
  const toggleLike = async () => {
    if (!user?.id || likeLoading) return;

    setLikeLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const wasLiked = isLiked;
    const prevCount = likesCount;

    // Optimistic update
    const newIsLiked = !wasLiked;
    const newCount = wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
    setIsLiked(newIsLiked);
    setLikesCount(newCount);
    onLikeChange?.(post.id, newIsLiked, newCount);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('posts_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('posts_likes')
          .insert({ post_id: post.id, user_id: user.id });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert
      setIsLiked(wasLiked);
      setLikesCount(prevCount);
      onLikeChange?.(post.id, wasLiked, prevCount);
    } finally {
      setLikeLoading(false);
    }
  };

  // Navigate to profile
  const handleProfilePress = () => {
    void Haptics.selectionAsync();
    router.push(`/profiles/${profileId}?username=${encodeURIComponent(username)}`);
  };

  // Navigate to post detail
  const handlePostPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/posts/${post.id}`);
    }
  };

  // Handle options menu
  const handleOptionsPress = () => {
    Alert.alert('Options', 'Post options coming soon');
  };

  // Render image carousel item
  const renderImageItem = ({ item }: { item: PostImage }) => (
    <Image
      source={{ uri: item.image_url }}
      style={{ width: SCREEN_WIDTH - horizontalPadding * 2 - 32, height: imageHeight }}
      contentFit="cover"
    />
  );

  return (
    <Card
      style={{
        marginHorizontal: horizontalPadding,
        marginBottom: 16,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        elevation: 0,
      }}
      onPress={expanded ? undefined : handlePostPress}
    >
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        {/* Post Header */}
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleProfilePress}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            activeOpacity={0.7}
          >
            <Avatar.Image
              size={44}
              source={{ uri: avatarUrl }}
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {username}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatTimeAgo(post.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
          {showOptionsMenu && (
            <IconButton
              icon="dots-vertical"
              size={20}
              onPress={handleOptionsPress}
            />
          )}
        </View>

        {/* Post Images */}
        {sortedImages.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ borderRadius: 16, overflow: 'hidden' }}>
              {expanded && hasMultipleImages ? (
                // Carousel for expanded view with multiple images
                <View>
                  <FlatList
                    data={sortedImages}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, index) => `${item.image_url}-${index}`}
                    renderItem={renderImageItem}
                    onMomentumScrollEnd={(event) => {
                      const index = Math.round(
                        event.nativeEvent.contentOffset.x /
                          (SCREEN_WIDTH - horizontalPadding * 2 - 32)
                      );
                      setCurrentImageIndex(index);
                    }}
                  />
                  {/* Image indicators */}
                  {hasMultipleImages && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 0,
                        right: 0,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      {sortedImages.map((_, index) => (
                        <View
                          key={index}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor:
                              currentImageIndex === index
                                ? 'white'
                                : 'rgba(255,255,255,0.4)',
                          }}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                // Single image for feed view
                <Image
                  source={{ uri: firstImage }}
                  style={{ width: '100%', height: imageHeight }}
                  contentFit="cover"
                />
              )}
            </View>
            {/* Multiple images indicator for non-expanded */}
            {!expanded && hasMultipleImages && (
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 28,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Ionicons name="albums-outline" size={14} color="white" />
              </View>
            )}
          </View>
        )}

        {/* Post Actions */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 8,
          }}
        >
          {/* Like Button */}
          <TouchableOpacity
            onPress={toggleLike}
            disabled={likeLoading || !user}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: likeLoading ? 0.6 : 1,
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? '#ef4444' : theme.colors.onSurface}
            />
            {likesCount > 0 && (
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.colors.onSurface,
                }}
              >
                {likesCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Comment Button */}
          <IconButton
            icon="comment-outline"
            size={26}
            onPress={() => router.push(`/posts/${post.id}`)}
          />

          {/* Share Button */}
          <IconButton
            icon="share-outline"
            size={26}
            onPress={() => Alert.alert('Share', 'Share functionality coming soon')}
          />

          <View style={{ flex: 1 }} />

          {/* Bookmark Button */}
          <IconButton
            icon="bookmark-outline"
            size={26}
            onPress={() => Alert.alert('Save', 'Save functionality coming soon')}
          />
        </View>

        {/* Post Content */}
        {post.content && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text
              variant="bodyMedium"
              style={{ lineHeight: 20 }}
              numberOfLines={expanded ? undefined : 3}
            >
              <Text style={{ fontWeight: '700' }}>{username}</Text> {post.content}
            </Text>
          </View>
        )}

        {/* Children (e.g., comments section) */}
        {children}
      </View>
    </Card>
  );
}

