import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateUsernameScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const { user, profile, refreshProfile } = useAuth();

  // Redirect if profile already exists with username
  useEffect(() => {
    if (profile && profile.username) {
      router.replace('/(tabs)');
    }
  }, [profile]);

  // Don't render if profile already exists with username
  if (profile && profile.username) {
    return null;
  }

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setIsAvailable(null);
      return;
    }

    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameToCheck.toLowerCase().trim())
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows returned, username is available
        setIsAvailable(true);
      } else if (data) {
        // Username already exists
        setIsAvailable(false);
      } else {
        setIsAvailable(false);
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setIsAvailable(null);
    } finally {
      setChecking(false);
    }
  };

  // Debounce username availability check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username) {
        checkUsernameAvailability(username);
      } else {
        setIsAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setIsAvailable(null);
  };

  const handleCreateUsername = async () => {
    if (!username || username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    if (isAvailable === false) {
      Alert.alert('Error', 'This username is already taken. Please choose another one.');
      return;
    }

    if (isAvailable === null) {
      Alert.alert('Error', 'Please wait while we check username availability');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not found. Please sign in again.');
      router.replace('/auth');
      return;
    }

    setLoading(true);
    try {
      const normalizedUsername = username.toLowerCase().trim();

      const { data: existingProfile, error: existingProfileError } = await supabase
        .schema('ordn')
        .from('profiles')
        .select('id')
        .eq('username', normalizedUsername)
        .maybeSingle();

      if (existingProfileError && existingProfileError.code !== 'PGRST116') {
        throw existingProfileError;
      }

      if (existingProfile && existingProfile.id !== user.id) {
        setIsAvailable(false);
        Alert.alert('Error', 'This username is already taken. Please choose another one.');
        return;
      }

      const { error } = await supabase
        .schema('ordn')
        .from('profiles')
        .insert({
          id: user.id,
          username: normalizedUsername,
          avatar: null,
          created_at: new Date().toISOString(),
        });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          Alert.alert('Error', 'This username is already taken. Please choose another one.');
          setIsAvailable(false);
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        await refreshProfile();
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getInputBorderColor = () => {
    if (isAvailable === false) return 'border-red-500';
    if (isAvailable === true) return 'border-green-500';
    return 'border-gray-300 dark:border-gray-600';
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 justify-center items-center p-5">
        <View className="w-full max-w-sm space-y-4">
        <View className="space-y-2 mb-6">
          <Text className="text-3xl font-bold text-center text-gray-900 dark:text-white">
            Create Your Username
          </Text>
          <Text className="text-center opacity-70 text-gray-700 dark:text-gray-300">
            Choose a unique username to get started
          </Text>
        </View>

        <View className="space-y-2">
          <TextInput
            className={`w-full h-12 border rounded-lg px-4 text-base bg-white dark:bg-gray-800 dark:text-white ${getInputBorderColor()}`}
            placeholder="Username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !checking}
          />

          {checking && (
            <Text className="text-sm text-center text-gray-500 dark:text-gray-400">
              Checking availability...
            </Text>
          )}

          {isAvailable === true && !checking && (
            <Text className="text-sm text-center text-green-600 dark:text-green-400">
              ✓ Username is available
            </Text>
          )}

          {isAvailable === false && !checking && (
            <Text className="text-sm text-center text-red-600 dark:text-red-400">
              ✗ Username is already taken
            </Text>
          )}
        </View>

          <TouchableOpacity
            onPress={handleCreateUsername}
            disabled={loading || checking || isAvailable !== true}
            className={`w-full h-12 bg-blue-600 rounded-lg justify-center items-center mt-2 ${
              loading || checking || isAvailable !== true ? 'opacity-60' : ''
            }`}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

