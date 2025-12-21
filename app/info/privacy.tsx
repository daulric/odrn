import React from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Divider, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const theme = useTheme();

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
              Privacy
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
              We respect your privacy. This page explains what data odrn may collect and how it’s used.
            </Text>

            <View style={{ marginTop: 14 }}>
              <Divider />
            </View>

            <View style={{ marginTop: 14, gap: 10 }}>
              <View style={{ gap: 6 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                  Data you provide
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                  Account info (like your email/username), posts you upload, and messages you send.
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                  How it’s used
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                  To operate the app features: authentication, displaying your profile, delivering messages, and showing your
                  posts in feeds.
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                  Sharing
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                  Your posts and profile information are shared with other users according to your app experience (for example,
                  posts shown in feeds). We do not sell personal data.
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                  Contact
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}>
                  For privacy questions, contact the owner: Ulric (daulric).
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

