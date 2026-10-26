import 'react-native-gesture-handler';
import React, {
  useEffect,
  useState,
} from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/lib/supabase';
import HomeScreen from './src/screens/Home/HomeScreen';
import TimelineSpike from './src/screens/TimelineSpike';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { syncPendingTasks } from './src/data/taskRepository';
import NetInfo from '@react-native-community/netinfo';
import { updateTaskSyncConnectivity } from './src/data/taskSyncStatus';

const Tab = createBottomTabNavigator();

// 1. Componente separado para poder ler as margens do ecrã
function MainTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.selectionText,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          paddingBottom: Math.max(insets.bottom, 10) + (Platform.OS === 'ios' ? 0 : 8),
          paddingTop: 8,
          minHeight: 60 + Math.max(insets.bottom, 0),
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Timeline') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Backlog') {
            iconName = focused ? 'checkbox' : 'checkbox-outline';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Timeline" component={HomeScreen} />
      <Tab.Screen name="Backlog" component={TimelineSpike} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
  if (!session?.user?.id) return;

  const unsubscribe = NetInfo.addEventListener((state) => {
    updateTaskSyncConnectivity(state);
    if (state.isConnected === true &&
        state.isInternetReachable === true) {
      syncPendingTasks().catch((error) => {
        console.warn('[Sync] Falha ao recuperar ligação:', error);
      });
    }
  });

  return () => unsubscribe();
}, [session?.user?.id]);
  useEffect(() => {
  if (!session?.user?.id) return;

  syncPendingTasks()
    .then((count) => {
      console.log(`[Sync] ${count} operações sincronizadas`);
    })
    .catch((error) => {
      console.warn('[Sync] Falha na sincronização:', error);
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
        <ActivityIndicator
          size="large"
          color={colors.selection} />
      </View>
    );
  }
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;

  const RootContainer =
    Platform.OS === 'web'
      ? View
      : GestureHandlerRootView;

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
            <MainTabs />
          </NavigationContainer>
        ) : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </RootContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
