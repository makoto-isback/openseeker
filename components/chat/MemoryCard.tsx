import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

interface MemoryCardProps {
  data: any;
  skill: string;
}

export function MemoryCard({ data, skill }: MemoryCardProps) {
  switch (skill) {
    case 'my_memory':
      return <ShowMemoryCard data={data} />;
    case 'remember_this':
      return <RememberCard data={data} />;
    case 'forget_this':
      return <ForgetCard data={data} />;
    case 'daily_recap':
      return <DailyRecapCard data={data} />;
    case 'weekly_recap':
      return <WeeklyRecapCard data={data} />;
    default:
      return null;
  }
}

function ShowMemoryCard({ data }: { data: any }) {
  const categories = data?.categories || [];
  const memories = data?.memories || {};
  const total = data?.total || 0;

  return (
    <View style={[styles.card, { borderLeftColor: '#E056A0' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Agent Brain</Text>
        <Text style={[styles.cardBadge, { color: '#E056A0' }]}>MEMORY</Text>
      </View>
      <Text style={styles.totalText}>{total} facts stored</Text>

      {categories.length === 0 ? (
        <Text style={styles.emptyText}>No memories yet. Chat more and I'll learn about you!</Text>
      ) : (
        categories.map((cat: string) => (
          <View key={cat} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{cat.toUpperCase()}</Text>
            {(memories[cat] || []).slice(0, 5).map((mem: any) => (
              <View key={mem.id} style={styles.memoryRow}>
                <View style={[styles.confidenceDot, { opacity: mem.confidence || 0.8 }]} />
                <Text style={styles.memoryText} numberOfLines={2}>{mem.content}</Text>
              </View>
            ))}
            {(memories[cat] || []).length > 5 && (
              <Text style={styles.moreText}>+{(memories[cat] || []).length - 5} more</Text>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function RememberCard({ data }: { data: any }) {
  const isError = data?.action === 'memory_error' || data?.action === 'remember_error';

  return (
    <View style={[styles.card, { borderLeftColor: isError ? colors.red : '#00d4aa' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{isError ? 'Memory Error' : 'Memory Saved'}</Text>
        <Text style={[styles.cardBadge, { color: '#00d4aa' }]}>BRAIN</Text>
      </View>
      {isError ? (
        <Text style={styles.errorText}>{data?.error || 'Failed to save memory'}</Text>
      ) : (
        <>
          <Text style={styles.factText}>"{data?.fact}"</Text>
          <Text style={styles.metaText}>Category: {data?.category || 'general'}</Text>
        </>
      )}
    </View>
  );
}

function ForgetCard({ data }: { data: any }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#FF6B6B' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Memory Forgotten</Text>
        <Text style={[styles.cardBadge, { color: '#FF6B6B' }]}>BRAIN</Text>
      </View>
      <Text style={styles.metaText}>
        Searched: "{data?.search_term}"
      </Text>
      <Text style={styles.factText}>
        {data?.deleted_count > 0
          ? `Removed ${data.deleted_count} memory(s)`
          : 'No matching memories found'}
      </Text>
    </View>
  );
}

function DailyRecapCard({ data }: { data: any }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#FFB800' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Daily Recap</Text>
        <Text style={[styles.cardBadge, { color: '#FFB800' }]}>TODAY</Text>
      </View>
      <Text style={styles.dateText}>{data?.date || 'Today'}</Text>
      <Text style={styles.totalText}>{data?.events_count || 0} events logged</Text>

      {data?.summary && (
        <Text style={styles.summaryText}>{data.summary}</Text>
      )}

      {data?.events?.slice(-5).map((event: any, i: number) => (
        <View key={i} style={styles.eventRow}>
          <Text style={styles.eventType}>[{event.type}]</Text>
          <Text style={styles.eventContent} numberOfLines={1}>{event.content}</Text>
        </View>
      ))}
    </View>
  );
}

function WeeklyRecapCard({ data }: { data: any }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#9B59B6' }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Weekly Recap</Text>
        <Text style={[styles.cardBadge, { color: '#9B59B6' }]}>WEEK</Text>
      </View>
      <Text style={styles.totalText}>
        {data?.days_active || 0} active days | {data?.total_events || 0} events
      </Text>

      {data?.recap && (
        <Text style={styles.summaryText}>{data.recap}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: '#E056A0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardBadge: {
    color: '#E056A0',
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  totalText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  categorySection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryTitle: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
    gap: spacing.xs,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00d4aa',
    marginTop: 5,
  },
  memoryText: {
    color: colors.text,
    fontSize: fontSize.sm,
    flex: 1,
  },
  moreText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: 2,
  },
  factText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  errorText: {
    color: colors.red,
    fontSize: fontSize.sm,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  summaryText: {
    color: colors.text,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: spacing.xs,
  },
  eventType: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '600',
    width: 80,
  },
  eventContent: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    flex: 1,
  },
});
