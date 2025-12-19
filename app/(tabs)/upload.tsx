"use client"

import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useRouter } from "expo-router"

const { width } = Dimensions.get("window")

export default function UploadScreen() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to upload images.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "livePhotos"],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    })

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
    const fileExt = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${postId}/${Date.now()}-${index}.${fileExt}`;
    const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
  
    try {
      // 1. Fetch the local file URI to get a Blob (Web Standard)
      const response = await fetch(imageUri);
      const blob = await response.blob();
  
      // 2. Upload the Blob directly to Supabase
      const { data, error } = await supabase.storage
        .from("ordn-images")
        .upload(fileName, blob, {
          contentType,
          upsert: false,
        });
  
      if (error) throw error;
  
      // 3. Get the public URL
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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#6366f1", "#8b5cf6", "#d946ef"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View className="px-6 pt-4 pb-8">
            <Text className="text-4xl font-bold text-white mb-2">Create Post</Text>
            <Text className="text-white/80 text-base">Share your moments with friends</Text>
          </View>
        </LinearGradient>

        <View className="px-6 mt-6">
          {selectedImages.length === 0 ? (
            <>
              <TouchableOpacity
                onPress={pickImage}
                className="bg-white dark:bg-gray-800 rounded-3xl p-8 mb-4 items-center border-2 border-dashed border-gray-300 dark:border-gray-700 active:scale-95"
                style={{
                  shadowColor: "#6366f1",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full items-center justify-center mb-4">
                  <Ionicons name="image" size={40} color="#6366f1" />
                </View>
                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">Choose from Gallery</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-center">
                  Select photos from your camera roll
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={takePhoto}
                className="bg-white dark:bg-gray-800 rounded-3xl p-8 items-center border-2 border-dashed border-gray-300 dark:border-gray-700 active:scale-95"
                style={{
                  shadowColor: "#8b5cf6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <View className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full items-center justify-center mb-4">
                  <Ionicons name="camera" size={40} color="#8b5cf6" />
                </View>
                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">Take a Photo</Text>
                <Text className="text-gray-500 dark:text-gray-400 text-center">
                  Use your camera to capture a moment
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden mb-6 shadow-lg p-3">
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {selectedImages.map((imageUri, index) => {
                    // Calculate proper grid sizing: 2 columns with equal spacing
                    const imageSize = (width - 48 - 16 - 8) / 2 // account for container padding and gap

                    return (
                      <View
                        key={index}
                        className="relative"
                        style={{
                          width: imageSize,
                          height: imageSize,
                        }}
                      >
                        <Image
                          source={{ uri: imageUri }}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 16,
                          }}
                          contentFit="cover"
                        />
                        <TouchableOpacity
                          onPress={() => removeImage(index)}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full items-center justify-center"
                        >
                          <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                        <View className="absolute bottom-2 left-2 w-6 h-6 bg-indigo-600 rounded-full items-center justify-center">
                          <Text className="text-white text-xs font-bold">{index + 1}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>

                <TouchableOpacity
                  onPress={pickImage}
                  className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex-row items-center justify-center"
                >
                  <Ionicons name="add-circle" size={24} color="#6366f1" />
                  <Text className="text-indigo-600 dark:text-indigo-400 font-semibold ml-2">Add More Images</Text>
                </TouchableOpacity>
              </View>

              <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 mb-6 shadow-sm">
                <View className="flex-row items-center mb-4">
                  <Ionicons name="text" size={24} color="#6366f1" />
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white ml-3">Add a caption</Text>
                </View>
                <TextInput
                  className="text-gray-900 dark:text-white text-base p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl"
                  placeholder="What's on your mind?"
                  placeholderTextColor="#9CA3AF"
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={500}
                  style={{ minHeight: 120, textAlignVertical: "top" }}
                />
                <Text className="text-gray-400 text-sm mt-2 text-right">{caption.length}/500</Text>
              </View>

              <TouchableOpacity
                onPress={handleUpload}
                disabled={uploading}
                className="rounded-2xl p-5 items-center mb-4 active:scale-95"
                style={{
                  shadowColor: "#6366f1",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <LinearGradient
                  colors={["#6366f1", "#8b5cf6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 16,
                  }}
                />
                {uploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons name="cloud-upload" size={24} color="white" />
                    <Text className="text-white text-lg font-bold ml-3">Share Post</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedImages([])}
                disabled={uploading}
                className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-5 items-center active:scale-95"
              >
                <Text className="text-gray-900 dark:text-white text-lg font-semibold">Clear All Images</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}