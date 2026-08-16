import { type SFSymbol, SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { colors } from '@/theme/tokens';

type TabIconProps = {
  name: SFSymbol;
  fallback: string;
  color: string;
  size: number;
  focused: boolean;
};

function TabIcon({ name, fallback, color, size, focused }: TabIconProps) {
  return (
    <SymbolView
      fallback={
        <Text
          accessibilityElementsHidden
          style={{ color, fontSize: Math.max(size - 2, 18), lineHeight: size }}>
          {fallback}
        </Text>
      }
      name={name}
      size={size}
      style={{ width: size, height: size }}
      tintColor={color}
      weight={focused ? 'semibold' : 'regular'}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarItemStyle: { minWidth: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
        tabBarStyle: {
          minHeight: 62,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon color={color} fallback="⌂" focused={focused} name="house.fill" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="hosting"
        options={{
          title: 'Hospedagens',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon color={color} fallback="▣" focused={focused} name="calendar" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: 'Pets',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon color={color} fallback="●" focused={focused} name="pawprint.fill" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              color={color}
              fallback="◉"
              focused={focused}
              name="person.crop.circle.fill"
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
