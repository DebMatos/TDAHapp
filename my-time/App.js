import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from './src/screens/HomeScreen';
import TimelineSpike from './src/screens/TimelineSpike';

const Tab = createBottomTabNavigator();

// 1. Componente separado para poder ler as margens do ecrã
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#3A9BB7',
        tabBarInactiveTintColor: '#A0958E',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#FFFDF9',
          borderTopColor: '#EFE6E1',
          
       
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

// 2. O App Provider
export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFDF9' }}>
        <ActivityIndicator size="large" color="#4A90B2" />
      </View>
    );
  }

  const RootContainer = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <RootContainer style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <MainTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </RootContainer>
  );
}