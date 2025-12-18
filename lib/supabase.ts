import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';
import type { Database } from './database.types';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

let supabaseClient: SupabaseClient<Database, 'ordn'> | null = null;

function createSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Check if we're in a Node.js environment (SSR) where window/AsyncStorage won't work
  const isServer = typeof window === 'undefined' && typeof global !== 'undefined' && typeof process !== 'undefined' && process.versions?.node;

  let storage: any = undefined;
  
  if (!isServer) {
    // Only import AsyncStorage on client side (React Native or browser)
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      storage = AsyncStorage;
    } catch (e) {
      // AsyncStorage not available, continue without it
      console.warn('AsyncStorage not available, session persistence disabled');
    }
  }

  const authConfig: any = {
    autoRefreshToken: true,
    persistSession: !!storage,
    detectSessionInUrl: false,
  };

  if (storage) {
    authConfig.storage = storage;
  }

  supabaseClient = createClient<Database, 'ordn'>(supabaseUrl, supabaseAnonKey, {
    auth: authConfig,
    db: {
      schema: 'ordn',
    },
  } as any);

  return supabaseClient;
}

export const supabase = createSupabaseClient();

