import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Tabs, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, TouchableWithoutFeedback, View } from 'react-native';
import { Button, List, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { unreadCount, signOut } = useAuth();
  const [isLogoutMenuVisible, setIsLogoutMenuVisible] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Use an explicit width + alignSelf center for a truly centered floating bar.
  const tabBarWidth = '90%';

  const handleLogout = async () => {
    setIsLogoutMenuVisible(false);
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const handleDonate = async () => {
    const url = 'https://donate.daulric.dev/';
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Cannot open donation URL');
    }
    setIsLogoutMenuVisible(false);
  };

  return (
    <>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: 'absolute',
            justifyContent: 'center',
            alignItems: 'center',
            left: 0,
            right: 0,
            marginHorizontal: '5%',
            bottom: Math.max(insets.bottom - 20, 12),
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
          },
          tabBarItemStyle: {
            borderRadius: 16,
            marginVertical: 8,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={28} name={focused ? 'home' : 'home-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={28} name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: 'Upload',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={28} name={focused ? 'add-circle' : 'add-circle-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={28} name={focused ? 'person' : 'person-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={28} name={focused ? 'menu' : 'menu-outline'} color={color} />
            ),
          }}
          listeners={{
            tabLongPress: (e) => {
              // e.preventDefault(); // Uncomment if we want to prevent navigating to the tab on long press
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setIsLogoutMenuVisible(true);
            },
          }}
        />
      </Tabs>

      {/* Logout Popup Menu */}
      <Modal
        visible={isLogoutMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLogoutMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsLogoutMenuVisible(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <TouchableWithoutFeedback>
              <Surface
                style={{
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 24,
                  backgroundColor: theme.colors.background,
                }}
                elevation={4}
              >
                <View className="items-center mb-6">
                  <View
                    style={{
                      width: 48,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: theme.colors.outlineVariant,
                    }}
                  />
                </View>
                
                <Text variant="titleLarge" style={{ textAlign: 'center', marginBottom: 4 }}>
                  Menu
                </Text>
                <Text variant="bodyMedium" style={{ textAlign: 'center', marginBottom: 16, color: theme.colors.onSurfaceVariant }}>
                  Select an action below
                </Text>

                <List.Section>
                  <List.Item
                    title="Donate"
                    description="Support development"
                    onPress={handleDonate}
                    left={() => (
                      <View style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="heart" size={22} color={theme.colors.primary} />
                      </View>
                    )}
                    right={() => <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />}
                  />
                  <List.Item
                    title="Log Out"
                    description="Sign out of your account"
                    onPress={handleLogout}
                    left={() => (
                      <View style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="log-out" size={22} color={theme.colors.error} />
                      </View>
                    )}
                    right={() => <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />}
                  />
                </List.Section>

                <Button
                  mode="contained-tonal"
                  onPress={() => setIsLogoutMenuVisible(false)}
                  style={{ marginTop: 8, borderRadius: 12 }}
                  contentStyle={{ paddingVertical: 6 }}
                  labelStyle={{ fontWeight: '600' }}
                >
                  Cancel
                </Button>
              </Surface>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
