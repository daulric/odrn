import * as Linking from 'expo-linking';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAYPAL_ME_BASE = 'https://www.paypal.com/paypalme/daulrix';

type Preset = '5' | '10' | '20' | 'custom';

export default function SupportScreen() {
  const theme = useTheme();
  const [preset, setPreset] = useState<Preset>('5');
  const [customAmount, setCustomAmount] = useState('');
  const [opening, setOpening] = useState(false);

  const amount = useMemo(() => {
    if (preset === 'custom') {
      const cleaned = customAmount.replace(/[^\d.]/g, '');
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n <= 0) return null;
      // PayPal.me supports simple numeric amounts; keep 2 decimals max.
      return Number(n.toFixed(2));
    }
    return Number(preset);
  }, [preset, customAmount]);

  const donateUrl = useMemo(() => {
    // PayPal.me accepts /<amount> at the end for pre-filled amount.
    // If no amount is selected, just open the base page.
    return amount ? `${PAYPAL_ME_BASE}/${amount}` : PAYPAL_ME_BASE;
  }, [amount]);

  const handleDonate = async () => {
    setOpening(true);
    try {
      const supported = await Linking.canOpenURL(donateUrl);
      if (supported) {
        await Linking.openURL(donateUrl);
      } else {
        // Fallback to base URL
        await Linking.openURL(PAYPAL_ME_BASE);
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Card mode="elevated" style={{ borderRadius: 20, backgroundColor: theme.colors.surface }}>
          <Card.Content>
            <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
              Support odrn
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
              If you’re enjoying the app, you can support development with a small donation.
            </Text>

            <View style={{ marginTop: 16 }}>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                Choose an amount
              </Text>
              <View style={{ marginTop: 10 }}>
                <SegmentedButtons
                  value={preset}
                  onValueChange={(v) => setPreset(v as Preset)}
                  buttons={[
                    { value: '5', label: '$5' },
                    { value: '10', label: '$10' },
                    { value: '20', label: '$20' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              </View>

              {preset === 'custom' && (
                <TextInput
                  mode="outlined"
                  label="Custom amount (USD)"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 7.50"
                  style={{ marginTop: 12 }}
                />
              )}
            </View>

            <Button
              mode="contained"
              onPress={() => void handleDonate()}
              loading={opening}
              disabled={opening || (preset === 'custom' && !amount)}
              style={{ marginTop: 16, borderRadius: 14 }}
            >
              Donate via PayPal
            </Button>

            <Text variant="bodySmall" style={{ marginTop: 10, color: theme.colors.onSurfaceVariant }}>
              This opens PayPal: {PAYPAL_ME_BASE}
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

