import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PrivyProvider, usePrivy } from '@privy-io/expo';
import { useMemoryStore } from '../stores/memoryStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWalletStore } from '../stores/walletStore';
import { initializeNotifications, scheduleDailyNotification, cancelScheduledNotification } from '../services/notifications';
import { registerBackgroundHeartbeat, startForegroundHeartbeat, executeHeartbeat } from '../services/heartbeat';
import { ensureWatching } from '../services/priceWatcher';
import { colors } from '../constants/theme';
import PrivyBridgeSync from '../components/PrivyBridgeSync';
import OnboardingScreen from './onboarding';

const PRIVY_APP_ID = 'cmlb2hg5r02qiky0efhf457my';

function InnerLayout() {
  const loadAll = useMemoryStore((s) => s.loadAll);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const loadWallet = useWalletStore((s) => s.loadWallet);
  const isInitialized = useWalletStore((s) => s.isInitialized);
  const isLoading = useWalletStore((s) => s.isLoading);
  const walletType = useWalletStore((s) => s.walletType);
  const disconnectPrivy = useWalletStore((s) => s.disconnectPrivy);
  const heartbeatEnabled = useSettingsStore((s) => s.heartbeatEnabled);
  const heartbeatIntervalMin = useSettingsStore((s) => s.heartbeatIntervalMin);
  const morningBriefing = useSettingsStore((s) => s.morningBriefing);
  const nightSummary = useSettingsStore((s) => s.nightSummary);
  const setLastHeartbeat = useSettingsStore((s) => s.setLastHeartbeat);

  const { isReady: privyReady, user: privyUser } = usePrivy();
  const privyAuthenticated = privyUser !== null;

  const loadAgentName = useSettingsStore((s) => s.loadAgentName);

  useEffect(() => {
    loadAll();
    loadMessages();
    loadWallet();
    loadAgentName();
    initializeNotifications();
    ensureWatching().catch(console.error);
  }, []);

  // Handle Privy session expiry
  useEffect(() => {
    if (isLoading || walletType !== 'privy' || !privyReady) return;
    if (!privyAuthenticated) {
      console.log('[Layout] Privy session expired, clearing wallet');
      disconnectPrivy();
    }
  }, [isLoading, walletType, privyReady, privyAuthenticated]);

  // Determine if we need onboarding — captured ONCE on initial load
  const initialOnboardingRef = useRef<boolean | null>(null);

  if (!isLoading && initialOnboardingRef.current === null) {
    if (walletType === 'privy') {
      // For Privy, only set the ref when SDK is ready
      if (privyReady) {
        initialOnboardingRef.current = !privyAuthenticated || !isInitialized;
      }
    } else {
      initialOnboardingRef.current = !isInitialized;
    }
  }

  // Track onboarding completion via state (separate from wallet init)
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const showOnboarding = initialOnboardingRef.current === true && !onboardingComplete;

  // Manage heartbeat lifecycle
  useEffect(() => {
    if (!heartbeatEnabled) return;

    registerBackgroundHeartbeat();
    startForegroundHeartbeat(heartbeatIntervalMin * 60 * 1000);

    const initialTimer = setTimeout(async () => {
      await executeHeartbeat();
      setLastHeartbeat(Date.now());
    }, 5000);

    return () => {
      clearTimeout(initialTimer);
    };
  }, [heartbeatEnabled, heartbeatIntervalMin]);

  // Manage scheduled briefings
  useEffect(() => {
    if (morningBriefing) {
      scheduleDailyNotification(
        'morning-briefing',
        '☀️ Gm ser!',
        'Your morning briefing is ready.',
        7, 0,
        { type: 'morning_briefing' },
      );
    } else {
      cancelScheduledNotification('morning-briefing');
    }
  }, [morningBriefing]);

  useEffect(() => {
    if (nightSummary) {
      scheduleDailyNotification(
        'night-summary',
        '📊 Daily wrap-up',
        'Your daily wrap-up is ready, ser.',
        22, 0,
        { type: 'night_summary' },
      );
    } else {
      cancelScheduledNotification('night-summary');
    }
  }, [nightSummary]);

  // Show blank splash only during initial wallet state load
  // (initialOnboardingRef stays null until isLoading becomes false for the first time)
  if (initialOnboardingRef.current === null) {
    return (
      <>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.background }} />
      </>
    );
  }

  // Render onboarding inline — avoids all routing/navigation issues
  if (showOnboarding) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <PrivyBridgeSync />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="park"
          options={{
            presentation: 'modal',
            title: 'Agent Park',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID}>
      <InnerLayout />
    </PrivyProvider>
  );
}
