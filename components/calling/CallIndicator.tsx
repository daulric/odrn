import { useCall } from '@/contexts/CallContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function CallIndicator() {
  const { activeCall } = useCall();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState('00:00');

  // Don't show indicator if we're already on the call screen
  const isOnCallScreen = segments[0] === 'call';

  console.log("CallIndicator state:", { activeCall, isOnCallScreen, segments });

  useEffect(() => {
    if (!activeCall) return;

    const updateElapsed = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - activeCall.startedAt.getTime()) / 1000);
      const mins = Math.floor(diff / 60).toString().padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${mins}:${secs}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  if (!activeCall || isOnCallScreen) return null;

  return (
    <Pressable
      onPress={() => router.push(`/call/${activeCall.id}`)}
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 9999,
        backgroundColor: '#22c55e',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="call" size={18} color="white" />
        </View>
        <View>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
            Return to call
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
            with {activeCall.remoteName}
          </Text>
        </View>
      </View>
      <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
        {elapsed}
      </Text>
    </Pressable>
  );
}

