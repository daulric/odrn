import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { Image } from "expo-image";
//import * as ImageManipulator from 'expo-image-manipulator'
import { SwipeBetweenTabs } from "@/components/swipe-between-tabs";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Dimensions, ScrollView, TouchableOpacity, View } from "react-native";
import { Button, Surface, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window")

export default function UploadScreen() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const theme = useTheme()

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to upload images.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const imageUris = result.assets.map((asset) => asset.uri)
      setSelectedImages((prev) => (prev.length === 0 ? imageUris : [...prev, ...imageUris]))
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera permissions to take photos.")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImages([result.assets[0].uri])
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadImageToStorage = async (imageUri: string, index: number, postId: string): Promise<string> => {
    let finalUri = imageUri;
    let fileExt = imageUri.split(".").pop()?.toLowerCase();

    const fileName = `${postId}/${Date.now()}-${index}.${fileExt}`;
    const contentType = `image/${fileExt}`;

    try {
      const file = new File(finalUri);
    
      const arrayBuffer = await file.arrayBuffer();

      // 3. Upload to Supabase
      const { data, error } = await supabase.storage
        .from("ordn-images")
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("ordn-images")
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };
  
  const handleUpload = async () => {
    if (selectedImages.length === 0 || !user) {
      Alert.alert("Error", "Please select at least one image first")
      return
    }

    setUploading(true)

    try {
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({
          userid: user.id,
          content: caption.trim() || null,
        })
        .select()
        .single()

      if (postError) throw postError

      const uploadPromises = selectedImages.map((imageUri, index) => uploadImageToStorage(imageUri, index, postData.id))

      const uploadedUrls = await Promise.all(uploadPromises)

      const imageInserts = uploadedUrls.map((imageUrl, index) => ({
        post_id: postData.id,
        image_url: imageUrl,
        order_index: index,
      }));

      const { error: imagesError } = await supabase.from("post_images").insert(imageInserts)

      if (imagesError) throw imagesError

      Alert.alert("Success", "Post uploaded successfully!", [
        {
          text: "OK",
          onPress: () => {
            setSelectedImages([])
            setCaption("")
            router.push("/(tabs)")
          },
        },
      ])
    } catch (error) {
      console.error("Error uploading post:", error)
      Alert.alert("Error", "Failed to upload post. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <SwipeBetweenTabs current="upload">
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Modern gradient header */}
          <LinearGradient
            colors={["#8b5cf6", "#6366f1", "#3b82f6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
          >
            <Text variant="headlineLarge" style={{ color: 'white', fontWeight: '700', marginBottom: 6 }}>
              Create Post
            </Text>
            <Text variant="bodyLarge" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Share your story with the world
            </Text>
          </LinearGradient>

          <View style={{ paddingHorizontal: 20, marginTop: -20 }}>
            {selectedImages.length === 0 ? (
              <View style={{ gap: 16 }}>
                {/* Gallery option - glassmorphism style */}
                <TouchableOpacity
                  onPress={pickImage}
                  activeOpacity={0.7}
                >
                  <Surface
                    style={{
                      borderRadius: 20,
                      backgroundColor: theme.colors.surface,
                      elevation: 0,
                    }}
                  >
                    {/* Keep Surface shadow; apply clipping on an inner wrapper instead of Surface. */}
                    <View style={{ borderRadius: 20, overflow: 'hidden' }}>
                      <LinearGradient
                        colors={[theme.colors.primaryContainer, theme.colors.surface]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ padding: 28 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View 
                            style={{ 
                              width: 64, 
                              height: 64, 
                              borderRadius: 20, 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)'
                            }}
                          >
                            <Ionicons name="images" size={32} color={theme.colors.primary} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 20 }}>
                            <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 4 }}>
                              Photo Gallery
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                              Choose multiple photos from your library
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurfaceVariant} />
                        </View>
                      </LinearGradient>
                    </View>
                  </Surface>
                </TouchableOpacity>

                {/* Camera option */}
                <TouchableOpacity
                  onPress={takePhoto}
                  activeOpacity={0.7}
                >
                  <Surface
                    style={{
                      borderRadius: 20,
                      backgroundColor: theme.colors.surface,
                      elevation: 0,
                    }}
                  >
                    {/* Keep Surface shadow; apply clipping on an inner wrapper instead of Surface. */}
                    <View style={{ borderRadius: 20, overflow: 'hidden' }}>
                      <LinearGradient
                        colors={[theme.colors.tertiaryContainer, theme.colors.surface]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ padding: 28 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View 
                            style={{ 
                              width: 64, 
                              height: 64, 
                              borderRadius: 20, 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              backgroundColor: 'rgba(168, 85, 247, 0.15)'
                            }}
                          >
                            <Ionicons name="camera" size={32} color={theme.colors.tertiary} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 20 }}>
                            <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 4 }}>
                              Take Photo
                            </Text>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                              Capture a new moment right now
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={24} color={theme.colors.onSurfaceVariant} />
                        </View>
                      </LinearGradient>
                    </View>
                  </Surface>
                </TouchableOpacity>

                {/* Pro tip card */}
                <Surface
                  style={{
                    borderRadius: 16,
                    backgroundColor: theme.colors.secondaryContainer + '40',
                    padding: 20,
                    marginTop: 8,
                    elevation: 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Ionicons name="bulb" size={20} color={theme.colors.secondary} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text variant="labelLarge" style={{ fontWeight: '600', marginBottom: 4, color: theme.colors.onSecondaryContainer }}>
                        Pro Tip
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8, lineHeight: 18 }}>
                        You can select multiple photos at once from your gallery to create a photo carousel
                      </Text>
                    </View>
                  </View>
                </Surface>
              </View>
            ) : (
              <View style={{ gap: 20 }}>
                {/* Selected images grid */}
                <Surface
                  style={{
                    borderRadius: 20,
                    backgroundColor: theme.colors.surface,
                    padding: 16,
                    elevation: 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                      <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        Selected Photos
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                        {selectedImages.length} {selectedImages.length === 1 ? 'photo' : 'photos'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={pickImage}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.colors.primaryContainer,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 12,
                      }}
                    >
                      <Ionicons name="add" size={20} color={theme.colors.primary} />
                      <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '600', marginLeft: 4 }}>
                        Add More
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {selectedImages.map((imageUri, index) => {
                      const imageSize = (width - 40 - 32 - 24) / 2

                      return (
                        <View
                          key={index}
                          style={{
                            width: imageSize,
                            height: imageSize,
                            borderRadius: 16,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <Image
                            source={{ uri: imageUri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                          {/* Gradient overlay */}
                          <LinearGradient
                            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                          />
                          {/* Remove button */}
                          <TouchableOpacity
                            onPress={() => removeImage(index)}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: 'rgba(0,0,0,0.7)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="close" size={18} color="white" />
                          </TouchableOpacity>
                          {/* Order badge */}
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 8,
                              left: 8,
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: theme.colors.primary,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: theme.colors.onPrimary, fontSize: 13, fontWeight: '700' }}>
                              {index + 1}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </Surface>

                {/* Caption input */}
                <Surface
                  style={{
                    borderRadius: 20,
                    backgroundColor: theme.colors.surface,
                    padding: 20,
                    elevation: 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View 
                      style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 12, 
                        backgroundColor: theme.colors.primaryContainer,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
                    </View>
                    <Text variant="titleMedium" style={{ fontWeight: '700', marginLeft: 12 }}>
                      Add Caption
                    </Text>
                  </View>
                  
                  <TextInput
                    mode="outlined"
                    placeholder="Share your thoughts..."
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={500}
                    style={{ 
                      minHeight: 120, 
                      backgroundColor: theme.colors.background,
                    }}
                    outlineStyle={{ borderRadius: 16, borderWidth: 2 }}
                    contentStyle={{ paddingTop: 12 }}
                  />
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      Optional, but adds context to your post
                    </Text>
                    <Text 
                      variant="labelMedium" 
                      style={{ 
                        color: caption.length > 450 ? theme.colors.error : theme.colors.outline,
                        fontWeight: '600'
                      }}
                    >
                      {caption.length}/500
                    </Text>
                  </View>
                </Surface>

                {/* Action buttons */}
                <View style={{ gap: 12, marginBottom: 24 }}>
                  <Button
                    mode="contained"
                    onPress={handleUpload}
                    disabled={uploading}
                    loading={uploading}
                    style={{ borderRadius: 16 }}
                    contentStyle={{ paddingVertical: 12 }}
                    labelStyle={{ fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}
                  >
                    {uploading ? <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.background} /> : <Ionicons name="paper-plane-outline" size={20} color={theme.colors.background} />}
                    {uploading ? 'Uploading...' : 'Share Post'}
                  </Button>

                  <Button
                    mode="outlined"
                    onPress={() => setSelectedImages([])}
                    disabled={uploading}
                    style={{ borderRadius: 16, borderWidth: 2 }}
                    contentStyle={{ paddingVertical: 12 }}
                    labelStyle={{ fontSize: 15, fontWeight: '600' }}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.onSurfaceVariant} />
                    Clear All
                  </Button>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SwipeBetweenTabs>
  )
}