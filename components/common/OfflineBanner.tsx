import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../../constants/theme';

interface OfflineBannerProps {
  onRetry?: () => void;
}

export function OfflineBanner({ onRetry }: OfflineBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline — check server connection</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>[retry]</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#3D3000',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    color: '#FFD700',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
  },
  retryText: {
    color: '#FFD700',
    fontSize: fontSize.xs,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
