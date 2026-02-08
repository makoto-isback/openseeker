import { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { formatTime } from '../../utils/formatters';
import { SkillCard } from './SkillCard';
import { TerminalText } from './TerminalText';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Message } from '../../services/memory';

// Error/system messages that should not animate
const SKIP_ANIMATION_PREFIXES = [
  'Something went wrong',
  'Request timed out',
  'Insufficient credits',
  'Payment required',
  'Cannot reach server',
  'Daily spend limit',
  'Too many requests',
  'To enable trading',
  'Agent Wallet Agreement',
];

function shouldAnimate(message: Message): boolean {
  if (message.role !== 'assistant') return false;
  if (!message.isNew) return false;
  if (!message.content || message.content.length === 0) return false;
  // Skip error/system messages
  const trimmed = message.content.trim();
  return !SKIP_ANIMATION_PREFIXES.some((p) => trimmed.startsWith(p));
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const agentName = useSettingsStore((s) => s.agentName);
  const [textDone, setTextDone] = useState(!shouldAnimate(message));

  const animate = shouldAnimate(message) && !textDone;
  const showSkillCards = textDone || isUser;

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatarRow}>
          <Text style={styles.avatar}>(=^.^=)</Text>
          <Text style={styles.agentName}>{agentName}</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {/* Message text — animated for new AI messages */}
        {!isUser && animate ? (
          <TerminalText
            text={message.content}
            speed={20}
            onComplete={() => setTextDone(true)}
            style={styles.assistantText}
          />
        ) : (
          <Text style={[styles.content, isUser ? styles.userText : styles.assistantText]}>
            {message.content}
          </Text>
        )}

        {/* Skill cards appear after text animation completes */}
        {showSkillCards && !isUser && message.skillResults?.map((sr, i) => (
          <SkillCard
            key={i}
            skill={sr.skill}
            success={sr.success}
            data={sr.data}
            error={sr.error}
          />
        ))}

        <View style={styles.footerRow}>
          {!isUser && message.x402 && (
            <Text style={styles.x402Status}>
              {message.x402.free
                ? `Free (${message.x402.freeRemaining ?? '?'} left)`
                : message.x402.amount
                  ? `$${(parseInt(message.x402.amount) / 1_000_000).toFixed(4)} USDC`
                  : 'Paid'
              }
            </Text>
          )}
          <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    marginLeft: spacing.xs,
  },
  avatar: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    color: colors.teal,
  },
  agentName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: borderRadius.sm,
  },
  assistantBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: borderRadius.sm,
  },
  content: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  userText: {
    color: colors.text,
  },
  assistantText: {
    color: colors.text,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  x402Status: {
    fontSize: 10,
    color: colors.textMuted,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
});
