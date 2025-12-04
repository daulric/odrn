import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return null; // Layout handles the spinner
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  if (!profile || !profile.username) {
    return <Redirect href="/create-username" />;
  }

  return <Redirect href="/(tabs)" />;
}
