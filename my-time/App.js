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
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/lib/supabase';
import HomeScreen from './src/screens/HomeScreen';
import TimelineSpike from './src/screens/TimelineSpike';
import colors from './src/theme/colors';

const Tab = createBottomTabNavigator();

// 1. Componente separado para poder ler as margens do ecrã
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.selectionText, // #6F765D ou cores.selection (#8A9273)
        tabBarInactiveTintColor: colors.textFaint,    // #AAA19B
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,


          paddingBottom: Math.max(insets.bottom, 10) + (Platform.OS === 'ios' ? 0 : 8),
          paddingTop: 8,
          // Definimos uma altura mínima para garantir que o conteúdo cabe sempre
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

export default function App() {
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

  const RootContainer =
    Platform.OS === 'web'
      ? View
      : GestureHandlerRootView;

  return (
    <RootContainer style={{ flex: 1 }}>
      <SafeAreaProvider>
        {session ? (
          <NavigationContainer>
            <MainTabs />
          </NavigationContainer>
        ) : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
    </RootContainer>
  );
}