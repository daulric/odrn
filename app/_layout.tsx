import '@/global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (loading) return;

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'auth';
    const inCreateUsernameGroup = currentSegment === 'create-username';
    const inTabsGroup = currentSegment === '(tabs)';

    if (!session) {
      // Not signed in, redirect to auth (unless already on auth or index)
      if (!inAuthGroup && !inTabsGroup) {
        router.replace('/auth');
      }
    } else if (session && !profile) {
      // Signed in but no profile, redirect to create username (unless already there or in tabs)
      if (!inCreateUsernameGroup && !inTabsGroup) {
        router.replace('/create-username');
      }
    }
    // If logged in with profile, let app/index.tsx handle the redirect to tabs
  }, [session, profile, loading, segments]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="create-username" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
