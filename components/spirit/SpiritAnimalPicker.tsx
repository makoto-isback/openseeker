import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { SpiritAnimal } from './SpiritAnimal';
import { ANIMAL_LIST, ANIMAL_COLORS, ANIMAL_LABELS } from './animals';
import type { AnimalType } from './animals';

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });

interface SpiritAnimalPickerProps {
  agentName: string;
  onSelect: (animal: AnimalType) => void;
  onSkip?: () => void;
}

export function SpiritAnimalPicker({ agentName, onSelect, onSkip }: SpiritAnimalPickerProps) {
  const [selected, setSelected] = useState<AnimalType>('dragon');
  const selectedColor = ANIMAL_COLORS[selected];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.verifiedBadge}>{'\u28FF'} .OS VERIFIED {'\u28FF'}</Text>
        <Text style={styles.title}>Choose Your Spirit</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {agentName}.os is alive
        </Text>

        {/* 2-column grid */}
        <View style={styles.grid}>
          {ANIMAL_LIST.map((animal) => {
            const isSelected = animal === selected;
            const animalColor = ANIMAL_COLORS[animal];
            return (
              <TouchableOpacity
                key={animal}
                style={[
                  styles.card,
                  isSelected && { borderColor: animalColor, backgroundColor: animalColor + '15' },
                ]}
                onPress={() => setSelected(animal)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <SpiritAnimal
                    animal={animal}
                    size="mini"
                    animated={isSelected}
                  />
                </View>
                <View style={styles.cardLabel}>
                  {isSelected && <View style={[styles.selectedDot, { backgroundColor: animalColor }]} />}
                  <Text style={[styles.cardText, isSelected && { color: animalColor }]}>
                    {ANIMAL_LABELS[animal]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Full-size preview */}
        <View style={styles.previewSection}>
          <Text style={[styles.previewLabel, { color: selectedColor }]}>
            {ANIMAL_LABELS[selected]}
          </Text>
          <View style={[styles.previewBox, { borderColor: selectedColor + '40' }]}>
            <SpiritAnimal
              animal={selected}
              size="full"
              animated={true}
              showLabel={false}
            />
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: selectedColor }]}
          onPress={() => onSelect(selected)}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>
            Bond with {ANIMAL_LABELS[selected]}
          </Text>
        </TouchableOpacity>

        {/* Skip button */}
        {onSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>Choose later</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
    alignItems: 'center',
  },
  verifiedBadge: {
    fontFamily: monoFont,
    fontSize: fontSize.sm,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: 2,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    fontFamily: monoFont,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    width: '100%',
  },
  card: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  cardContent: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  cardText: {
    fontFamily: monoFont,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    width: '100%',
  },
  previewLabel: {
    fontFamily: monoFont,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  confirmButton: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  confirmText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.background,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});
