import { PostCard, PostData } from "@/components/posts"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View } from "react-native"
import { Surface, Text, useTheme } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"

export default function PostScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id?: string }>()
  const postId = typeof params.id === "string" ? params.id : undefined
  const { user } = useAuth()

  const theme = useTheme()
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

      setPost(data as PostData)
    } catch (error) {
      console.error("Error fetching post:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPost()
  }, [postId, user?.id])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPost()
  }, [postId])

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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      >
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : !post ? (
          renderEmpty()
        ) : (
          <View style={{ marginTop: 20 }}>
            <PostCard
              post={post}
              expanded={true}
              imageHeight={350}
            >
              {/* Comments section can be added here as children */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  Comments coming soon...
                </Text>
              </View>
            </PostCard>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
