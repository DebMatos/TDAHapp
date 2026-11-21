import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, AppState, Platform} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/lib/supabase';
import HomeScreen from './src/screens/Home/HomeScreen';
import SyncStatusScreen from './src/screens/SyncStatusScreen';
import TaskSessionHistoryScreen from './src/screens/TaskSessionHistoryScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { resumeTaskSync, setTaskSyncOnline, setTaskSyncSessionReady } from './src/data/taskRepository';
import { syncTaskSessions } from './src/services/taskSessionSyncService';
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    let active = true;
    let networkRevision = 0;
    let activityRevision = 0;
    const applyNetwork = (state, source) => {
      updateTaskSyncConnectivity(state);
      const online = state.isConnected === true && state.isInternetReachable === true;
      setTaskSyncOnline(online, source, state);
      return online;
    };
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!active) return;
      networkRevision += 1;
      const online = applyNetwork(state, 'NetInfo');
      if (online) {
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
      }).catch((error) => {
        if (active && activity === activityRevision) resumeTaskSync();
        console.warn('[Sync] Não foi possível verificar a ligação:', error);
      });
    });

    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
      setTaskSyncOnline(false, 'Fim da subscrição');
    };
  }, [session?.user?.id]);
  useEffect(() => {
    setTaskSyncSessionReady(Boolean(session?.user?.id && session?.access_token));
  }, [session?.user?.id, session?.access_token]);
  useEffect(() => {
    if (!session?.user?.id) return;

    syncTaskSessions().catch((error) => {
      console.warn('[Sessions] Falha na sincronização inicial:', error);
    });
  }, [session?.user?.id]);

  if (!fontsLoaded || session === undefined) {
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
        {session ? (
          <NavigationContainer
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
            <Drawer.Navigator
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
              <Drawer.Screen name="TaskSessionHistory" component={TaskSessionHistoryScreen} />
            </Drawer.Navigator>
          </NavigationContainer>
        ) : (
          <AuthScreen />
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
