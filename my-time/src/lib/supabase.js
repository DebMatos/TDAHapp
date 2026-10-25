import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Faltam as variáveis de ambiente do Supabase.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      ...(Platform.OS !== 'web'
        ? { storage: AsyncStorage }
        : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Track identity changes synchronously; normal token refreshes keep the marker.
let sessionUserId;
let sessionIdentityRevision = 0;
supabase.auth.onAuthStateChange((event, session) => {
  const userId = session?.user?.id ?? null;
  if (event === 'INITIAL_SESSION' && sessionUserId === undefined) {
    sessionUserId = userId;
    return;
  }
  if (userId !== sessionUserId) {
    sessionUserId = userId;
    sessionIdentityRevision += 1;
  }
});

export const getSessionIdentity = () => ({
  userId: sessionUserId,
  revision: sessionIdentityRevision,
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
