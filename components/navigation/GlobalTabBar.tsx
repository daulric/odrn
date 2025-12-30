import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useSegments } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabItem = {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const tabs: TabItem[] = [
  { name: 'Home', route: '/(tabs)', icon: 'home-outline', iconFocused: 'home' },
  { name: 'Messages', route: '/(tabs)/messages', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  { name: 'Upload', route: '/(tabs)/upload', icon: 'add-circle-outline', iconFocused: 'add-circle' },
  { name: 'Profile', route: '/(tabs)/profile', icon: 'person-outline', iconFocused: 'person' },
  { name: 'More', route: '/(tabs)/more', icon: 'menu-outline', iconFocused: 'menu' },
];

// Screens where the tab bar should be hidden
const HIDDEN_SCREENS = ['auth', 'create-username', 'updates-screen', 'call', 'index'];

export function GlobalTabBar() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { unreadCount } = useAuth();

  const currentSegment = String(segments[0] ?? '');
  const currentSubSegment = String(segments[1] ?? '');

  // Don't show tab bar if not authenticated or on certain screens
  if (!session || !profile) return null;
  if (HIDDEN_SCREENS.includes(currentSegment)) return null;

  // Determine which tab is active
  const getActiveTab = () => {
    if (currentSegment !== '(tabs)') return -1;
    
    switch (currentSubSegment) {
      case 'index':
      case '':
        return 0;
      case 'messages':
        return 1;
      case 'upload':
        return 2;
      case 'profile':
        return 3;
      case 'more':
        return 4;
      default:
        return 0;
    }
  };

  const activeIndex = getActiveTab();

  const handlePress = (index: number, route: string) => {
    void Haptics.selectionAsync();
    router.push(route as any);
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom - 20, 12),
        left: 0,
        right: 0,
        paddingHorizontal: '5%',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: 60,
          borderRadius: 32,
          backgroundColor: (theme.colors as any).elevation?.level2 ?? theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          paddingHorizontal: 10,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex;
          const iconName = isActive ? tab.iconFocused : tab.icon;
          const color = isActive ? theme.colors.primary : theme.colors.onSurfaceVariant;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => handlePress(index, tab.route)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
              }}
              activeOpacity={0.7}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons name={iconName} size={28} color={color} />
                {tab.name === 'Messages' && unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      backgroundColor: theme.colors.error,
                      borderRadius: 10,
                      minWidth: 18,
                      height: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

