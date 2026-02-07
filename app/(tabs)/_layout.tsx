import { Text, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '../../constants/theme';

function TabIcon({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 16,
        fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
        color: colors.teal,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: () => <TabIcon label=">_" />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: () => <TabIcon label="$#" />,
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          title: 'Skills',
          tabBarIcon: () => <TabIcon label="</>" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <TabIcon label="@" />,
        }}
      />
    </Tabs>
  );
}
