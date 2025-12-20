import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';

import { useAuth } from '@/contexts/AuthContext';

type Phase = 'checking' | 'downloading' | 'done' | 'error';

export default function UpdatesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const title = useMemo(() => {
    switch (phase) {
      case 'checking':
        return 'Checking for updates…';
      case 'downloading':
        return 'Updating…';
      case 'done':
        return 'Ready';
      case 'error':
        return 'Update check failed';
    }
  }, [phase]);

  const subtitle = useMemo(() => {
    switch (phase) {
      case 'checking':
        return 'Making sure you have the latest version.';
      case 'downloading':
        return 'Downloading the latest update. This may take a moment.';
      case 'done':
        return 'Launching…';
      case 'error':
        return errorMessage ?? 'Please try again.';
    }
  }, [phase, errorMessage]);

  const navigateNext = () => {
    // Wait until auth state is known so we route correctly.
    if (authLoading) return;

    if (!session) {
      router.replace('/auth');
      return;
    }

    if (session && !profile) {
      router.replace('/create-username');
      return;
    }

    router.replace('/(tabs)');
  };

  const checkAndMaybeUpdate = async () => {
    setErrorMessage(null);
    setPhase('checking');

    try {
      // In development, expo-updates usually can't fetch OTA updates.
      // Still show the screen and proceed.
      if (!Updates.isEnabled) {
        setPhase('done');
        return;
      }

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setPhase('downloading');
        await Updates.fetchUpdateAsync();

        // App will restart into the new update.
        await Updates.reloadAsync();
        return;
      }

      setPhase('done');
    } catch (e: any) {
      setPhase('error');
      setErrorMessage(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    void checkAndMaybeUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When we're done checking and auth is ready, continue.
  useEffect(() => {
    if (phase !== 'done') return;
    navigateNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, authLoading, session, profile]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <Surface
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: theme.colors.surface,
            elevation: 1,
          }}
        >
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            {title}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, lineHeight: 20 }}
          >
            {subtitle}
          </Text>

          <View style={{ marginTop: 16 }}>
            {(phase === 'checking' || phase === 'downloading') && (
              <ProgressBar indeterminate color={theme.colors.primary} />
            )}

            {phase === 'error' && (
              <Button
                mode="contained"
                onPress={() => void checkAndMaybeUpdate()}
                style={{ marginTop: 12, borderRadius: 12 }}
              >
                Try again
              </Button>
            )}

            {phase === 'done' && (
              <Button
                mode="contained"
                onPress={navigateNext}
                style={{ marginTop: 12, borderRadius: 12 }}
              >
                Continue
              </Button>
            )}
          </View>
        </Surface>
      </View>
    </SafeAreaView>
  );
}


