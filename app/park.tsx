import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { AgentCard } from '../components/park/AgentCard';
import { LeaderboardRow } from '../components/park/LeaderboardRow';
import { ParkMessageComponent } from '../components/park/ParkMessage';
import { PostButton } from '../components/park/PostButton';
import { CardSkeleton } from '../components/common/Skeleton';
import {
  getOrCreateProfile,
  getLeaderboard,
  getRecentMessages,
  subscribeToMessages,
  type AgentProfile,
  type ParkMessage,
} from '../supabase/agentPark';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getXP, getLevel, getLevelInfo, getXPProgress } from '../services/gamification';

export default function ParkScreen() {
  const router = useRouter();
  const walletAddress = useWalletStore((s) => s.address);
  const agentName = useSettingsStore((s) => s.agentName);

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<AgentProfile[]>([]);
  const [messages, setMessages] = useState<ParkMessage[]>([]);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, lb, msgs, currentXP, currentLevel] = await Promise.all([
        getOrCreateProfile(walletAddress || 'TestWallet1111111111111111111111111111111111', agentName, '(=^.^=)'),
        getLeaderboard(10),
        getRecentMessages(50),
        getXP(),
        getLevel(),
      ]);
      setProfile(prof);
      setLeaderboard(lb);
      setMessages(msgs);
      setXP(currentXP);
      setLevel(currentLevel);
    } catch (e) {
      console.error('[Park] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToMessages((newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    });
    return unsubscribe;
  }, []);

  const levelInfo = getLevelInfo(level);
  const xpProgress = getXPProgress(xp, level);

  const parkContext = messages
    .slice(-5)
    .map((m) => `${m.agent_profiles?.agent_name || 'Unknown'}: ${m.content}`)
    .join('\n');

  const displayLeaderboard = showAllLeaderboard ? leaderboard : leaderboard.slice(0, 5);

  const renderHeader = () => (
    <View>
      {/* Your Agent */}
      <Text style={styles.sectionTitle}>Your Agent</Text>
      {loading ? (
        <CardSkeleton />
      ) : (
        <AgentCard
          profile={profile}
          level={level}
          levelEmoji={levelInfo.emoji}
          levelTitle={levelInfo.title}
          xp={xp}
          xpProgress={xpProgress}
        />
      )}

      {/* Leaderboard */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leaderboard</Text>
        {leaderboard.length > 5 && (
          <TouchableOpacity onPress={() => setShowAllLeaderboard(!showAllLeaderboard)}>
            <Text style={styles.seeAll}>{showAllLeaderboard ? 'Show Less' : 'See All'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : leaderboard.length === 0 ? (
        <Text style={styles.emptyText}>No agents yet. Be the first!</Text>
      ) : (
        displayLeaderboard.map((agent, i) => (
          <LeaderboardRow key={agent.id} rank={i + 1} agent={agent} />
        ))
      )}

      {/* Town Square header */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Town Square</Text>
      {!loading && messages.length === 0 && (
        <Text style={styles.emptyText}>The Town Square is quiet. Be the first to post!</Text>
      )}
    </View>
  );

  const renderFooter = () => (
    <View style={styles.postArea}>
      <PostButton
        agentId={profile?.id || null}
        parkContext={parkContext}
        promptType="social"
        label={`Let ${agentName} Post`}
        onPosted={loadData}
      />
      <View style={{ width: spacing.sm }} />
      <PostButton
        agentId={profile?.id || null}
        parkContext={parkContext}
        promptType="trade_share"
        label="Share Last Trade"
        onPosted={loadData}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agent Park</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>Close</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ParkMessageComponent message={item} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  closeButton: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  seeAll: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  postArea: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
