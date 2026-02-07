import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { generateParkPost } from '../../services/api';
import { postMessage } from '../../supabase/agentPark';
import { useMemoryStore } from '../../stores/memoryStore';
import { useWalletStore } from '../../stores/walletStore';
import { addXP } from '../../services/gamification';

interface PostButtonProps {
  agentId: string | null;
  parkContext: string;
  promptType: string;
  label: string;
  onPosted?: () => void;
}

export function PostButton({ agentId, parkContext, promptType, label, onPosted }: PostButtonProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!agentId) {
      Alert.alert('Not Ready', 'Agent profile not initialized yet.');
      return;
    }

    setLoading(true);
    try {
      const { userMemory } = useMemoryStore.getState();
      const { buildWalletContext } = await import('../../services/onChainPortfolio');
      const walletState = (await import('../../stores/walletStore')).useWalletStore.getState();
      const walletContext = walletState.portfolioData ? buildWalletContext(walletState.portfolioData) : '';
      const result = await generateParkPost({
        soul: '',
        memory: userMemory,
        wallet: walletContext,
        park_context: parkContext,
        prompt_type: promptType,
      });
      setPreview(result.content);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate post');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!agentId || !preview) return;

    try {
      await postMessage(agentId, preview, promptType);
      await addXP(2);
      setPreview(null);
      onPosted?.();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to post message');
    }
  };

  const handleCancel = () => {
    setPreview(null);
  };

  if (preview) {
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Preview:</Text>
        <Text style={styles.previewText}>{preview}</Text>
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={handleGenerate}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  previewContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  previewText: {
    color: colors.text,
    fontSize: fontSize.md,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  confirmText: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
