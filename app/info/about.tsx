import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Divider, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const theme = useTheme();
  const appVersion = Constants.expoConfig?.version ?? '—';

  const handleOpen = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
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
              odrn
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, lineHeight: 20 }}>
              A lightweight social app built around sharing moments, chatting with friends, and staying connected.
            </Text>

            <View style={{ marginTop: 14 }}>
              <Divider />
            </View>

            <View style={{ marginTop: 14 }}>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                What you can do
              </Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text variant="bodyMedium">- Post photos with captions</Text>
                <Text variant="bodyMedium">- Message friends in real time</Text>
                <Text variant="bodyMedium">- Browse a feed and profiles</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={{ height: 14 }} />

        <Card mode="elevated" style={{ borderRadius: 20, backgroundColor: theme.colors.surface }}>
          <Card.Content>
            <Text variant="titleLarge" style={{ fontWeight: '800' }}>
              Owner
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 6, lineHeight: 20 }}>
              This app is owned and maintained by <Text style={{ fontWeight: '800' }}>Ulric</Text> (<Text style={{ fontWeight: '800' }}>daulric</Text>).
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, lineHeight: 20 }}>
              Thanks for using odrn—your feedback helps shape what we build next.
            </Text>

            <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
              <Button
                mode="contained"
                onPress={() => void handleOpen('https://donate.daulric.dev/')}
                style={{ borderRadius: 14 }}
              >
                Donate
              </Button>
              <Button
                mode="outlined"
                onPress={() => void handleOpen('https://daulric.dev/')}
                style={{ borderRadius: 14 }}
              >
                Website
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={{ height: 14 }} />

        <Card mode="elevated" style={{ borderRadius: 20, backgroundColor: theme.colors.surface }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              App info
            </Text>
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text variant="bodyMedium">
                <Text style={{ fontWeight: '700' }}>Version:</Text> {appVersion}
              </Text>
              <Text variant="bodyMedium">
                <Text style={{ fontWeight: '700' }}>Platform:</Text> {Constants.platform?.ios ? 'iOS' : Constants.platform?.android ? 'Android' : 'Unknown'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

