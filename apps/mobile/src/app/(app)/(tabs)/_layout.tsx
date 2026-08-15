import { Tabs } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        tabBarStyle: {
          minHeight: 62,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="hosting" options={{ title: 'Hospedagens' }} />
      <Tabs.Screen name="pets" options={{ title: 'Pets' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
