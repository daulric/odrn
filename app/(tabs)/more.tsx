import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MoreScreen() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/auth');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to log out');
    } finally {
      setLoading(false);
    }
  };

  const MenuOption = ({ 
    icon, 
    label, 
    onPress, 
    color = '#4b5563', 
    textColor = 'text-gray-900 dark:text-white',
    isLoading = false 
  }: { 
    icon: string, 
    label: string, 
    onPress?: () => void, 
    color?: string, 
    textColor?: string,
    isLoading?: boolean
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      className={`flex-row items-center w-full bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mb-3 ${isLoading ? 'opacity-60' : ''}`}
      activeOpacity={0.7}
    >
      <View className={`w-10 h-10 rounded-full ${color === '#ef4444' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-700'} items-center justify-center mr-4`}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      
      {isLoading ? (
         <ActivityIndicator color={color} className="flex-1 items-start" />
      ) : (
        <Text className={`flex-1 text-lg font-medium ${textColor}`}>
          {label}
        </Text>
      )}
      
      {!isLoading && <Ionicons name="chevron-forward" size={20} color="#9ca3af" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-5 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">
          More
        </Text>
      </View>

      <ScrollView className="flex-1 p-5">
        <Text className="text-gray-500 dark:text-gray-400 font-medium mb-4 ml-1 uppercase text-xs">
          General
        </Text>
        
        <MenuOption 
          icon="settings-outline" 
          label="Settings" 
        />
        <MenuOption 
          icon="notifications-outline" 
          label="Notifications" 
        />
        <MenuOption 
          icon="shield-checkmark-outline" 
          label="Privacy & Security" 
        />

        <Text className="text-gray-500 dark:text-gray-400 font-medium mb-4 mt-4 ml-1 uppercase text-xs">
          Support
        </Text>

        <MenuOption 
          icon="help-circle-outline" 
          label="Help & Support" 
        />
        <MenuOption 
          icon="information-circle-outline" 
          label="About" 
        />

        <View className="mt-8">
          <MenuOption 
            icon="log-out-outline" 
            label="Log out" 
            color="#ef4444"
            textColor="text-red-500"
            onPress={handleLogout}
            isLoading={loading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

