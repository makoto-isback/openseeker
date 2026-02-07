import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
  Modal,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { router } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import { useMemoryStore } from '../../stores/memoryStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWalletStore } from '../../stores/walletStore';
import { useChatStore } from '../../stores/chatStore';
import { getAlerts, addAlert, removeAlert, type PriceAlert } from '../../services/alerts';
import { getTodaySpend, getMonthSpend, clearSpendHistory } from '../../services/spending';
import { getDCAConfigs, removeDCAConfig, type DCAConfig } from '../../services/dca';
import { getOrders, cancelOrder as cancelOrderService, removeOrder, type TradingOrder } from '../../services/orders';
import { isWatching as isPriceWatcherRunning } from '../../services/priceWatcher';
import {
  fetchBalance,
  getDepositAddress,
  checkDeposit,
  creditTestBalance,
  depositSOL,
  getSOLPrice,
  formatBalance,
  type BalanceInfo,
} from '../../services/balance';
import { getXP, getLevel, getLevelInfo, getXPProgress } from '../../services/gamification';
import { getAchievements, type Achievement } from '../../services/achievements';
import { seedDemoData } from '../../services/demoSeed';
import { getWatchedWallets, removeWatchedWallet, type WatchedWallet } from '../../services/whaleCopyTrade';
import { getRawMemoryDebug, testMemorySystems } from '../../services/memory';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

export default function SettingsScreen() {
  const soul = useMemoryStore((s) => s.soul);
  const updateSoul = useMemoryStore((s) => s.updateSoul);
  const userMemory = useMemoryStore((s) => s.userMemory);
  const updateMemory = useMemoryStore((s) => s.updateMemory);
  const wallet = useMemoryStore((s) => s.wallet);
  const updateWallet = useMemoryStore((s) => s.updateWallet);
  const daily = useMemoryStore((s) => s.daily);

  const [draft, setDraft] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Memory editors
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memoryHasChanges, setMemoryHasChanges] = useState(false);
  const [walletDraft, setWalletDraft] = useState('');
  const [walletHasChanges, setWalletHasChanges] = useState(false);

  // Collapsible sections
  const [soulExpanded, setSoulExpanded] = useState(true);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [walletExpanded, setWalletExpanded] = useState(false);
  const [dailyExpanded, setDailyExpanded] = useState(false);

  // Alerts
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertToken, setAlertToken] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [alertPrice, setAlertPrice] = useState('');

  // Spending
  const [todaySpend, setTodaySpend] = useState(0);
  const [monthSpend, setMonthSpend] = useState(0);

  // Credits (server-side balance)
  const [creditBalance, setCreditBalance] = useState<BalanceInfo | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [testCreditAmount, setTestCreditAmount] = useState('5');

  // SOL deposit
  const [solPrice, setSolPrice] = useState(0);
  const [depositAmount, setDepositAmount] = useState('0.1');
  const [depositing, setDepositing] = useState(false);

  // DCA
  const [dcaConfigs, setDcaConfigs] = useState<DCAConfig[]>([]);

  // Trading Orders
  const [tradingOrders, setTradingOrders] = useState<TradingOrder[]>([]);

  // Watched Wallets
  const [watchedWallets, setWatchedWallets] = useState<WatchedWallet[]>([]);

  // Gamification
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Debug modal
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugData, setDebugData] = useState<{
    soul: string;
    memory: string;
    wallet: string;
    daily: string;
    context: string;
    messageCount: number;
    lastDailyDate: string;
  } | null>(null);
  const [testingMemory, setTestingMemory] = useState(false);

  // Settings
  // Park settings
  const agentName = useSettingsStore((s) => s.agentName);
  const osDomain = useSettingsStore((s) => s.osDomain);
  const isVerified = useSettingsStore((s) => s.isVerified);
  const domainTier = useSettingsStore((s) => s.domainTier);
  const domainExpiresAt = useSettingsStore((s) => s.domainExpiresAt);
  const parkMode = useSettingsStore((s) => s.parkMode);
  const setParkMode = useSettingsStore((s) => s.setParkMode);
  const parkBudgetDaily = useSettingsStore((s) => s.parkBudgetDaily);
  const setParkBudgetDaily = useSettingsStore((s) => s.setParkBudgetDaily);
  const parkSpentToday = useSettingsStore((s) => s.parkSpentToday);
  const parkTopics = useSettingsStore((s) => s.parkTopics);
  const setParkTopics = useSettingsStore((s) => s.setParkTopics);
  const [parkBudgetDraft, setParkBudgetDraft] = useState(parkBudgetDaily.toString());

  const heartbeatEnabled = useSettingsStore((s) => s.heartbeatEnabled);
  const setHeartbeatEnabled = useSettingsStore((s) => s.setHeartbeatEnabled);
  const heartbeatIntervalMin = useSettingsStore((s) => s.heartbeatIntervalMin);
  const setHeartbeatInterval = useSettingsStore((s) => s.setHeartbeatInterval);
  const morningBriefing = useSettingsStore((s) => s.morningBriefing);
  const setMorningBriefing = useSettingsStore((s) => s.setMorningBriefing);
  const nightSummary = useSettingsStore((s) => s.nightSummary);
  const setNightSummary = useSettingsStore((s) => s.setNightSummary);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const dailySpendLimit = useSettingsStore((s) => s.dailySpendLimit);
  const setDailySpendLimit = useSettingsStore((s) => s.setDailySpendLimit);
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);

  // Wallet
  const walletAddress = useWalletStore((s) => s.address);
  const isConnected = useWalletStore((s) => s.isConnected);
  const walletBalance = useWalletStore((s) => s.balance);
  const balanceLoading = useWalletStore((s) => s.balanceLoading);
  const hasMnemonic = useWalletStore((s) => s.hasMnemonic);
  const walletType = useWalletStore((s) => s.walletType);
  const refreshWalletBalance = useWalletStore((s) => s.refreshBalance);
  const walletExportMnemonic = useWalletStore((s) => s.exportMnemonic);
  const walletDelete = useWalletStore((s) => s.deleteWallet);
  const disconnectPrivy = useWalletStore((s) => s.disconnectPrivy);

  // Privy
  const { logout: privyLogout } = usePrivy();

  const [serverUrlDraft, setServerUrlDraft] = useState(serverUrl);
  const [limitDraft, setLimitDraft] = useState(dailySpendLimit.toString());

  useEffect(() => {
    setDraft(soul);
    setHasChanges(false);
  }, [soul]);

  useEffect(() => {
    setMemoryDraft(userMemory);
    setMemoryHasChanges(false);
  }, [userMemory]);

  useEffect(() => {
    setWalletDraft(wallet);
    setWalletHasChanges(false);
  }, [wallet]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const list = await getAlerts();
    setAlerts(list);
    const today = await getTodaySpend();
    const month = await getMonthSpend();
    setTodaySpend(today);
    setMonthSpend(month);
    const configs = await getDCAConfigs();
    setDcaConfigs(configs);
    const allOrders = await getOrders();
    setTradingOrders(allOrders);
    const currentXP = await getXP();
    const currentLevel = await getLevel();
    const achs = await getAchievements();
    setXP(currentXP);
    setLevel(currentLevel);
    setAchievements(achs);
    const whales = await getWatchedWallets();
    setWatchedWallets(whales);

    // Load credit balance
    const balance = await fetchBalance();
    setCreditBalance(balance);

    // Load SOL price
    const price = await getSOLPrice();
    setSolPrice(price);
  };

  const handleSoulChange = (text: string) => {
    setDraft(text);
    setHasChanges(text !== soul);
  };

  const handleSave = async () => {
    await updateSoul(draft);
    setHasChanges(false);
    Alert.alert('Saved', 'SOUL.md updated successfully.');
  };

  const handleMemoryChange = (text: string) => {
    setMemoryDraft(text);
    setMemoryHasChanges(text !== userMemory);
  };

  const handleSaveMemory = async () => {
    await updateMemory(memoryDraft);
    setMemoryHasChanges(false);
    Alert.alert('Saved', 'MEMORY.md updated successfully.');
  };

  const handleWalletChange = (text: string) => {
    setWalletDraft(text);
    setWalletHasChanges(text !== wallet);
  };

  const handleSaveWallet = async () => {
    await updateWallet(walletDraft);
    setWalletHasChanges(false);
    Alert.alert('Saved', 'WALLET.md updated successfully.');
  };

  const handleAddAlert = async () => {
    const token = alertToken.trim().toUpperCase();
    const price = parseFloat(alertPrice);
    if (!token || isNaN(price) || price <= 0) {
      Alert.alert('Invalid', 'Enter a valid token symbol and price.');
      return;
    }
    await addAlert(token, alertCondition, price);
    setAlertToken('');
    setAlertPrice('');
    await loadAll();
  };

  const handleRemoveAlert = async (id: string) => {
    await removeAlert(id);
    await loadAll();
  };

  const handleRemoveDCA = async (id: string) => {
    await removeDCAConfig(id);
    await loadAll();
  };

  const handleCancelOrder = async (id: string) => {
    await cancelOrderService(id);
    await loadAll();
  };

  const handleRemoveOrder = async (id: string) => {
    await removeOrder(id);
    await loadAll();
  };

  const handleClearSpending = async () => {
    Alert.alert('Clear Spending History', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearSpendHistory();
          await loadAll();
        },
      },
    ]);
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat History', 'This will delete all messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await useChatStore.getState().clearMessages();
          Alert.alert('Done', 'Chat history cleared.');
        },
      },
    ]);
  };

  const handleClearMemory = () => {
    Alert.alert('Clear Memory', 'Reset MEMORY.md to default?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const { updateMemory: resetMem } = useMemoryStore.getState();
          const { DEFAULT_MEMORY } = await import('../../constants/defaults');
          await resetMem(DEFAULT_MEMORY);
          Alert.alert('Done', 'Memory reset to default.');
        },
      },
    ]);
  };

  const handleSeedDemo = () => {
    Alert.alert('Seed Demo Data', 'Add demo agents and messages to Agent Park?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Seed',
        onPress: async () => {
          setSeeding(true);
          const result = await seedDemoData();
          setSeeding(false);
          if (result.success) {
            Alert.alert('Done', 'Demo data seeded successfully!');
          } else {
            Alert.alert('Error', result.error || 'Failed to seed data');
          }
        },
      },
    ]);
  };

  const handleSaveServerUrl = () => {
    const url = serverUrlDraft.trim();
    if (url) {
      setServerUrl(url);
      Alert.alert('Saved', `Server URL: ${url}`);
    }
  };

  const handleSaveLimit = () => {
    const limit = parseFloat(limitDraft);
    if (!isNaN(limit) && limit > 0) {
      setDailySpendLimit(limit);
      Alert.alert('Saved', `Daily limit: $${limit.toFixed(2)}`);
    }
  };

  const handleViewRawMemory = async () => {
    const data = await getRawMemoryDebug();
    setDebugData(data);
    setDebugVisible(true);
  };

  const handleTestMemory = async () => {
    setTestingMemory(true);
    try {
      const result = await testMemorySystems();
      if (result.success) {
        Alert.alert('Memory Test Passed', 'All memory systems are working correctly!');
      } else {
        Alert.alert(
          'Memory Test Failed',
          `Errors:\n${result.errors.join('\n')}\n\nResults:\n${JSON.stringify(result.results, null, 2)}`
        );
      }
    } catch (err: any) {
      Alert.alert('Test Error', err.message);
    } finally {
      setTestingMemory(false);
    }
  };

  const handleDepositSOL = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Enter a valid SOL amount');
      return;
    }

    if (!isConnected) {
      Alert.alert('Error', 'Connect your wallet first');
      return;
    }

    setDepositing(true);
    try {
      const result = await depositSOL(amount);
      if (result.success) {
        Alert.alert(
          'Deposit Successful!',
          `Sent: ${result.sol_amount?.toFixed(6)} SOL\nCredited: $${result.usd_credited?.toFixed(4)}\nNew Balance: $${result.new_balance?.toFixed(4)}`
        );
        // Refresh credit balance
        const balance = await fetchBalance();
        setCreditBalance(balance);
      } else {
        Alert.alert('Deposit Failed', result.error || 'Unknown error');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleTestCredit = async () => {
    const amount = parseFloat(testCreditAmount);
    if (isNaN(amount) || amount <= 0 || amount > 100) {
      Alert.alert('Error', 'Enter an amount between 0 and 100');
      return;
    }

    setDepositLoading(true);
    try {
      const result = await creditTestBalance(amount);
      if (result.success) {
        Alert.alert(
          'Test Credit Added!',
          `Credited: $${result.credited?.toFixed(2)}\nNew Balance: $${result.new_balance?.toFixed(4)}\n\n(Test mode - no real USDC)`
        );
        // Refresh balance
        const balance = await fetchBalance();
        setCreditBalance(balance);
      } else {
        Alert.alert('Failed', result.error || 'Test credits not available');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setDepositLoading(false);
    }
  };

  const handleRefreshBalance = async () => {
    const balance = await fetchBalance();
    setCreditBalance(balance);
  };

  const INTERVALS = [15, 30, 60];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet */}
      <Text style={styles.sectionTitle}>Wallet</Text>
      <View style={styles.walletCard}>
        <View style={styles.walletStatusRow}>
          <View style={[styles.statusDot, isConnected ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.walletStatus}>
            {isConnected
              ? walletType === 'privy' ? 'Privy Wallet' : 'Embedded Wallet'
              : 'No wallet'}
          </Text>
        </View>

        {isConnected && walletAddress ? (
          <>
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(walletAddress);
                Alert.alert('Copied', 'Address copied to clipboard');
              }}
            >
              <Text style={styles.walletAddressDisplay}>
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)} [copy]
              </Text>
            </TouchableOpacity>
            <View style={styles.walletBalanceRow}>
              <Text style={styles.walletBalanceLabel}>SOL Balance:</Text>
              <Text style={styles.walletBalanceValue}>
                {balanceLoading ? '...' : `${walletBalance.toFixed(4)} SOL`}
              </Text>
              <TouchableOpacity onPress={refreshWalletBalance}>
                <Text style={styles.refreshText}>[refresh]</Text>
              </TouchableOpacity>
            </View>

            {/* Export seed phrase — only for embedded wallets with mnemonic */}
            {walletType === 'embedded' && hasMnemonic && (
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => {
                  Alert.alert(
                    'Export Seed Phrase',
                    'Your seed phrase gives full access to your wallet. Never share it with anyone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Show Seed Phrase',
                        style: 'destructive',
                        onPress: async () => {
                          const mnemonic = await walletExportMnemonic();
                          if (mnemonic) {
                            Alert.alert('Seed Phrase', mnemonic);
                          } else {
                            Alert.alert('Error', 'No seed phrase found');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.exportButtonText}>Export Seed Phrase</Text>
              </TouchableOpacity>
            )}

            {/* Privy: Log Out button */}
            {walletType === 'privy' ? (
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={() => {
                  Alert.alert(
                    'Log Out',
                    'This will sign you out of your Privy wallet.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Log Out',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await privyLogout();
                          } catch (e) {
                            // Privy logout may throw if already logged out
                          }
                          await disconnectPrivy();
                          router.replace('/onboarding');
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.disconnectButtonText}>Log Out</Text>
              </TouchableOpacity>
            ) : (
              /* Embedded: Delete Wallet button */
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={() => {
                  Alert.alert(
                    'Delete Wallet',
                    'This will permanently remove your wallet from this device. Make sure you have backed up your seed phrase!',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert(
                            'Are you sure?',
                            'This action cannot be undone.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Yes, Delete Wallet',
                                style: 'destructive',
                                onPress: async () => {
                                  await walletDelete();
                                  router.replace('/onboarding');
                                },
                              },
                            ]
                          );
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.disconnectButtonText}>Delete Wallet</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.walletHint}>
            No wallet found. Go to onboarding to create or import one.
          </Text>
        )}
      </View>

      {/* Credits Section */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Credits</Text>
      <View style={styles.creditCard}>
        <View style={styles.creditHeader}>
          <Text style={styles.creditLabel}>Balance</Text>
          <TouchableOpacity onPress={handleRefreshBalance}>
            <Text style={styles.refreshText}>[refresh]</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.creditBalance}>
          {creditBalance ? formatBalance(creditBalance.balance) : '$0.0000'}
        </Text>
        {creditBalance && creditBalance.exists && (
          <View style={styles.creditStats}>
            <Text style={styles.creditStat}>
              Today: ${creditBalance.usage_today?.toFixed(4) || '0'} ({creditBalance.requests_today || 0} req)
            </Text>
            <Text style={styles.creditStat}>
              Total spent: ${creditBalance.total_spent?.toFixed(4) || '0'}
            </Text>
          </View>
        )}
      </View>

      {/* Deposit SOL Section */}
      <View style={styles.depositSection}>
        <Text style={styles.depositLabel}>Deposit SOL</Text>
        {solPrice > 0 && (
          <Text style={styles.depositHint}>
            1 SOL ~ ${solPrice.toFixed(2)} credits
          </Text>
        )}

        {/* Preset amount buttons */}
        <View style={styles.presetRow}>
          {['0.05', '0.1', '0.25'].map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[
                styles.presetButton,
                depositAmount === amt && styles.presetButtonActive,
              ]}
              onPress={() => setDepositAmount(amt)}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  depositAmount === amt && styles.presetButtonTextActive,
                ]}
              >
                {amt} SOL
              </Text>
              {solPrice > 0 && (
                <Text style={styles.presetUsd}>
                  ~${(parseFloat(amt) * solPrice).toFixed(2)}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom amount input */}
        <View style={styles.depositInputRow}>
          <TextInput
            style={[styles.alertInput, { flex: 1 }]}
            value={depositAmount}
            onChangeText={setDepositAmount}
            placeholder="Custom SOL amount"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.solSuffix}>SOL</Text>
        </View>

        {/* Deposit button */}
        <TouchableOpacity
          style={[
            styles.depositButton,
            (depositing || !isConnected) && styles.buttonDisabled,
          ]}
          onPress={handleDepositSOL}
          disabled={depositing || !isConnected}
        >
          {depositing ? (
            <View style={styles.depositButtonContent}>
              <ActivityIndicator size="small" color={colors.text} />
              <Text style={styles.depositButtonText}>Confirming...</Text>
            </View>
          ) : (
            <Text style={styles.depositButtonText}>
              {isConnected ? 'Deposit' : 'Connect Wallet First'}
            </Text>
          )}
        </TouchableOpacity>

        {!isConnected && (
          <Text style={styles.testCreditHint}>Connect your wallet above to deposit SOL</Text>
        )}

        {/* Test Mode Credits */}
        <View style={styles.testCreditRow}>
          <Text style={styles.testCreditLabel}>Test credits:</Text>
          <TextInput
            style={[styles.smallInput, { width: 60 }]}
            value={testCreditAmount}
            onChangeText={setTestCreditAmount}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.testCreditButton, depositLoading && styles.buttonDisabled]}
            onPress={handleTestCredit}
            disabled={depositLoading}
          >
            <Text style={styles.testCreditButtonText}>Add Test $</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.testCreditHint}>Test credits work only if server is in test mode</Text>
      </View>

      {/* Domain Identity */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Domain Identity</Text>
      <View style={styles.walletCard}>
        {osDomain && isVerified ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              {domainTier && domainTier !== 'free' && (
                <VerifiedBadge tier={domainTier as any} size="lg" />
              )}
              <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: '700', marginLeft: spacing.sm }}>{osDomain}</Text>
            </View>
            <Text style={styles.dcaMeta}>
              Tier: {domainTier?.toUpperCase() || 'STANDARD'} | Verified
            </Text>
            {domainExpiresAt && (
              <Text style={styles.dcaMeta}>
                Expires: {new Date(domainExpiresAt).toLocaleDateString()}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.settingLabel}>No .os domain yet</Text>
            <Text style={[styles.dcaMeta, { marginBottom: spacing.sm }]}>
              Claim your .os identity in chat! Say "claim degen.os" to get started.
            </Text>
            <Text style={styles.dcaMeta}>
              Benefits: Verified badge, .os address for tokens, higher trust in Agent Park.
            </Text>
          </>
        )}
      </View>

      {/* Agent Park */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Agent Park</Text>
      <View style={styles.walletCard}>
        <Text style={styles.settingLabel}>Agent Name: {agentName}</Text>
        <Text style={[styles.dcaMeta, { marginBottom: spacing.md }]}>
          Set during onboarding. Used in chat and park posts.
        </Text>

        <Text style={styles.settingLabel}>Mode</Text>
        <View style={[styles.intervalButtons, { marginVertical: spacing.sm }]}>
          {(['off', 'listen', 'active'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.intervalButton,
                parkMode === mode && styles.intervalButtonActive,
                { flex: 1, alignItems: 'center' as const },
              ]}
              onPress={() => setParkMode(mode)}
            >
              <Text
                style={[
                  styles.intervalButtonText,
                  parkMode === mode && styles.intervalButtonTextActive,
                ]}
              >
                {mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.dcaMeta}>
          {parkMode === 'off' ? 'Park disabled — no reading or posting.' :
           parkMode === 'listen' ? 'Read park for free, get alpha digests in heartbeat.' :
           'Post alpha + respond. Costs ~$0.002 per post.'}
        </Text>

        {parkMode === 'active' && (
          <>
            <View style={[styles.inputRow, { marginTop: spacing.sm }]}>
              <Text style={styles.settingLabel}>Daily Budget ($)</Text>
              <TextInput
                style={styles.smallInput}
                value={parkBudgetDraft}
                onChangeText={setParkBudgetDraft}
                keyboardType="decimal-pad"
                onBlur={() => {
                  const val = parseFloat(parkBudgetDraft);
                  if (!isNaN(val) && val > 0) setParkBudgetDaily(val);
                }}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Text style={styles.dcaMeta}>
              Spent today: ${parkSpentToday.toFixed(4)} | Resets at midnight UTC.
            </Text>
          </>
        )}

        <Text style={[styles.settingLabel, { marginTop: spacing.md }]}>Topics</Text>
        <View style={[styles.intervalButtons, { flexWrap: 'wrap', marginTop: spacing.xs }]}>
          {['memecoins', 'defi', 'trending', 'nfts'].map((topic) => {
            const active = parkTopics.includes(topic);
            return (
              <TouchableOpacity
                key={topic}
                style={[styles.intervalButton, active && styles.intervalButtonActive]}
                onPress={() => {
                  if (active) {
                    setParkTopics(parkTopics.filter((t) => t !== topic));
                  } else {
                    setParkTopics([...parkTopics, topic]);
                  }
                }}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    active && styles.intervalButtonTextActive,
                  ]}
                >
                  {active ? '[x]' : '[ ]'} {topic}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Spending */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Spending</Text>
      <View style={styles.spendRow}>
        <View style={styles.spendCard}>
          <Text style={styles.spendLabel}>Today</Text>
          <Text style={styles.spendValue}>${todaySpend.toFixed(4)}</Text>
        </View>
        <View style={styles.spendCard}>
          <Text style={styles.spendLabel}>Month</Text>
          <Text style={styles.spendValue}>${monthSpend.toFixed(4)}</Text>
        </View>
      </View>
      <View style={styles.inputRow}>
        <Text style={styles.settingLabel}>Daily limit ($)</Text>
        <TextInput
          style={styles.smallInput}
          value={limitDraft}
          onChangeText={setLimitDraft}
          keyboardType="decimal-pad"
          onBlur={handleSaveLimit}
          placeholderTextColor={colors.textMuted}
        />
      </View>
      <TouchableOpacity style={styles.dangerButton} onPress={handleClearSpending}>
        <Text style={styles.dangerText}>Clear Spending History</Text>
      </TouchableOpacity>

      {/* Price Alerts */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Price Alerts</Text>

      {alerts.filter((a) => !a.triggered).length === 0 && (
        <Text style={styles.emptyText}>No active alerts.</Text>
      )}

      {alerts.filter((a) => !a.triggered).map((alert) => (
        <View key={alert.id} style={styles.alertRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertText}>
              {alert.token} {alert.condition} ${alert.targetPrice}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleRemoveAlert(alert.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.alertForm}>
        <TextInput
          style={[styles.alertInput, { flex: 1 }]}
          value={alertToken}
          onChangeText={setAlertToken}
          placeholder="Token"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={styles.conditionButton}
          onPress={() => setAlertCondition((c) => (c === 'above' ? 'below' : 'above'))}
        >
          <Text style={styles.conditionText}>{alertCondition}</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.alertInput, { flex: 1 }]}
          value={alertPrice}
          onChangeText={setAlertPrice}
          placeholder="Price"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddAlert}>
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Watched Wallets */}
      {watchedWallets.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Watched Wallets</Text>
          {watchedWallets.map((w) => (
            <View key={w.address} style={styles.alertRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertText}>{w.label}</Text>
                <Text style={styles.dcaMeta}>
                  {w.address.slice(0, 12)}...{w.address.slice(-8)}
                </Text>
              </View>
              <TouchableOpacity onPress={async () => {
                await removeWatchedWallet(w.address);
                await loadAll();
              }}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Heartbeat Settings */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Heartbeat</Text>

      <SettingRow
        label="Heartbeat enabled"
        value={heartbeatEnabled}
        onToggle={setHeartbeatEnabled}
      />

      {heartbeatEnabled && (
        <View style={styles.intervalRow}>
          <Text style={styles.settingLabel}>Check interval</Text>
          <View style={styles.intervalButtons}>
            {INTERVALS.map((min) => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.intervalButton,
                  heartbeatIntervalMin === min && styles.intervalButtonActive,
                ]}
                onPress={() => setHeartbeatInterval(min)}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    heartbeatIntervalMin === min && styles.intervalButtonTextActive,
                  ]}
                >
                  {min}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <SettingRow
        label="Morning briefing (7:00 AM)"
        value={morningBriefing}
        onToggle={setMorningBriefing}
      />
      <SettingRow
        label="Night summary (10:00 PM)"
        value={nightSummary}
        onToggle={setNightSummary}
      />
      <SettingRow
        label="Push notifications"
        value={notificationsEnabled}
        onToggle={setNotificationsEnabled}
      />

      {/* DCA Configs */}
      {dcaConfigs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>DCA Automations</Text>
          {dcaConfigs.map((dca) => (
            <View key={dca.id} style={styles.alertRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertText}>
                  {dca.amount} {dca.fromToken} → {dca.toToken} every {dca.intervalHours}h
                </Text>
                <Text style={styles.dcaMeta}>
                  {dca.active ? 'Active' : 'Paused'} | {dca.totalExecuted} executed
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveDCA(dca.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Trading Orders */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Trading Orders</Text>
      {isPriceWatcherRunning() && (
        <View style={styles.testModeRow}>
          <View style={[styles.statusDot, styles.dotGreen]} />
          <Text style={styles.testModeText}>Price watcher active</Text>
        </View>
      )}
      {tradingOrders.filter((o) => o.status === 'active').length === 0 ? (
        <Text style={styles.emptyText}>No active orders. Set one via chat (e.g. "set limit buy SOL at $150").</Text>
      ) : (
        tradingOrders
          .filter((o) => o.status === 'active')
          .map((order) => (
            <View key={order.id} style={styles.alertRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertText}>
                  {order.type === 'limit_buy' ? 'BUY' : order.type === 'limit_sell' ? 'SELL' : 'STOP'}{' '}
                  {order.token} @ ${order.triggerPrice}
                </Text>
                <Text style={styles.dcaMeta}>
                  {order.amount} {order.type === 'limit_buy' ? order.baseToken : order.token}
                  {order.expiresAt ? ` | Expires ${new Date(order.expiresAt).toLocaleDateString()}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleCancelOrder(order.id)}>
                <Text style={styles.removeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))
      )}
      {tradingOrders.filter((o) => o.status === 'filled').length > 0 && (
        <>
          <Text style={[styles.settingLabel, { marginTop: spacing.md }]}>Recent Fills</Text>
          {tradingOrders
            .filter((o) => o.status === 'filled')
            .sort((a, b) => (b.filledAt || 0) - (a.filledAt || 0))
            .slice(0, 5)
            .map((order) => (
              <View key={order.id} style={styles.alertRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertText, { color: colors.green }]}>
                    {order.type === 'limit_buy' ? 'BOUGHT' : 'SOLD'}{' '}
                    {order.token} @ ${order.filledPrice?.toFixed(2)}
                  </Text>
                  <Text style={styles.dcaMeta}>
                    {order.txSignature ? order.txSignature.slice(0, 12) + '...' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveOrder(order.id)}>
                  <Text style={styles.removeText}>Clear</Text>
                </TouchableOpacity>
              </View>
            ))}
        </>
      )}

      {/* Memory */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Memory</Text>

      {/* SOUL.md Editor */}
      <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setSoulExpanded(!soulExpanded)}>
        <Text style={styles.toggleIndicator}>{soulExpanded ? '[v]' : '[>]'}</Text>
        <Text style={styles.sectionTitle}>Agent Personality (SOUL.md)</Text>
      </TouchableOpacity>
      {soulExpanded && (
        <>
          <Text style={styles.sectionDescription}>
            Edit your agent's personality, behavior rules, and response style.
          </Text>
          <TextInput
            style={styles.editor}
            value={draft}
            onChangeText={handleSoulChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveButton, !hasChanges && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges}
          >
            <Text style={styles.buttonText}>
              {hasChanges ? 'Save Changes' : 'No Changes'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* MEMORY.md Editor */}
      <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setMemoryExpanded(!memoryExpanded)}>
        <Text style={styles.toggleIndicator}>{memoryExpanded ? '[v]' : '[>]'}</Text>
        <Text style={styles.sectionTitle}>Memory (MEMORY.md)</Text>
      </TouchableOpacity>
      {memoryExpanded && (
        <>
          <Text style={styles.sectionDescription}>
            Facts and context the agent remembers about you.
          </Text>
          <TextInput
            style={styles.editor}
            value={memoryDraft}
            onChangeText={handleMemoryChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveButton, !memoryHasChanges && styles.buttonDisabled]}
            onPress={handleSaveMemory}
            disabled={!memoryHasChanges}
          >
            <Text style={styles.buttonText}>
              {memoryHasChanges ? 'Save Changes' : 'No Changes'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* WALLET.md Editor */}
      <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setWalletExpanded(!walletExpanded)}>
        <Text style={styles.toggleIndicator}>{walletExpanded ? '[v]' : '[>]'}</Text>
        <Text style={styles.sectionTitle}>Wallet (WALLET.md)</Text>
      </TouchableOpacity>
      {walletExpanded && (
        <>
          <Text style={styles.sectionDescription}>
            Your token holdings and trade history.
          </Text>
          <TextInput
            style={styles.editor}
            value={walletDraft}
            onChangeText={handleWalletChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveButton, !walletHasChanges && styles.buttonDisabled]}
            onPress={handleSaveWallet}
            disabled={!walletHasChanges}
          >
            <Text style={styles.buttonText}>
              {walletHasChanges ? 'Save Changes' : 'No Changes'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* DAILY.md (read-only) */}
      <TouchableOpacity style={styles.collapsibleHeader} onPress={() => setDailyExpanded(!dailyExpanded)}>
        <Text style={styles.toggleIndicator}>{dailyExpanded ? '[v]' : '[>]'}</Text>
        <Text style={styles.sectionTitle}>Daily Log (DAILY.md)</Text>
      </TouchableOpacity>
      {dailyExpanded && (
        <>
          <Text style={styles.sectionDescription}>
            Auto-generated daily activity log (read-only).
          </Text>
          <View style={styles.readOnlyEditor}>
            <Text style={styles.readOnlyText}>{daily || 'No daily log entries yet.'}</Text>
          </View>
        </>
      )}

      <TouchableOpacity style={styles.memoryButton} onPress={handleClearChat}>
        <Text style={styles.dangerText}>Clear Chat History</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.memoryButton} onPress={handleClearMemory}>
        <Text style={styles.dangerText}>Reset Memory</Text>
      </TouchableOpacity>

      {/* Gamification */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Gamification</Text>
      {(() => {
        const info = getLevelInfo(level);
        const progress = getXPProgress(xp, level);
        return (
          <>
            <View style={styles.levelRow}>
              <Text style={styles.levelEmoji}>{info.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.levelTitle}>{info.title} (Level {level})</Text>
                <View style={styles.xpBarContainer}>
                  <View style={[styles.xpBarFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
                </View>
                <Text style={styles.xpText}>{xp} XP{info.nextThreshold > xp ? ` / ${info.nextThreshold} XP` : ' (MAX)'}</Text>
              </View>
            </View>
            {achievements.filter((a) => a.unlocked).length > 0 && (
              <View style={styles.achievementsRow}>
                {achievements.filter((a) => a.unlocked).map((a) => (
                  <View key={a.id} style={styles.achievementBadge}>
                    <Text style={styles.achievementEmoji}>{a.emoji}</Text>
                    <Text style={styles.achievementTitle}>{a.title}</Text>
                  </View>
                ))}
              </View>
            )}
            {achievements.filter((a) => !a.unlocked).length > 0 && (
              <Text style={styles.lockedCount}>
                {achievements.filter((a) => !a.unlocked).length} locked achievements remaining
              </Text>
            )}
          </>
        );
      })()}

      {/* Advanced */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>Advanced</Text>
      <View style={styles.inputRow}>
        <Text style={styles.settingLabel}>Server URL</Text>
      </View>
      <View style={styles.serverUrlRow}>
        <TextInput
          style={[styles.alertInput, { flex: 1 }]}
          value={serverUrlDraft}
          onChangeText={setServerUrlDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleSaveServerUrl}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.testModeRow}>
        <View style={[styles.statusDot, styles.dotGreen]} />
        <Text style={styles.testModeText}>x402 Test Mode Active</Text>
      </View>

      <TouchableOpacity
        style={[styles.seedButton, seeding && styles.buttonDisabled]}
        onPress={handleSeedDemo}
        disabled={seeding}
      >
        <Text style={styles.buttonText}>{seeding ? 'Seeding...' : 'Seed Demo Data'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.debugButton}
        onPress={handleViewRawMemory}
      >
        <Text style={styles.debugButtonText}>[?] View Raw Memory</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.debugButton, testingMemory && styles.buttonDisabled]}
        onPress={handleTestMemory}
        disabled={testingMemory}
      >
        <Text style={styles.debugButtonText}>{testingMemory ? '[...] Testing...' : '[!] Run Memory Test'}</Text>
      </TouchableOpacity>

      {/* Debug Modal */}
      <Modal
        visible={debugVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDebugVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raw Memory Debug</Text>
              <TouchableOpacity onPress={() => setDebugVisible(false)}>
                <Text style={styles.modalClose}>[x]</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {debugData && (
                <>
                  <View style={styles.debugStatsRow}>
                    <View style={styles.debugStatCard}>
                      <Text style={styles.debugStatLabel}>Message Count</Text>
                      <Text style={styles.debugStatValue}>{debugData.messageCount}/20</Text>
                    </View>
                    <View style={styles.debugStatCard}>
                      <Text style={styles.debugStatLabel}>Last Daily Reset</Text>
                      <Text style={styles.debugStatValue}>{debugData.lastDailyDate}</Text>
                    </View>
                  </View>

                  <Text style={styles.debugLabel}>MEMORY.md ({debugData.memory.length} chars)</Text>
                  <View style={styles.debugBox}>
                    <Text style={styles.debugText}>{debugData.memory.slice(0, 2000)}</Text>
                    {debugData.memory.length > 2000 && <Text style={styles.debugTruncated}>... (truncated)</Text>}
                  </View>

                  <Text style={styles.debugLabel}>WALLET.md ({debugData.wallet.length} chars)</Text>
                  <View style={styles.debugBox}>
                    <Text style={styles.debugText}>{debugData.wallet.slice(0, 1000)}</Text>
                    {debugData.wallet.length > 1000 && <Text style={styles.debugTruncated}>... (truncated)</Text>}
                  </View>

                  <Text style={styles.debugLabel}>DAILY.md ({debugData.daily.length} chars)</Text>
                  <View style={styles.debugBox}>
                    <Text style={styles.debugText}>{debugData.daily.slice(0, 1000) || '(empty)'}</Text>
                    {debugData.daily.length > 1000 && <Text style={styles.debugTruncated}>... (truncated)</Text>}
                  </View>

                  <Text style={styles.debugLabel}>CONTEXT.md ({debugData.context.length} chars)</Text>
                  <View style={styles.debugBox}>
                    <Text style={styles.debugText}>{debugData.context.slice(0, 500) || '(empty)'}</Text>
                    {debugData.context.length > 500 && <Text style={styles.debugTruncated}>... (truncated)</Text>}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.surface, true: colors.accent }}
        thumbColor={colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  toggleIndicator: {
    fontFamily: monoFont,
    color: colors.teal,
    fontSize: fontSize.md,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  editor: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.sm,
    fontFamily: monoFont,
    minHeight: 200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyEditor: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: monoFont,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginVertical: spacing.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  alertText: {
    color: colors.text,
    fontSize: fontSize.md,
  },
  removeText: {
    color: colors.red,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  alertForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  alertInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.text,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conditionButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  conditionText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: colors.green,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    color: colors.text,
    fontSize: fontSize.md,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  intervalButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  intervalButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  intervalButtonActive: {
    backgroundColor: colors.accent,
  },
  intervalButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  intervalButtonTextActive: {
    color: colors.text,
  },
  // Spending
  spendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  spendCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  spendLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  spendValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  smallInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.text,
    fontSize: fontSize.sm,
    width: 80,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dangerText: {
    color: colors.red,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // DCA
  dcaMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  // Wallet
  walletCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: colors.green,
  },
  dotRed: {
    backgroundColor: colors.red,
  },
  walletStatus: {
    color: colors.text,
    fontSize: fontSize.md,
  },
  walletAddressDisplay: {
    color: colors.teal,
    fontSize: fontSize.md,
    fontFamily: monoFont,
    marginBottom: spacing.sm,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  walletBalanceLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  walletBalanceValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  walletHint: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  walletNote: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  exportButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exportButtonText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  disconnectButton: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: colors.red,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Memory
  memoryButton: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Advanced
  serverUrlRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  testModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  testModeText: {
    color: colors.green,
    fontSize: fontSize.sm,
  },
  seedButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  // Gamification
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  levelEmoji: {
    fontSize: 28,
    fontFamily: monoFont,
    color: colors.teal,
  },
  levelTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  xpBarContainer: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  xpText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  achievementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  achievementBadge: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 70,
  },
  achievementEmoji: {
    fontSize: 16,
    fontFamily: monoFont,
    color: colors.teal,
  },
  achievementTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  lockedCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // Debug
  debugButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  debugButtonText: {
    color: colors.teal,
    fontSize: fontSize.md,
    fontWeight: '600',
    fontFamily: monoFont,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.teal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  modalClose: {
    color: colors.teal,
    fontSize: fontSize.lg,
    fontFamily: monoFont,
  },
  modalScroll: {
    padding: spacing.md,
  },
  debugLabel: {
    color: colors.teal,
    fontSize: fontSize.sm,
    fontWeight: '600',
    fontFamily: monoFont,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  debugBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: monoFont,
    lineHeight: 16,
  },
  debugTruncated: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  debugStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  debugStatCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.teal,
  },
  debugStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: monoFont,
  },
  debugStatValue: {
    color: colors.teal,
    fontSize: fontSize.md,
    fontWeight: '700',
    fontFamily: monoFont,
    marginTop: 2,
  },
  // Credits
  creditCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  creditLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  refreshText: {
    color: colors.teal,
    fontSize: fontSize.xs,
    fontFamily: monoFont,
  },
  creditBalance: {
    color: colors.teal,
    fontSize: 36,
    fontWeight: '700',
    fontFamily: monoFont,
  },
  creditStats: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  creditStat: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  depositSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  depositLabel: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  depositHint: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetButtonActive: {
    borderColor: colors.teal,
    backgroundColor: colors.background,
  },
  presetButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  presetButtonTextActive: {
    color: colors.teal,
  },
  presetUsd: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  depositInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  solSuffix: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  depositButton: {
    backgroundColor: colors.green,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  depositButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  depositButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  testCreditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  testCreditLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  testCreditButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  testCreditButtonText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  testCreditHint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
