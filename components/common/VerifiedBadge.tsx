import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { colors, spacing, fontSize as themeFontSize, borderRadius } from '../../constants/theme';

interface VerifiedBadgeProps {
  tier: 'og' | 'premium' | 'standard' | 'free';
  size?: 'sm' | 'md' | 'lg';
}

const TIER_CONFIG = {
  og: { emoji: '\u{1F451}', color: '#FFD700', label: 'OG .os Agent' },
  premium: { emoji: '\u{1F48E}', color: '#C77DFF', label: 'Premium .os Agent' },
  standard: { emoji: '\u2705', color: '#1DA1F2', label: 'Verified .os Agent' },
  free: { emoji: '', color: 'transparent', label: '' },
};

const SIZE_CONFIG = {
  sm: { badge: 14, font: 9, tooltip: themeFontSize.xs },
  md: { badge: 18, font: 11, tooltip: themeFontSize.xs },
  lg: { badge: 24, font: 14, tooltip: themeFontSize.sm },
};

export function VerifiedBadge({ tier, size = 'sm' }: VerifiedBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (tier === 'free' || !tier) return null;

  const config = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <Pressable onPress={() => setShowTooltip(!showTooltip)} style={styles.wrapper}>
      <View style={[styles.badge, { width: sizeConfig.badge, height: sizeConfig.badge, backgroundColor: config.color + '22', borderColor: config.color }]}>
        <Text style={{ fontSize: sizeConfig.font, lineHeight: sizeConfig.badge }}>{config.emoji}</Text>
      </View>
      {showTooltip && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{config.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginLeft: 3,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: -28,
    left: -20,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  tooltipText: {
    color: colors.text,
    fontSize: themeFontSize.xs,
  },
});
