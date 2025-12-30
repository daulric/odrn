import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';
import { acceptCall, cancelCall, declineCall, endCall, getCall, sendSignal, subscribeToCall, subscribeToSignals } from '@/lib/calling/signaling';
import type { CallRow, CallSignalRow } from '@/lib/calling/types';
import { WebRTCCallSession } from '@/lib/calling/webrtc';
import { getGravatarUrl } from '@/lib/getUserProfile';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { ActivityIndicator, Avatar, IconButton, SegmentedButtons, Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

type CallMode = 'incoming' | 'outgoing' | 'active';
type PanelTab = 'controls' | 'info';
type RemoteProfile = { id: string; username: string | null; avatar: string | null; email: string | null };

function withAlpha(color: string, alpha: number) {
  const hex = color.replace('#', '');
  const a = Math.max(0, Math.min(1, alpha));

  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  return color;
}

function isOfferLike(type: string) {
  return type === 'offer' || type === 'renegotiate';
}

export default function CallScreen() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const { setActiveCall, clearActiveCall } = useCall();
  const theme = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [call, setCall] = useState<CallRow | null>(null);
  const [mode, setMode] = useState<CallMode>('active');

  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [connectionState, setConnectionState] = useState<string>('new');

  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('controls');
  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(null);

  const pendingSignalsRef = useRef<CallSignalRow[]>([]);
  const sessionRef = useRef<WebRTCCallSession | null>(null);
  const isExpoGo = (Constants as any).appOwnership === 'expo';

  const RTCViewComponent = useMemo(() => {
    if (isExpoGo) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('react-native-webrtc').RTCView as any;
    } catch {
      return null;
    }
  }, [isExpoGo]);

  const localUserId = user?.id ?? null;
  const remoteUserId = useMemo(() => {
    if (!call || !localUserId) return null;
    return call.caller_id === localUserId ? call.callee_id : call.caller_id;
  }, [call, localUserId]);

  const isCaller = useMemo(() => {
    if (!call || !localUserId) return false;
    return call.caller_id === localUserId;
  }, [call, localUserId]);

  // Fetch the other user's profile for display (name/avatar)
  useEffect(() => {
    if (isExpoGo) return;
    if (!remoteUserId) {
      setRemoteProfile(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar, email')
          .eq('id', remoteUserId)
          .single();
        if (cancelled) return;
        if (error) throw error;
        setRemoteProfile(data as any);
      } catch (e) {
        console.error('Failed to load remote profile:', e);
        if (!cancelled) setRemoteProfile({ id: remoteUserId, username: null, avatar: null, email: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteUserId, isExpoGo]);

  useEffect(() => {
    if (!callId || !user) return;
    if (isExpoGo) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const c = await getCall(callId);
        if (cancelled) return;
        setCall(c);
        setMode(c.status === 'ringing' ? (c.callee_id === user.id ? 'incoming' : 'outgoing') : 'active');
      } catch (e) {
        console.error('Error loading call:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callId, user?.id]);

  // Subscribe to call state changes
  useEffect(() => {
    if (!callId) return;
    if (isExpoGo) return;
    const unsubscribe = subscribeToCall({
      callId,
      onUpdate: (c) => {
        setCall(c);
        if (c.status === 'ringing') {
          setMode(c.callee_id === user?.id ? 'incoming' : 'outgoing');
        } else {
          setMode('active');
        }
        if (c.status === 'declined' || c.status === 'cancelled' || c.status === 'missed' || c.status === 'ended') {
          // Close screen shortly after terminal state
          setTimeout(() => {
            router.back();
          }, 250);
        }
      },
    });
    return unsubscribe;
  }, [callId, router, user?.id]);

  // Subscribe to signaling
  useEffect(() => {
    if (!callId || !user) return;
    if (!remoteUserId) return;
    if (isExpoGo) return;

    const unsubscribe = subscribeToSignals({
      callId,
      onSignal: (signal) => {
        // Ignore our own signals
        if (signal.sender_id === user.id) return;

        // If we haven't accepted an incoming call yet, queue signaling until accept.
        if (mode === 'incoming' && call?.status === 'ringing') {
          pendingSignalsRef.current.push(signal);
          return;
        }

        void sessionRef.current?.handleRemoteSignal(signal.type, signal.payload);
      },
    });

    return unsubscribe;
  }, [callId, user?.id, remoteUserId, mode, call?.status]);

  // Create session (once call + user are available)
  useEffect(() => {
    if (!callId || !localUserId || !remoteUserId) return;
    if (sessionRef.current) return;
    if (isExpoGo) return;

    sessionRef.current = new WebRTCCallSession({
      callId,
      localUserId,
      remoteUserId,
      isCaller,
      sendSignal: async (type, payload) => {
        await sendSignal({
          callId,
          senderId: localUserId,
          recipientId: remoteUserId,
          type,
          payload,
        });
      },
      onLocalStream: (s) => setLocalStream(s),
      onRemoteStream: (s) => setRemoteStream(s),
      onConnectionStateChange: (s) => setConnectionState(s),
      onError: (e) => console.error('WebRTC error:', e),
    });
  }, [callId, localUserId, remoteUserId, isCaller]);

  // Outgoing call: start immediately (audio-first)
  useEffect(() => {
    if (!call || !user || !sessionRef.current) return;
    if (mode !== 'outgoing') return;
    if (isExpoGo) return;

    void sessionRef.current.start({ withVideo: false });
  }, [mode, call?.id, user?.id]);

  const handleAccept = async () => {
    if (!callId || !sessionRef.current) return;
    try {
      await acceptCall(callId);

      // Process queued signals (offer first if present, then ICE, etc.)
      const queued = pendingSignalsRef.current;
      pendingSignalsRef.current = [];

      const offerLike = queued.find((s) => isOfferLike(s.type));
      if (offerLike) {
        await sessionRef.current.handleRemoteSignal(offerLike.type, offerLike.payload);
      }

      for (const s of queued) {
        if (offerLike && s.id === offerLike.id) continue;
        await sessionRef.current.handleRemoteSignal(s.type, s.payload);
      }

      setMode('active');
    } catch (e) {
      console.error('Accept call failed:', e);
    }
  };

  const handleDecline = async () => {
    if (!callId) return;
    try {
      await declineCall(callId);
    } catch (e) {
      console.error('Decline call failed:', e);
    } finally {
      router.back();
    }
  };

  const handleHangup = async () => {
    if (!callId) return;
    try {
      if (mode === 'outgoing' && call?.status === 'ringing') {
        await cancelCall(callId);
      } else if (mode === 'incoming' && call?.status === 'ringing') {
        await declineCall(callId);
      } else {
        await endCall(callId);
      }

      // best-effort notify peer
      if (localUserId && remoteUserId) {
        await sendSignal({
          callId,
          senderId: localUserId,
          recipientId: remoteUserId,
          type: 'hangup',
          payload: { reason: 'local_hangup' },
        });
      }
    } catch (e) {
      console.error('Hangup failed:', e);
    } finally {
      await sessionRef.current?.hangup();
      router.back();
    }
  };

  const toggleMic = async () => {
    const next = !micEnabled;
    setMicEnabled(next);
    await sessionRef.current?.setMicEnabled(next);
  };

  const toggleVideo = async () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    await sessionRef.current?.setVideoEnabled(next);
  };

  const toggleSpeaker = async () => {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    try {
      InCallManager.setSpeakerphoneOn(next);
    } catch (e) {
      console.error('Failed to toggle speaker:', e);
    }
  };

  const remoteUrl = remoteStream?.toURL?.() ?? null;
  const localUrl = localStream?.toURL?.() ?? null;

  // Track active call globally (for floating indicator when navigating away)
  useEffect(() => {
    console.log("Call state check:", { mode, status: call?.status, callId, remoteUserId });
    if (mode === 'active' && call?.status === 'accepted' && callId && remoteUserId) {
      const remoteName = remoteProfile?.username || 'Call';
      console.log("Setting active call:", { callId, remoteUserId, remoteName });
      setActiveCall({
        id: callId,
        remoteUserId,
        remoteName,
        startedAt: call.accepted_at ? new Date(call.accepted_at) : new Date(),
      });
    } else if (call?.status && ['declined', 'cancelled', 'missed', 'ended'].includes(call.status)) {
      // Clear if call reached terminal state
      console.log("Clearing active call - terminal state");
      clearActiveCall();
    }
  }, [mode, call?.status, call?.accepted_at, callId, remoteUserId, remoteProfile?.username, setActiveCall, clearActiveCall]);

  // Note: We do NOT clear active call on unmount because the user might navigate
  // away while still on a call. The active call is only cleared when the call
  // reaches a terminal state (ended, declined, cancelled, missed).

  // Manage in-call audio routing/lifecycle
  useEffect(() => {
    if (isExpoGo) return;
    // Start audio session when the call screen is shown; stop on leave.
    try {
      InCallManager.start({ media: 'audio' });
    } catch (e) {
      console.error('InCallManager start failed:', e);
    }

    return () => {
      try {
        InCallManager.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  // Keep speaker routing in sync without restarting the in-call session.
  useEffect(() => {
    if (isExpoGo) return;
    try {
      InCallManager.setSpeakerphoneOn(speakerEnabled);
    } catch (e) {
      console.error('Failed to set speaker state:', e);
    }
  }, [speakerEnabled, isExpoGo]);

  // Show notification when app goes to background during active call
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (isExpoGo) return;
    if (!callId || call?.status !== 'accepted') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App going to background while on active call
      if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        try {
          const Notifications = await import('expo-notifications');
          if (Notifications?.scheduleNotificationAsync) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '📞 Call in progress',
                body: `You're still on a call with ${remoteProfile?.username || 'someone'}. Tap to return.`,
                data: { type: 'active_call', callId },
                sound: false,
                categoryIdentifier: 'active_call',
              },
              trigger: null, // Show immediately
            });
          }
        } catch (e) {
          console.error('Failed to show call notification:', e);
        }
      }
      
      // App returning to foreground - dismiss the notification
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        try {
          const Notifications = await import('expo-notifications');
          if (Notifications?.dismissAllNotificationsAsync) {
            await Notifications.dismissAllNotificationsAsync();
          }
        } catch {
          // ignore
        }
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [callId, call?.status, remoteProfile?.username, isExpoGo]);

  // End call when WebRTC connection fails (e.g., other party's app was killed)
  useEffect(() => {
    if (!callId || !call || call.status !== 'accepted') return;

    // WebRTC connection states that indicate the peer is gone
    const terminalStates = ['disconnected', 'failed', 'closed'];
    
    if (terminalStates.includes(connectionState)) {
      console.log(`WebRTC connection ${connectionState}, ending call...`);
      
      // Give a short grace period for reconnection (5 seconds)
      const timeout = setTimeout(async () => {
        // Re-check if still disconnected
        if (terminalStates.includes(connectionState)) {
          try {
            await endCall(callId);
            clearActiveCall();
            router.replace('/(tabs)');
          } catch (e) {
            console.error('Failed to end call after disconnection:', e);
          }
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [connectionState, callId, call?.status, clearActiveCall, router]);

  const statusLabel =
    mode === 'incoming'
      ? 'Incoming call'
      : mode === 'outgoing'
        ? 'Calling…'
        : call?.status === 'accepted'
          ? 'In call'
          : 'Connecting…';

  const outlineVariant = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const elevationLevel2 = (theme.colors as any).elevation?.level2 ?? theme.colors.surface;
  const elevationLevel3 = (theme.colors as any).elevation?.level3 ?? (theme.colors as any).surfaceVariant ?? theme.colors.surface;
  const overlayBg = withAlpha(elevationLevel2, theme.dark ? 0.72 : 0.95);
  const overlayBgStrong = withAlpha(elevationLevel3, theme.dark ? 0.78 : 0.98);
  const overlayBorder = withAlpha(outlineVariant, theme.dark ? 0.35 : 0.55);
  const overlayPillBg = withAlpha((theme.colors as any).surfaceVariant ?? theme.colors.surface, theme.dark ? 0.35 : 0.92);

  const displayName = remoteProfile?.username || 'Friend';
  const avatarUri =
    remoteProfile?.avatar ||
    (remoteProfile?.email || remoteProfile?.username ? getGravatarUrl(remoteProfile.email || remoteProfile.username || '') : null);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Call',
          headerBackTitle: 'Return',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
        {isExpoGo ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text variant="titleMedium" style={{ textAlign: 'center' }}>
              Calling requires a development build
            </Text>
            <Text style={{ textAlign: 'center', marginTop: 8, color: theme.colors.onSurfaceVariant }}>
              Expo Go does not include WebRTC native modules. Run with `npx expo run:ios` or `npx expo run:android`.
            </Text>
            <View style={{ height: 16 }} />
            <IconButton icon="arrow-left" mode="contained-tonal" onPress={() => router.back()} />
          </View>
        ) : loading || !call ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>Loading call…</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Video stage */}
            <View style={{ flex: 1, backgroundColor: 'black' }}>
              {remoteUrl && RTCViewComponent ? (
                <RTCViewComponent streamURL={remoteUrl} style={{ flex: 1 }} objectFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{statusLabel}</Text>
                  <Text style={{ color: '#bbb', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
                    Status: {String(call.status).charAt(0).toUpperCase() + String(call.status).slice(1)}
                  </Text>
                </View>
              )}

              {/* Local preview */}
              {localUrl && videoEnabled && RTCViewComponent ? (
                <Surface
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: 108,
                    width: 120,
                    height: 170,
                    borderRadius: 18,
                    overflow: 'hidden',
                    backgroundColor: '#111',
                    borderWidth: 1,
                    borderColor: withAlpha(outlineVariant, 0.5),
                  }}
                  elevation={5}
                >
                  <RTCViewComponent streamURL={localUrl} style={{ flex: 1 }} objectFit="cover" />
                </Surface>
              ) : null}

              {/* Floating top pill with segmented tabs */}
              <View style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
                <Surface
                  style={{
                    borderRadius: 18,
                    padding: 10,
                    backgroundColor: overlayBg,
                    borderWidth: 1,
                    borderColor: overlayBorder,
                  }}
                  elevation={5}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <IconButton
                      icon="arrow-left"
                      size={20}
                      onPress={() => router.back()}
                      iconColor={theme.colors.onSurface}
                      style={{ margin: 0 }}
                    />
                    {avatarUri ? (
                      <Avatar.Image size={34} source={{ uri: avatarUri }} style={{ backgroundColor: 'transparent' }} />
                    ) : (
                      <Avatar.Text size={34} label={String(displayName || 'F').slice(0, 1).toUpperCase()} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                        {displayName}
                      </Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                        {statusLabel} • {call.status} • {connectionState}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <SegmentedButtons
                      value={activeTab}
                      onValueChange={(v) => setActiveTab(v as PanelTab)}
                      buttons={[
                        { value: 'controls', label: 'Controls', icon: 'tune' },
                        { value: 'info', label: 'Info', icon: 'information-outline' },
                      ]}
                      style={{ backgroundColor: overlayPillBg, borderRadius: 14 }}
                    />
                  </View>
                </Surface>
              </View>

              {/* Floating bottom dock */}
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: 14 }}>
                <Surface
                  style={{
                    borderRadius: 22,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    backgroundColor: overlayBgStrong,
                    borderWidth: 1,
                    borderColor: overlayBorder,
                  }}
                  elevation={5}
                >
                  {mode === 'incoming' && call.status === 'ringing' ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <IconButton icon="phone-hangup" mode="contained" iconColor="white" containerColor={theme.colors.error} onPress={handleDecline} />
                      <IconButton icon="phone" mode="contained" iconColor="white" containerColor={theme.colors.primary} onPress={handleAccept} />
                    </View>
                  ) : activeTab === 'controls' ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <IconButton
                        icon={micEnabled ? 'microphone' : 'microphone-off'}
                        mode="contained-tonal"
                        onPress={toggleMic}
                        accessibilityLabel="Toggle microphone"
                      />
                      <IconButton
                        icon={speakerEnabled ? 'volume-high' : 'volume-medium'}
                        mode="contained-tonal"
                        onPress={toggleSpeaker}
                        accessibilityLabel="Toggle speaker"
                      />
                      <IconButton
                        icon={videoEnabled ? 'video' : 'video-off'}
                        mode="contained-tonal"
                        onPress={toggleVideo}
                        accessibilityLabel="Toggle video"
                      />
                      <IconButton
                        icon="phone-hangup"
                        mode="contained"
                        iconColor="white"
                        containerColor={theme.colors.error}
                        onPress={handleHangup}
                        accessibilityLabel="Hang up"
                      />
                    </View>
                  ) : (
                    <View style={{ paddingHorizontal: 6 }}>
                      <Text style={{ color: theme.colors.onSurface, fontWeight: '700' }}>Call details</Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, fontSize: 12 }}>
                        With: {displayName}
                      </Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, fontSize: 12 }}>
                        Call ID: {call.id}
                      </Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, fontSize: 12 }}>
                        Role: {isCaller ? 'Caller' : 'Callee'}
                      </Text>
                      <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, fontSize: 12 }}>
                        Media: audio{videoEnabled ? ' + video' : ''}
                      </Text>
                    </View>
                  )}
                </Surface>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}


