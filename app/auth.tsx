import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, refreshProfile } = useAuth();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          Alert.alert('Sign Up Error', error.message);
        } else {
          Alert.alert('Success', 'Account created! Please create your username.', [
            {
              text: 'OK',
              onPress: () => router.replace('/create-username'),
            },
          ]);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert('Sign In Error', error.message);
        } else {
          await refreshProfile();
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 justify-center px-6 py-10">
            {/* Header */}
            <View className="items-center mb-10">
              <View className="w-16 h-16 bg-blue-600 rounded-2xl items-center justify-center mb-6 shadow-lg shadow-blue-200 dark:shadow-none">
                <Ionicons name="chatbubble-ellipses" size={32} color="white" />
              </View>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 text-center">
                {isSignUp
                  ? 'Sign up to get started with your new account'
                  : 'Sign in to continue to your conversations'}
              </Text>
            </View>

            {/* Form */}
            <View className="space-y-4">
              <View>
                <Text className="text-gray-700 dark:text-gray-300 font-medium mb-1.5 ml-1">
                  Email Address
                </Text>
                <View className="flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 h-12">
                  <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                  <TextInput
                    className="flex-1 ml-3 text-gray-900 dark:text-white text-base"
                    placeholder="name@example.com"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View>
                <Text className="text-gray-700 dark:text-gray-300 font-medium mb-1.5 ml-1">
                  Password
                </Text>
                <View className="flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 h-12">
                  <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                  <TextInput
                    className="flex-1 ml-3 text-gray-900 dark:text-white text-base"
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {!isSignUp && (
                <View className="flex-row justify-end">
                  <TouchableOpacity>
                    <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={handleAuth}
                disabled={loading}
                className={`bg-blue-600 h-12 rounded-xl flex-row justify-center items-center mt-4 shadow-sm shadow-blue-200 dark:shadow-none ${
                  loading ? 'opacity-70' : ''
                }`}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-lg font-semibold">
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-600 dark:text-gray-400">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                <Text className="text-blue-600 dark:text-blue-400 font-semibold">
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
