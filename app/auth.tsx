import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, refreshProfile, profile } = useAuth();

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
          // Refresh profile - the routing will be handled automatically
          // by app/index.tsx and app/_layout.tsx based on auth state
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
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 justify-center items-center p-5">
        <View className="w-full max-w-sm space-y-4">
        <Text className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </Text>

        <View className="space-y-4">
          <TextInput
            className="w-full h-12 border border-gray-300 rounded-lg px-4 text-base bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <TextInput
            className="w-full h-12 border border-gray-300 rounded-lg px-4 text-base bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />
        </View>

        <TouchableOpacity
          onPress={handleAuth}
          disabled={loading}
          className={`w-full h-12 bg-blue-600 rounded-lg justify-center items-center mt-2 ${loading ? 'opacity-60' : ''}`}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
            className="mt-5 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-center text-blue-600 text-sm dark:text-blue-400">
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

