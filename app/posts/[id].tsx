"use client"

import { getGravatarUrl } from "@/lib/getUserProfile"
import { supabase } from "@/lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Dimensions, FlatList, RefreshControl, ScrollView, TouchableOpacity, View } from "react-native"
import { Appbar, Avatar, Card, IconButton, Surface, Text, useTheme } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"

const { width } = Dimensions.get("window")

type PostImage = {
  id: string
  image_url: string
  order_index: number
}

type Post = {
  id: string
  userid: string
  content: string | null
  created_at: string | null
  post_images: PostImage[]
  profiles: {
    id: string
    username: string | null
    avatar: string | null
    email: string | null
  }
}

export default function PostScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const postId = typeof params.id === "string" ? params.id : undefined

  const theme = useTheme()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const fetchPost = async () => {
    if (!postId) {
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id,
          userid,
          content,
          created_at,
          post_images (
            id,
            image_url,
            order_index
          ),
          profiles (
            id,
            username,
            avatar,
            email
          )
        `)
        .eq("id", postId)
        .single()

      if (error) throw error

      setPost(data)
    } catch (error) {
      console.error("Error fetching posts:", error)
      Alert.alert("Error", "Failed to load post")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPost()
  }, [postId])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPost()
  }, [postId])

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return "just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const handleImageScroll = (index: number) => {
    setCurrentImageIndex(index)
  }

  const renderEmpty = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
      <Surface
        style={{
          borderRadius: 20,
          padding: 32,
          alignItems: "center",
          backgroundColor: theme.colors.surface,
          marginHorizontal: 32,
          elevation: 0,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.colors.primaryContainer,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="images-outline" size={40} color={theme.colors.primary} />
        </View>
        <Text variant="titleLarge" style={{ fontWeight: "700", marginBottom: 8 }}>
          Post Not Found
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginBottom: 24 }}
        >
          This post may have been deleted or you may not have access to it.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
          onPress={() => router.push("/(tabs)/upload")}
        >
          <Ionicons name="add-circle" size={20} color={theme.colors.onPrimary} />
          <Text style={{ color: theme.colors.onPrimary, fontWeight: "700", fontSize: 16 }}>
            Create a Post
          </Text>
        </TouchableOpacity>
      </Surface>
    </View>
  )

  const sortedImages = post ? [...post.post_images].sort((a, b) => a.order_index - b.order_index) : []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["left", "right"]}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : !post ? (
          renderEmpty()
        ) : (
          <Card
            style={{
              marginTop: 20,
              marginHorizontal: 16,
              marginBottom: 16,
              borderRadius: 20,
              backgroundColor: theme.colors.surface,
              elevation: 0,
            }}
          >
            {/* Important: keep Card's shadow; apply clipping in an inner wrapper instead of setting overflow on Card. */}
            <View style={{ borderRadius: 20, overflow: "hidden" }}>
              {/* Post Header */}
              <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
                <Avatar.Image
                  size={44}
                  source={{ uri: getGravatarUrl(post.profiles.email || "") || "https://via.placeholder.com/150" }}
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    {post.profiles.username || "User"}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatTimeAgo(post.created_at)}
                  </Text>
                </View>
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => Alert.alert("Options", "Post options coming soon")}
                />
              </View>

              {/* Post Images Carousel */}
              {sortedImages.length > 0 && (
                <View>
                  <FlatList
                    data={sortedImages}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.x / width)
                      handleImageScroll(index)
                    }}
                    renderItem={({ item: img }) => (
                      <Image
                        source={{ uri: img.image_url }}
                        style={{ width: width - 32, height: width - 32 }}
                        contentFit="cover"
                      />
                    )}
                    keyExtractor={(img) => img.id}
                  />

                  {/* Image Indicators */}
                  {sortedImages.length > 1 && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 0,
                        right: 0,
                        flexDirection: "row",
                        justifyContent: "center",
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
                            backgroundColor: currentImageIndex === index ? "white" : "rgba(255,255,255,0.4)",
                          }}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Post Actions */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                }}
              >
                <IconButton
                  icon="heart-outline"
                  size={26}
                  onPress={() => Alert.alert("Like", "Like functionality coming soon")}
                />
                <IconButton
                  icon="comment-outline"
                  size={26}
                  onPress={() => Alert.alert("Comment", "Comment functionality coming soon")}
                />
                <IconButton
                  icon="share-outline"
                  size={26}
                  onPress={() => Alert.alert("Share", "Share functionality coming soon")}
                />
                <View style={{ flex: 1 }} />
                <IconButton
                  icon="bookmark-outline"
                  size={26}
                  onPress={() => Alert.alert("Save", "Save functionality coming soon")}
                />
              </View>

              {/* Post Caption */}
              {post.content && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <Text variant="bodyMedium" style={{ lineHeight: 20 }}>
                    <Text style={{ fontWeight: "700" }}>{post.profiles.username || "user"}</Text> {post.content}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}