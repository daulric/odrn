import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Tabs, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { unreadCount, signOut } = useAuth();
  const [isLogoutMenuVisible, setIsLogoutMenuVisible] = useState(false);

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
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
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
              <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6 shadow-lg">
                <View className="items-center mb-6">
                  <View className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </View>
                
                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                  Menu
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 mb-8 text-center">
                  Select an action below
                </Text>

                <TouchableOpacity
                  onPress={handleDonate}
                  className="flex-row items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl mb-3 active:bg-green-100 dark:active:bg-green-900/30"
                >
                  <View className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 items-center justify-center mr-4">
                    <Ionicons name="heart" size={22} color="#16a34a" />
                  </View>
                  <Text className="text-lg font-semibold text-green-700 dark:text-green-400 flex-1">
                    Donate
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#16a34a" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogout}
                  className="flex-row items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl mb-4 active:bg-red-100 dark:active:bg-red-900/30"
                >
                  <View className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 items-center justify-center mr-4">
                    <Ionicons name="log-out" size={22} color="#ef4444" />
                  </View>
                  <Text className="text-lg font-semibold text-red-600 dark:text-red-400 flex-1">
                    Log Out
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#ef4444" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsLogoutMenuVisible(false)}
                  className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl items-center active:bg-gray-200 dark:active:bg-gray-700"
                >
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
