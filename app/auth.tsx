import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput as RNTextInput,
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

type AuthStep = 'email' | 'otp';

export default function AuthScreen() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { sendOtp, verifyOtp, refreshProfile } = useAuth();
  const theme = useTheme();
  
  // Ref for hidden OTP input
  const otpInputRef = useRef<RNTextInput>(null);

  const handleSendOtp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await sendOtp(email);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('otp');
        // Focus the OTP input after transitioning
        setTimeout(() => otpInputRef.current?.focus(), 100);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (otpValue.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const { error } = await verifyOtp(email, otpValue);
      if (error) {
        Alert.alert('Verification Failed', error.message);
        // Clear the OTP on error
        setOtpValue('');
        otpInputRef.current?.focus();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshProfile();
        // Navigation will happen automatically via AuthContext
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpValue(digits);
  };

  const handleResendOtp = async () => {
    Haptics.selectionAsync();
    setLoading(true);
    try {
      const { error } = await sendOtp(email);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'A new verification code has been sent to your email');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    setStep('email');
    setOtpValue('');
  };

  const focusOtpInput = () => {
    otpInputRef.current?.focus();
  };

  // Split OTP value into 6 digits for display
  const otpDigits = otpValue.padEnd(6, ' ').split('').slice(0, 6);

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
              <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: theme.colors.onBackground }}>
                {step === 'email' ? 'Welcome' : 'Enter Code'}
              </Text>
              
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 20 }}>
                {step === 'email' 
                  ? 'Enter your email to receive a verification code'
                  : `We sent a 6-digit code to ${email}`}
              </Text>
            </View>

            {step === 'email' ? (
              /* Email Step */
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
                  autoFocus
                  left={<TextInput.Icon icon="email-outline" />}
                  style={{ backgroundColor: theme.colors.surface }}
                  onSubmitEditing={handleSendOtp}
                />

                <Button
                  mode="contained"
                  onPress={handleSendOtp}
                  loading={loading}
                  disabled={loading}
                  contentStyle={{ height: 48 }}
                  style={{ marginTop: 8, borderRadius: 8 }}
                  labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                >
                  Continue
                </Button>
              </View>
            ) : (
              /* OTP Step */
              <View className="space-y-4 gap-4">
                {/* Hidden input that actually receives text/paste */}
                <RNTextInput
                  ref={otpInputRef}
                  value={otpValue}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    height: 1,
                    width: 1,
                  }}
                />

                {/* Visual OTP boxes - tap to focus hidden input */}
                <Pressable onPress={focusOtpInput}>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    {otpDigits.map((digit, index) => {
                      const isFilled = digit.trim() !== '';
                      const isCurrent = index === otpValue.length;
                      
                      return (
                        <View
                          key={index}
                          style={{
                            width: 48,
                            height: 56,
                            borderWidth: 2,
                            borderColor: isCurrent 
                              ? theme.colors.primary 
                              : isFilled 
                                ? theme.colors.primary 
                                : theme.colors.outline,
                            borderRadius: 12,
                            backgroundColor: theme.colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: 'bold',
                              color: theme.colors.onSurface,
                            }}
                          >
                            {isFilled ? digit : ''}
                          </Text>
                          {/* Cursor indicator for current position */}
                          {isCurrent && (
                            <View
                              style={{
                                position: 'absolute',
                                width: 2,
                                height: 24,
                                backgroundColor: theme.colors.primary,
                              }}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </Pressable>

                {/* Tap to paste hint */}
                <Text 
                  variant="bodySmall" 
                  style={{ 
                    color: theme.colors.onSurfaceVariant, 
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  Tap the boxes above and paste your code
                </Text>

                <Button
                  mode="contained"
                  onPress={handleVerifyOtp}
                  loading={loading}
                  disabled={loading || otpValue.length !== 6}
                  contentStyle={{ height: 48 }}
                  style={{ marginTop: 16, borderRadius: 8 }}
                  labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                >
                  Verify
                </Button>

                {/* Resend & Back */}
                <View className="items-center mt-6 gap-4">
                  <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                    <Text 
                      variant="bodyMedium" 
                      style={{ color: theme.colors.primary, fontWeight: '600' }}
                    >
                      Didn't receive the code? Resend
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={handleBack} disabled={loading}>
                    <Text 
                      variant="bodyMedium" 
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      ← Use a different email
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
