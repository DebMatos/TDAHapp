import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from './src/screens/HomeScreen';
import TimelineSpike from './src/screens/TimelineSpike';

const Tab = createBottomTabNavigator();

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
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarActiveTintColor: '#3A9BB7',
              tabBarInactiveTintColor: '#A0958E',
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '600',
              },
              tabBarStyle: {
                backgroundColor: '#FFFDF9',
                borderTopColor: '#EFE6E1',
                height: Platform.OS === 'ios' ? 84 : 64,
                paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                paddingTop: 8,
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
        </NavigationContainer>
      </SafeAreaProvider>
    </RootContainer>
  );
}