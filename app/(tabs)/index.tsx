import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWalletStore } from '../../stores/walletStore';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { checkHealth } from '../../services/api';
import { getLevel, getLevelInfo } from '../../services/gamification';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import type { Message } from '../../services/memory';

function formatTimeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getWelcomeMessage(name: string) {
  return `Gm ser! I'm ${name}, your crypto companion.

I can check prices, track your portfolio, watch whales, and more.

Try saying: "What's SOL at?" or "How's my portfolio?"

Let's get this bread!`;
}

const ASCII_CAT = ` /\\_/\\
( o.o )
 > ^ <`;

const QUICK_ACTIONS = [
  { label: '[$] Prices', message: 'What are SOL, WIF, BONK prices?' },
  { label: '[#] Portfolio', message: "How's my portfolio doing?" },
  { label: '[!] News', message: "What's the latest crypto news?" },
  { label: '[~] Whales', message: 'Any whale activity on SOL?' },
];

export default function ChatScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [level, setLevel] = useState(1);
  const [levelEmoji, setLevelEmoji] = useState('[.]');
  const flatListRef = useRef<FlatList<Message>>(null);
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const isSending = useChatStore((s) => s.isSending);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const lastHeartbeat = useSettingsStore((s) => s.lastHeartbeat);
  const heartbeatEnabled = useSettingsStore((s) => s.heartbeatEnabled);
  const agentName = useSettingsStore((s) => s.agentName);
  const domainTier = useSettingsStore((s) => s.domainTier);
  const osDomain = useSettingsStore((s) => s.osDomain);

  // Check server connection on mount and periodically
  const checkConnection = useCallback(async () => {
    const healthy = await checkHealth();
    setIsConnected(healthy);
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  // Load level info
  useEffect(() => {
    const loadLevel = async () => {
      const lv = await getLevel();
      const info = getLevelInfo(lv);
      setLevel(lv);
      setLevelEmoji(info.emoji);
    };
    loadLevel();
    // Refresh level when messages change (XP may have changed)
    const interval = setInterval(loadLevel, 10000);
    return () => clearInterval(interval);
  }, [messages.length]);

  // Scroll to bottom when keyboard opens or messages change
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      },
    );
    return () => showSub.remove();
  }, []);

  // Auto-scroll when new messages arrive + during typing animation
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
      // Keep scrolling during terminal text animation (content grows as chars type)
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg?.isNew) {
        const scrollInterval = setInterval(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 300);
        // Stop after max expected animation time (text.length * 25ms + buffer)
        const maxTime = Math.min((lastMsg.content?.length || 100) * 25 + 1000, 15000);
        const stopTimeout = setTimeout(() => clearInterval(scrollInterval), maxTime);
        return () => {
          clearInterval(scrollInterval);
          clearTimeout(stopTimeout);
        };
      }
    }
  }, [messages.length, isLoading]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isSending) return;
    if (!text) setInput('');
    await sendMessage(msg);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Offline Banner */}
      {isConnected === false && <OfflineBanner onRetry={checkConnection} />}

      {/* Connection + Heartbeat + Level status */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusDot, isConnected === true ? styles.statusGreen : isConnected === false ? styles.statusRed : styles.statusGray]} />
          <Text style={styles.statusText}>
            {isConnected === true ? 'Connected' : isConnected === false ? 'Offline' : '...'}
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{levelEmoji} Lv{level}</Text>
          </View>
          {domainTier && domainTier !== 'free' && (
            <VerifiedBadge tier={domainTier as any} size="sm" />
          )}
        </View>
        {heartbeatEnabled && (
          <Text style={styles.statusText}>
            {lastHeartbeat > 0
              ? `Last check: ${formatTimeSince(lastHeartbeat)}`
              : 'Heartbeat active'}
          </Text>
        )}
      </View>

      {/* Quick Action Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsContainer}
        contentContainerStyle={styles.chipsContent}
      >
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.chip}
            onPress={() => handleSend(action.message)}
            disabled={isSending}
          >
            <Text style={styles.chipText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.asciiCat}>{ASCII_CAT}</Text>
            <Text style={styles.welcomeText}>{getWelcomeMessage(agentName)}</Text>
          </View>
        }
        ListFooterComponent={
          isLoading ? (
            <View style={styles.typingContainer}>
              <Text style={styles.typingAvatar}>(=^.^=)</Text>
              <Text style={styles.typingText}>{agentName} is thinking...</Text>
            </View>
          ) : null
        }
      />

      <View style={styles.inputContainer}>
        {/* Agent Park FAB — inline with input */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/park')}
        >
          <Text style={styles.fabText}>{'{~}'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Message ${agentName}...`}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>{isSending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusGreen: {
    backgroundColor: colors.green,
  },
  statusRed: {
    backgroundColor: colors.red,
  },
  statusGray: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  levelBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  levelText: {
    color: colors.teal,
    fontSize: fontSize.xs,
    fontWeight: '600',
    fontFamily: monoFont,
  },
  chipsContainer: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.teal,
    fontSize: fontSize.sm,
    fontFamily: monoFont,
  },
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xl,
  },
  asciiCat: {
    fontSize: 24,
    fontFamily: monoFont,
    color: colors.teal,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 28,
  },
  welcomeText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  typingAvatar: {
    fontSize: 12,
    marginRight: spacing.xs,
    fontFamily: monoFont,
    color: colors.teal,
  },
  typingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  fab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  fabText: {
    fontSize: 12,
    fontFamily: monoFont,
    color: colors.teal,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
