import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateUsernameScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const { user, profile, refreshProfile } = useAuth();
  const theme = useTheme();

  // Redirect if profile already exists with username
  useEffect(() => {
    if (profile && profile.username) {
      router.replace('/(tabs)');
    }
  }, [profile]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

      const { data: existingProfile, error: existingProfileError } = await (supabase as any)
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

      const { error } = await (supabase as any)
        .from('profiles')
        .upsert({
          id: user.id,
          username: normalizedUsername,
          email: user.email,
        }, { onConflict: 'id' });

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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <View className="flex-1 justify-center items-center p-5">
        <View className="w-full max-w-sm gap-4">
          <View className="gap-2 mb-6 items-center">
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', textAlign: 'center' }}>
              Create Your Username
            </Text>
            <Text variant="bodyMedium" style={{ opacity: 0.7, textAlign: 'center' }}>
              Choose a unique username to get started
            </Text>
          </View>

          <View className="gap-2">
            <TextInput
              mode="outlined"
              label="Username"
              placeholder="e.g. yourname"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              disabled={loading || checking}
              error={isAvailable === false}
              right={
                checking ? (
                  <TextInput.Icon icon={() => <ActivityIndicator size="small" />} />
                ) : isAvailable === true ? (
                  <TextInput.Icon icon={() => <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />} />
                ) : isAvailable === false ? (
                  <TextInput.Icon icon={() => <Ionicons name="close-circle" size={20} color={theme.colors.error} />} />
                ) : undefined
              }
            />

            {isAvailable === false && !checking && (
              <HelperText type="error" visible>
                Username is already taken
              </HelperText>
            )}

            {isAvailable === true && !checking && (
              <HelperText type="info" visible style={{ color: theme.colors.primary }}>
                Username is available
              </HelperText>
            )}

            {checking && (
              <HelperText type="info" visible>
                Checking availability...
              </HelperText>
            )}
          </View>

          <Button
            mode="contained"
            onPress={handleCreateUsername}
            loading={loading}
            disabled={loading || checking || isAvailable !== true}
            style={{ marginTop: 4, borderRadius: 8 }}
            contentStyle={{ height: 48 }}
            labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
          >
            Continue
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

