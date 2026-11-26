import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, AppState, Linking, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import AuthScreen from './src/screens/AuthScreen';
import { parsePasswordRecoveryUrl } from './src/auth/passwordRecovery';
import { supabase } from './src/lib/supabase';
import HomeScreen from './src/screens/Home/HomeScreen';
import SyncStatusScreen from './src/screens/SyncStatusScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import TaskSessionHistoryScreen from './src/screens/TaskSessionHistoryScreen';
import CategoryManagementScreen from './src/screens/CategoryManagementScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { CategoryProvider } from './src/data/CategoryContext';
import { setCategoryRepositoryUser, setCategorySyncState, syncCategories } from './src/data/categoryRepository';
import {
  resumeTaskSync,
  setTaskRepositoryUser,
  setTaskSyncOnline,
  setTaskSyncSessionReady,
} from './src/data/taskRepository';
import { setTaskSessionRepositoryUser } from './src/repositories/localTaskSessionRepository';
import { setTaskSessionSyncOnline, syncTaskSessions } from './src/services/taskSessionSyncService';
import NetInfo from '@react-native-community/netinfo';
import { updateTaskSyncConnectivity } from './src/data/taskSyncStatus';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerNavContent } from './src/components/DrawerNavContent';
import { StatusBar } from 'expo-status-bar';
const Drawer = createDrawerNavigator();

function ThemeStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  const [session, setSession] = useState(undefined);
  const [passwordRecovery, setPasswordRecovery] = useState({
    active: false,
    loading: false,
    error: null,
  });
  const [initialLinkChecked, setInitialLinkChecked] = useState(false);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const applySession = (nextSession) => {
      const userId = nextSession?.user?.id ?? null;
      setTaskRepositoryUser(userId);
      setTaskSessionRepositoryUser(userId);
      setCategoryRepositoryUser(userId);
      setSession(nextSession);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active || (event === 'INITIAL_SESSION' && receivedChange)) return;
      if (event !== 'INITIAL_SESSION') receivedChange = true;
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery({ active: true, loading: false, error: null });
      }
      applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const openRecoveryLink = async (url) => {
      const recovery = parsePasswordRecoveryUrl(url);
      if (!recovery || !active) return;

      setPasswordRecovery({ active: true, loading: true, error: null });
      if (recovery.error) {
        setPasswordRecovery({ active: true, loading: false, error: recovery.error });
        return;
      }

      try {
        const result = recovery.code
          ? await supabase.auth.exchangeCodeForSession(recovery.code)
          : await supabase.auth.setSession({
              access_token: recovery.accessToken,
              refresh_token: recovery.refreshToken,
            });
        if (!active) return;
        if (result.error) throw result.error;
        setPasswordRecovery({ active: true, loading: false, error: null });
      } catch {
        if (active) {
          setPasswordRecovery({
            active: true,
            loading: false,
            error: 'Este link de recuperação é inválido ou já expirou.',
          });
        }
      }
    };

    Linking.getInitialURL()
      .then(openRecoveryLink)
      .catch(() => {})
      .finally(() => {
        if (active) setInitialLinkChecked(true);
      });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void openRecoveryLink(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const leavePasswordRecovery = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setPasswordRecovery({ active: false, loading: false, error: null });
    } catch {
      setPasswordRecovery({
        active: true,
        loading: false,
        error: 'Não foi possível terminar a recuperação. Fecha e volta a abrir a aplicação.',
      });
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    let active = true;
    let networkRevision = 0;
    let activityRevision = 0;
    let wasOnline = false;
    const applyNetwork = (state, source) => {
      updateTaskSyncConnectivity(state);
      const online = state.isConnected === true && state.isInternetReachable === true;
      setTaskSyncOnline(online, source, state);
      setTaskSessionSyncOnline(online);
      setCategorySyncState({ isOnline: online });
      const reconnected = online && !wasOnline;
      wasOnline = online;
      return reconnected;
    };
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!active) return;
      networkRevision += 1;
      if (applyNetwork(state, 'NetInfo')) {
        syncTaskSessions().catch((error) => {
          console.warn('[Sessions] Falha ao sincronizar na reconexão:', error);
        });
      }
    });

    const subscription = AppState.addEventListener('change', (state) => {
      const activity = ++activityRevision;
      if (state !== 'active') return;
      const revision = networkRevision;
      NetInfo.refresh().then((network) => {
        if (!active || activity !== activityRevision) return;
        if (revision === networkRevision) applyNetwork(network, 'Primeiro plano');
        // A listener may already have supplied newer connectivity during refresh.
        resumeTaskSync();
        syncTaskSessions().catch(() => {});
        void syncCategories();
      }).catch((error) => {
        if (active && activity === activityRevision) {
          resumeTaskSync();
          syncTaskSessions().catch(() => {});
          void syncCategories();
        }
        console.warn('[Sync] Não foi possível verificar a ligação:', error);
      });
    });

    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
      setTaskSyncOnline(false, 'Fim da subscrição');
      setTaskSessionSyncOnline(false);
      setCategorySyncState({ isOnline: false });
    };
  }, [session?.user?.id]);
  useEffect(() => {
    setTaskSyncSessionReady(Boolean(session?.user?.id && session?.access_token));
    setCategorySyncState({ isSessionReady: Boolean(session?.user?.id && session?.access_token) });
  }, [session?.user?.id, session?.access_token]);
  useEffect(() => {
    if (!session?.user?.id) return;

    syncTaskSessions().catch((error) => {
      console.warn('[Sessions] Falha na sincronização inicial:', error);
    });
  }, [session?.user?.id, session?.access_token]);

  if (!fontsLoaded || session === undefined || !initialLinkChecked) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator size="large" color={colors.selection} />
      </View>
    );
  }
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;

  const RootContainer = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <RootContainer style={{ flex: 1 }}>
      <SafeAreaProvider>
        {session && !passwordRecovery.active ? (
          <NavigationContainer
            key={session.user.id}
            theme={{
              ...navigationTheme,
              colors: {
                ...navigationTheme.colors,
                primary: colors.selection,
                background: colors.background,
                card: colors.surface,
                text: colors.text,
                border: colors.borderSoft,
                notification: colors.danger,
              },
            }}
          >
            <CategoryProvider><Drawer.Navigator
              drawerContent={(props) => <DrawerNavContent {...props} />}
              screenOptions={{
                headerShown: false,
                drawerPosition: 'left',
                drawerStyle: {
                  width: 300,
                  backgroundColor: colors.surface,
                },
                overlayColor: colors.backdrop,
              }}
            >
              <Drawer.Screen name="Home" component={HomeScreen} />
              <Drawer.Screen name="SyncStatus" component={SyncStatusScreen} />
              <Drawer.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Drawer.Screen name="TaskSessionHistory" component={TaskSessionHistoryScreen} />
              <Drawer.Screen name="Categories" component={CategoryManagementScreen} />
            </Drawer.Navigator></CategoryProvider>
          </NavigationContainer>
        ) : (
          <AuthScreen
            passwordRecovery={passwordRecovery}
            onPasswordRecoveryComplete={() => {
              setPasswordRecovery({ active: false, loading: false, error: null });
            }}
            onCancelPasswordRecovery={() => {
              void leavePasswordRecovery();
            }}
          />
        )}
      </SafeAreaProvider>
    </RootContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeStatusBar />
      <AppContent />
    </ThemeProvider>
  );
}
