import '@/global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isCallingSupported } from '@/lib/calling/isCallingSupported';
import { acceptCall, declineCall, subscribeToIncomingCalls } from '@/lib/calling/signaling';
import type { CallRow } from '@/lib/calling/types';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  initCallNotificationChannelsAndCategories,
  registerForPushNotificationsAsync,
} from "@/lib/notifications/push";
import { supabase } from '@/lib/supabase';
import { Button, Dialog, MD3DarkTheme, MD3LightTheme, Provider as PaperProvider, Portal, Text } from 'react-native-paper';

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const lastIncomingCallIdRef = useRef<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallRow | null>(null);
  const [incomingVisible, setIncomingVisible] = useState(false);
  const [incomingCallerName, setIncomingCallerName] = useState<string>('Someone');
  const callingSupported = isCallingSupported();

  const currentSegment = useMemo(() => String(segments[0] ?? ''), [segments]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = currentSegment === 'auth';
    const inCreateUsernameGroup = currentSegment === 'create-username';
    const inTabsGroup = currentSegment === '(tabs)';
    const inUpdatesScreen = currentSegment === 'updates-screen';

    if (!session) {
      // Not signed in, redirect to auth (unless already on auth or index)
      if (!inAuthGroup && !inTabsGroup && !inUpdatesScreen) {
        router.replace('/auth');
      }
    } else if (session && !profile) {
      // Signed in but no profile, redirect to create username (unless already there or in tabs)
      if (!inCreateUsernameGroup && !inTabsGroup && !inUpdatesScreen) {
        router.replace('/create-username');
      }
    }
    // If logged in with profile, let app/index.tsx handle the redirect to tabs
  }, [session, profile, loading, segments]);

  // Push notifications: setup channels/categories, register token, and handle Accept/Decline actions.
  useEffect(() => {
    void initCallNotificationChannelsAndCategories();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session?.user?.id) return;

    void (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      try {
        // Requires a `profiles.expo_push_token` column in Supabase (see note in README/SQL).
        await (supabase as any).from("profiles").update({ expo_push_token: token }).eq("id", session.user.id);
      } catch (e) {
        // If the column/table doesn't exist yet, don't crash the app.
        console.warn("Failed to save expo push token:", e);
      }
    })();
  }, [loading, session?.user?.id]);

  useEffect(() => {
    const handleResponse = async (response: any) => {
      const action = response.actionIdentifier;
      const data = (response.notification.request.content.data ?? {}) as any;
      const callId = typeof data.callId === "string" ? data.callId : undefined;
      const type = data.type;

      if (type !== "incoming_call" || !callId) return;

      try {
        if (action === "DECLINE_CALL") {
          await declineCall(callId);
          return;
        }

        // ACCEPT_CALL or default tap both navigate to the call screen.
        if (action === "ACCEPT_CALL") {
          await acceptCall(callId);
        }
      } catch (e) {
        console.warn("Notification call action failed:", e);
      } finally {
        // Always navigate so user can continue from the call screen.
        router.push(`/call/${callId}`);
      }
    };

    const sub = addNotificationResponseReceivedListener((r) => {
      void handleResponse(r as any);
    });

    // Handle cold-start from a notification tap.
    void getLastNotificationResponseAsync().then((r) => {
      if (r) void handleResponse(r);
    });

    return () => sub.remove();
  }, [router]);

  // Global incoming call listener (routes to call screen when a friend calls you)
  useEffect(() => {
    if (loading) return;
    if (!session?.user?.id) return;
    if (!callingSupported) return;

    const userId = session.user.id;

    const unsubscribe = subscribeToIncomingCalls({
      userId,
      onIncoming: (call) => {
        // Avoid double navigation from duplicate events
        if (lastIncomingCallIdRef.current === call.id) return;
        lastIncomingCallIdRef.current = call.id;

        // If we’re already on a call screen, ignore.
        if (currentSegment === 'call') return;

        setIncomingCall(call);
        setIncomingVisible(true);

        // Best-effort fetch caller name for the popup
        void (async () => {
          try {
            const { data } = await supabase.from('profiles').select('username').eq('id', call.caller_id).maybeSingle();
            const name = (data as any)?.username;
            setIncomingCallerName(name || 'Someone');
          } catch {
            setIncomingCallerName('Someone');
          }
        })();
      },
      onUpdate: (call) => {
        if (!incomingCall) return;
        if (call.id !== incomingCall.id) return;
        // If call no longer ringing, close popup.
        if (call.status !== 'ringing') {
          setIncomingVisible(false);
          setIncomingCall(null);
        }
      },
    });

    return () => unsubscribe();
  }, [loading, session?.user?.id, router, currentSegment, incomingCall, callingSupported]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const paperTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PaperProvider theme={paperTheme}>
          <Portal>
            <Dialog visible={incomingVisible} dismissable={false}>
              <Dialog.Title>Incoming call</Dialog.Title>
              <Dialog.Content>
                <Text>{incomingCallerName} is calling you.</Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button
                  onPress={async () => {
                    if (!incomingCall) return;
                    try {
                      // Decline by updating status server-side; DB trigger enforces callee-only decline.
                      await (supabase as any).from('calls').update({ status: 'declined' }).eq('id', incomingCall.id);
                    } catch (e) {
                      console.error('Failed to decline call:', e);
                    } finally {
                      setIncomingVisible(false);
                      setIncomingCall(null);
                    }
                  }}
                >
                  Decline
                </Button>
                <Button
                  mode="contained"
                  onPress={async () => {
                    if (!incomingCall) return;
                    try {
                      // Accept server-side so the caller sees the state transition immediately.
                      await acceptCall(incomingCall.id);
                    } catch (e) {
                      console.error('Failed to accept call:', e);
                      // Still navigate so the user can try accepting from the call screen.
                    } finally {
                      setIncomingVisible(false);
                      router.push(`/call/${incomingCall.id}`);
                    }
                  }}
                >
                  Accept
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
          <Stack initialRouteName="updates-screen">
            <Stack.Screen name="updates-screen" options={{ headerShown: false }} />
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="create-username" options={{ headerShown: false }} />
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
                // Prevent iOS/Android edge-swipe-back from popping the entire tabs screen (which can look like the app "exits").
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="info/about"
              options={{
                title: "About",
                headerBackTitle: "Return",
              }}
            />
            <Stack.Screen
              name="info/privacy"
              options={{
                title: "Privacy",
                headerBackTitle: "Return",
              }}
            />
            <Stack.Screen
              name="info/support"
              options={{
                title: "Support",
                headerBackTitle: "Return",
              }}
            />
            <Stack.Screen
              name="posts/[id]"
              options={{
                title: "Post",
                headerBackTitle: "Return",
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </PaperProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
