import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'

import { HomeScreen }    from './src/screens/HomeScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { FriendsScreen } from './src/screens/FriendsScreen'
import { Logo }          from './src/components/Logo'
import { theme }         from './src/lib/theme'
import { connect }       from './src/lib/relay'
import { loadOrCreateIdentity } from './src/lib/identity'

const Tab = createBottomTabNavigator()

export default function App() {
  useEffect(() => {
    loadOrCreateIdentity()
    connect()
  }, [])

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#000000" />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: '#1a3a1a',
            borderTopWidth: 1,
          },
          tabBarActiveTintColor:   '#00ff41',
          tabBarInactiveTintColor: '#666',
          tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
          headerStyle:      { backgroundColor: '#000000', borderBottomColor: '#1a3a1a', borderBottomWidth: 1 },
          headerTintColor:  '#00ff41',
          headerTitleStyle: { fontFamily: 'monospace', letterSpacing: 2 },
          headerLeft: () => <Logo size={32} style={{ marginLeft: 12 }} />,
        }}
      >
        <Tab.Screen
          name="Feed"
          component={HomeScreen}
          options={{
            title: 'VIBEPORT',
            tabBarLabel: 'Feed',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📡</Text>,
          }}
        />
        <Tab.Screen
          name="Friends"
          component={FriendsScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚡</Text>,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◈</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}
