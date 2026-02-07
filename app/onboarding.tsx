/**
 * Onboarding Screen — Shown when no wallet exists.
 *
 * Options:
 * 1. Continue with Google (Privy OAuth)
 * 2. Continue with Email (Privy OTP)
 * 3. Create New Wallet (embedded, for advanced users)
 * 4. Import Wallet (embedded seed phrase or private key)
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { usePrivy, useLoginWithOAuth, useLoginWithEmail, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

type Screen = 'main' | 'create' | 'import-seed' | 'import-key' | 'email-login' | 'name-agent' | 'domain-upsell';

export default function OnboardingScreen({ onComplete }: { onComplete?: () => void }) {
  const [screen, setScreen] = useState<Screen>('main');
  const [loading, setLoading] = useState(false);

  // Create wallet state
  const [mnemonic, setMnemonic] = useState('');

  // Import state
  const [seedInput, setSeedInput] = useState('');
  const [keyInput, setKeyInput] = useState('');

  // Agent naming state
  const [agentNameInput, setAgentNameInput] = useState('DegenCat');
  const [nameError, setNameError] = useState('');

  // Email login state
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const createWallet = useWalletStore((s) => s.createWallet);
  const importFromMnemonic = useWalletStore((s) => s.importFromMnemonic);
  const importFromPrivateKey = useWalletStore((s) => s.importFromPrivateKey);
  const setPrivyWallet = useWalletStore((s) => s.setPrivyWallet);

  // Privy hooks
  const { user } = usePrivy();
  const isAuthenticated = user !== null;
  const oauthHook = useLoginWithOAuth();
  const emailHook = useLoginWithEmail();
  const solanaWallet = useEmbeddedSolanaWallet();

  // Watch for Privy login completion
  useEffect(() => {
    if (
      isAuthenticated &&
      solanaWallet.status === 'connected' &&
      solanaWallet.wallets &&
      solanaWallet.wallets.length > 0
    ) {
      const address = solanaWallet.wallets[0].address;
      // Privy login succeeded and wallet is ready
      setPrivyWallet(address).then(() => {
        setLoading(false);
        setScreen('name-agent');
      });
    }
  }, [isAuthenticated, solanaWallet.status]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await oauthHook.login({ provider: 'google' });
      // Completion handled by useEffect watching user + wallet
    } catch (error: any) {
      setLoading(false);
      if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
        // User cancelled — do nothing
        return;
      }
      Alert.alert('Login Failed', error.message || 'Google login failed. Please try again.');
    }
  };

  const handleSendOTP = async () => {
    const email = emailInput.trim();
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await emailHook.sendCode({ email });
      setOtpSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const code = otpInput.trim();
    if (!code || code.length < 4) {
      Alert.alert('Invalid Code', 'Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      await emailHook.loginWithCode({ code, email: emailInput.trim() });
      // Completion handled by useEffect watching user + wallet
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Verification Failed', error.message || 'Invalid code. Please try again.');
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const seedPhrase = await createWallet();
      setMnemonic(seedPhrase);
      setScreen('create');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmBackup = () => {
    setScreen('name-agent');
  };

  const handleImportSeed = async () => {
    const trimmed = seedInput.trim();
    const words = trimmed.split(/\s+/);
    if (words.length !== 12) {
      Alert.alert('Invalid', 'Please enter exactly 12 words.');
      return;
    }

    setLoading(true);
    try {
      await importFromMnemonic(trimmed);
      setScreen('name-agent');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid seed phrase');
    } finally {
      setLoading(false);
    }
  };

  const handleImportKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed || trimmed.length < 60) {
      Alert.alert('Invalid', 'Please enter a valid base58 private key.');
      return;
    }

    setLoading(true);
    try {
      await importFromPrivateKey(trimmed);
      setScreen('name-agent');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid private key');
    } finally {
      setLoading(false);
    }
  };

  // Seed phrase display after creation
  if (screen === 'create' && mnemonic) {
    const words = mnemonic.split(' ');
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Save Your Seed Phrase</Text>
        <Text style={styles.subtitle}>
          Write these 12 words down and store them somewhere safe. This is the ONLY way to recover your wallet.
        </Text>

        <View style={styles.seedGrid}>
          {words.map((word, i) => (
            <View key={i} style={styles.seedWord}>
              <Text style={styles.seedIndex}>{i + 1}</Text>
              <Text style={styles.seedText}>{word}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.warning}>
          Never share your seed phrase. Anyone with these words can access your funds.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmBackup}>
          <Text style={styles.primaryButtonText}>I've Saved It</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => { setScreen('main'); setMnemonic(''); }}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Import seed phrase screen
  if (screen === 'import-seed') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Import Seed Phrase</Text>
        <Text style={styles.subtitle}>
          Enter your 12-word seed phrase, separated by spaces.
        </Text>

        <TextInput
          style={styles.importInput}
          value={seedInput}
          onChangeText={setSeedInput}
          placeholder="word1 word2 word3 ... word12"
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleImportSeed}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryButtonText}>Import Wallet</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => setScreen('main')}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Import private key screen
  if (screen === 'import-key') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Import Private Key</Text>
        <Text style={styles.subtitle}>
          Enter your base58-encoded private key.
        </Text>

        <TextInput
          style={styles.importInput}
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="Enter base58 private key"
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleImportKey}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryButtonText}>Import Wallet</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => setScreen('main')}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Email login screen
  if (screen === 'email-login') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Continue with Email</Text>
        <Text style={styles.subtitle}>
          {otpSent
            ? `We sent a verification code to ${emailInput.trim()}`
            : 'Enter your email to receive a login code.'}
        </Text>

        {!otpSent ? (
          <>
            <TextInput
              style={styles.importInput}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.privyButton, loading && styles.buttonDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.privyButtonText}>Send Code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.otpInput}
              value={otpInput}
              onChangeText={setOtpInput}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              textAlign="center"
            />

            <TouchableOpacity
              style={[styles.privyButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.privyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => { setOtpSent(false); setOtpInput(''); }}
            >
              <Text style={styles.resendText}>Use a different email</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => { setScreen('main'); setOtpSent(false); setOtpInput(''); }}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Agent naming screen
  if (screen === 'name-agent') {
    const handleSaveName = async () => {
      const name = agentNameInput.trim();
      if (name.length < 2) {
        setNameError('Name must be at least 2 characters');
        return;
      }
      if (name.length > 20) {
        setNameError('Name must be 20 characters or less');
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        setNameError('Only letters, numbers, underscore, and dash allowed');
        return;
      }
      setNameError('');
      useSettingsStore.getState().setAgentName(name);
      setScreen('domain-upsell');
    };

    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.lg }}>
            {'(=^.^=)'}
          </Text>
          <Text style={styles.title}>Name Your AI Companion</Text>
          <TextInput
            style={[styles.importInput, { minHeight: 50 }]}
            value={agentNameInput}
            onChangeText={(t) => {
              setAgentNameInput(t);
              setNameError('');
            }}
            placeholder="DegenCat"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          {nameError ? <Text style={styles.warning}>{nameError}</Text> : null}
          <Text style={styles.subtitle}>
            Your agent will use this name when talking to you and when chatting with other agents in Agent Park.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveName}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Domain upsell screen
  if (screen === 'domain-upsell') {
    const suggestedName = agentNameInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: spacing.md }}>
            {'\u{1F451}'}
          </Text>
          <Text style={styles.title}>Claim Your .os Identity</Text>
          <Text style={styles.subtitle}>
            Get a verified .os domain name for your agent. Stand out in Agent Park with a verified badge, receive tokens to your .os address, and earn higher trust from other agents.
          </Text>

          <View style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.md,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            borderWidth: 1,
            borderColor: '#1DA1F2',
          }}>
            <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm }}>
              {suggestedName}.os
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' }}>
              {suggestedName.length <= 2 ? '\u{1F451} OG Tier — 2 SOL' :
               suggestedName.length <= 4 ? '\u{1F48E} Premium Tier — 0.5 SOL' :
               '\u2705 Standard Tier — 0.1 SOL'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (onComplete) {
                onComplete();
              } else {
                router.replace('/(tabs)');
              }
              // User can claim in chat
              setTimeout(() => {
                const { useChatStore } = require('../stores/chatStore');
                useChatStore.getState().sendMessage(`claim ${suggestedName}.os`);
              }, 2000);
            }}
          >
            <Text style={styles.primaryButtonText}>Claim {suggestedName}.os</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => onComplete ? onComplete() : router.replace('/(tabs)')}
          >
            <Text style={styles.backButtonText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main onboarding screen
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>[OS]</Text>
          <Text style={styles.appName}>OpenSeeker</Text>
          <Text style={styles.tagline}>Your crypto-native AI companion</Text>
        </View>

        <View style={styles.buttonGroup}>
          {/* Privy login options (primary) */}
          <TouchableOpacity
            style={[styles.privyButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.privyButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.privyButton, loading && styles.buttonDisabled]}
            onPress={() => setScreen('email-login')}
            disabled={loading}
          >
            <Text style={styles.privyButtonText}>Continue with Email</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or for advanced users</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Embedded wallet options (secondary) */}
          <TouchableOpacity
            style={[styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Create New Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setScreen('import-seed')}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Import Seed Phrase</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setScreen('import-key')}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Import Private Key</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Sign in with Google or Email for the easiest experience. Advanced users can manage their own wallet.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl * 2,
  },
  logo: {
    fontSize: 48,
    fontFamily: monoFont,
    color: colors.teal,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonGroup: {
    gap: spacing.md,
  },
  // Privy login buttons (primary style with blue tint)
  privyButton: {
    backgroundColor: '#2563EB',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  privyButtonText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginHorizontal: spacing.md,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xxl,
    lineHeight: 20,
  },
  // Seed phrase grid
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    justifyContent: 'center',
  },
  seedWord: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    width: '30%',
    minWidth: 95,
  },
  seedIndex: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontFamily: monoFont,
    marginRight: spacing.sm,
    width: 16,
  },
  seedText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontFamily: monoFont,
  },
  warning: {
    color: colors.red,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  // Import
  importInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: fontSize.md,
    fontFamily: monoFont,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    textAlignVertical: 'top',
  },
  // OTP input
  otpInput: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: fontSize.xxl,
    fontFamily: monoFont,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    textAlign: 'center',
    letterSpacing: 8,
  },
  resendButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  resendText: {
    color: colors.teal,
    fontSize: fontSize.sm,
  },
  backButton: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  backButtonText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
});
