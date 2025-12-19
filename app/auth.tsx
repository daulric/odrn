import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, refreshProfile } = useAuth();
  const theme = useTheme();

  const handleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          Alert.alert('Sign Up Error', error.message);
        } else {
          Alert.alert('Success', 'Account created! Please create your username.', [
            {
              text: 'OK',
              onPress: () => router.replace('/create-username'),
            },
          ]);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          Alert.alert('Sign In Error', error.message);
        } else {
          await refreshProfile();
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    Haptics.selectionAsync();
    setIsSignUp(!isSignUp);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 justify-center px-6 py-10">
            
            {/* Header */}
            <View className="items-center mb-10">
              <Image
                source={require('@/assets/icon/logo.svg')}
                style={{ width: 100, height: 100, borderRadius: 20, overflow: 'hidden' }}
                contentFit="cover"
              />
              <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 8, color: theme.colors.onBackground }}>
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </Text>
              
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                {isSignUp
                  ? 'Sign up to get started with your new account'
                  : 'Sign in to continue'}
              </Text>
            </View>

            {/* Form */}
            <View className="space-y-4 gap-4">
              <TextInput
                mode="outlined"
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                left={<TextInput.Icon icon="email-outline" />}
                style={{ backgroundColor: theme.colors.surface }}
              />

              <TextInput
                mode="outlined"
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon 
                    icon={showPassword ? 'eye-off' : 'eye'} 
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                style={{ backgroundColor: theme.colors.surface }}
              />

              {!isSignUp && (
                <View className="flex-row justify-end">
                  <TouchableOpacity onPress={() => {/* Handle forgot password */}}>
                    <Text 
                      variant="bodyMedium" 
                      style={{ color: theme.colors.primary, fontWeight: '600' }}
                    >
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Button
                mode="contained"
                onPress={handleAuth}
                loading={loading}
                disabled={loading}
                contentStyle={{ height: 48 }}
                style={{ marginTop: 8, borderRadius: 8 }}
                labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
            </View>

            {/* Footer */}
            <View className="flex-row justify-center mt-8 items-center">
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={toggleAuthMode}>
                <Text 
                  variant="bodyMedium" 
                  style={{ color: theme.colors.primary, fontWeight: 'bold' }}
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}