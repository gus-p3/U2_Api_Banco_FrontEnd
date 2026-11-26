import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/shared/theme';
import { AppHeader, HeaderPresentContext } from '@/shared/ui/AppHeader';

export default function TabsLayout() {
  const isWeb = Platform.OS === 'web';

  return (
    <HeaderPresentContext.Provider value={true}>
      <Tabs
        screenOptions={{
          headerShown: true,
          header: ({ options }) => (
            <AppHeader sectionTitle={typeof options.title === 'string' ? options.title : undefined} />
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: isWeb ? 4 : 2,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: isWeb ? 64 : 60,
            paddingTop: 6,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={String(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: 'Cuentas',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={String(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            title: 'Catálogo',
            href: null,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={String(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: 'Pagos',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'flash' : 'flash-outline'} size={size} color={String(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={String(color)} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={String(color)} />
            ),
          }}
        />
      </Tabs>
    </HeaderPresentContext.Provider>
  );
}
