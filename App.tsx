import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Circle } from 'react-native-svg';

import { AppProvider, useApp } from './src/AppContext';
import { TodayScreen } from './src/screens/TodayScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { DayDetailScreen } from './src/screens/DayDetailScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { CycleDetailScreen } from './src/screens/CycleDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { LockScreen } from './src/screens/LockScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { ManageSubscriptionScreen } from './src/screens/ManageSubscriptionScreen';
import { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const TodayIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.5} />
    <Circle cx={12} cy={12} r={3.5} fill={color} />
  </Svg>
);

const CalendarTabIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
      stroke={color}
      strokeWidth={1.5}
    />
    <Path d="M4 9h16" stroke={color} strokeWidth={1.5} />
    <Path d="M8 3v4M16 3v4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const AnalyticsIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 19V11" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M12 19V5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M19 19v-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const HistoryIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 12a9 9 0 1 0 3-6.7"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
    <Path d="M3 4v4h4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 8v5l3 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SettingsIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} />
    <Path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      stroke={color}
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </Svg>
);

const GiftTabIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <Path d="M3 7h18v4H3z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M12 7v14" stroke={color} strokeWidth={1.5} />
    <Path
      d="M12 7c-1.5-3-5-3-5-1s2 1 5 1Zm0 0c1.5-3 5-3 5-1s-2 1-5 1Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

const Tabs: React.FC = () => {
  const { colors, t } = useApp();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 24 : 12);
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: bottomInset }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: { fontSize: 11, letterSpacing: 0.4 },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color, size }) => <TodayIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: t('tabs.calendar'),
          tabBarIcon: ({ color, size }) => (
            <CalendarTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: t('tabs.analytics'),
          tabBarIcon: ({ color, size }) => (
            <AnalyticsIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <HistoryIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          title: t('tabs.subscription'),
          tabBarIcon: ({ color, size }) => <GiftTabIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
};

const RootNavigator: React.FC = () => {
  const { colors, ready, data } = useApp();
  const [unlocked, setUnlocked] = React.useState(false);
  const lastActiveAt = React.useRef<number>(Date.now());
  const RELOCK_AFTER_MS = 30_000;

  React.useEffect(() => {
    if (!data.profile.pinHash) return;
    const { AppState } = require('react-native') as typeof import('react-native');
    const sub = AppState.addEventListener('change', (next: string) => {
      if (next === 'active') {
        if (Date.now() - lastActiveAt.current > RELOCK_AFTER_MS) {
          setUnlocked(false);
        }
      } else {
        lastActiveAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [data.profile.pinHash]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
      notification: colors.primary,
    },
  };
  const isDark = colors.mode === 'dark';
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const theme = {
    ...baseTheme,
    colors: { ...baseTheme.colors, ...navTheme.colors },
  };

  if (!data.consentAcceptedAt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ConsentScreen onAccept={() => undefined} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  if (!data.onboardingDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <OnboardingScreen onComplete={() => setUnlocked(true)} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  if (data.profile.pinHash && !unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LockScreen onUnlock={() => setUnlocked(true)} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DayDetail"
          component={DayDetailScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="CycleDetail"
          component={CycleDetailScreen}
          options={{ title: '', headerShown: false }}
        />
        <Stack.Screen
          name="CycleWizard"
          options={{ title: '' }}
        >
          {({ navigation }) => (
            <OnboardingScreen
              cycleOnly
              onComplete={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="ManageSubscription"
          component={ManageSubscriptionScreen}
          options={{ title: '' }}
        />
      </Stack.Navigator>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
};

const useViewportWidth = (): number => {
  const get = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 1024;
    return window.innerWidth;
  };
  const [w, setW] = React.useState(get);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
};

const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const width = useViewportWidth();
  if (Platform.OS !== 'web' || width < 700) return <>{children}</>;
  return (
    <View style={frameStyles.outer}>
      <View style={frameStyles.frame}>{children}</View>
    </View>
  );
};

const frameStyles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#F4EADB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  frame: {
    width: '100%',
    maxWidth: 420,
    height: '100%',
    maxHeight: 880,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: '#FCEAD3',
    shadowColor: '#8E6F58',
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    borderWidth: 4,
    borderColor: '#EADBC4',
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <PhoneFrame>
            <RootNavigator />
          </PhoneFrame>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
