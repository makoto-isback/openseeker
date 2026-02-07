import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { formatTime } from '../../utils/formatters';
import { SkillCard } from './SkillCard';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Message } from '../../services/memory';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const agentName = useSettingsStore((s) => s.agentName);

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatarRow}>
          <Text style={styles.avatar}>(=^.^=)</Text>
          <Text style={styles.agentName}>{agentName}</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.content, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
        {/* Render skill cards for assistant messages */}
        {!isUser && message.skillResults?.map((sr, i) => (
          <SkillCard
            key={i}
            skill={sr.skill}
            success={sr.success}
            data={sr.data}
            error={sr.error}
          />
        ))}
        <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
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
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
});
