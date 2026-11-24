import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GamificationProfile } from '@ridefood/types';
import { defaultTheme } from '@ridefood/config';

export interface GamificationCardProps {
  profile: GamificationProfile;
  showBadges?: boolean;
}

export function GamificationCard({ profile, showBadges = true }: GamificationCardProps) {
  const unlocked = profile.badges.filter((b) => b.unlockedAt);
  const locked = profile.badges.filter((b) => !b.unlockedAt);

  return (
    <View style={[styles.card, defaultTheme.shadow(2)]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.level}>Level {profile.level}</Text>
          <Text style={styles.title}>{profile.levelTitle}</Text>
        </View>
        <Text style={styles.xp}>{profile.xp.toLocaleString()} XP</Text>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, profile.xpProgressPercent)}%` }]} />
      </View>
      <Text style={styles.next}>
        {profile.xpToNextLevel.toLocaleString()} XP to next level
      </Text>

      {showBadges ? (
        <View style={styles.badges}>
          {unlocked.map((b) => (
            <View key={b.id} style={[styles.badge, styles.badgeUnlocked]}>
              <Text style={styles.badgeText}>{b.name}</Text>
            </View>
          ))}
          {locked.slice(0, 4).map((b) => (
            <View key={b.id} style={[styles.badge, styles.badgeLocked]}>
              <Text style={styles.badgeTextLocked}>{b.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: defaultTheme.colors.surface,
    borderRadius: defaultTheme.radii.lg,
    padding: defaultTheme.spacing.md,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  level: {
    color: defaultTheme.colors.primary,
    fontWeight: defaultTheme.typography.weights.bold,
    fontSize: defaultTheme.typography.sizes.sm,
  },
  title: {
    color: defaultTheme.colors.text,
    fontSize: defaultTheme.typography.sizes.xl,
    fontWeight: defaultTheme.typography.weights.bold,
  },
  xp: {
    color: defaultTheme.colors.textMuted,
    fontWeight: defaultTheme.typography.weights.semibold,
  },
  barTrack: {
    marginTop: defaultTheme.spacing.md,
    height: 10,
    borderRadius: defaultTheme.radii.pill,
    backgroundColor: defaultTheme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: defaultTheme.colors.primary,
    borderRadius: defaultTheme.radii.pill,
  },
  next: {
    marginTop: defaultTheme.spacing.xs,
    color: defaultTheme.colors.textMuted,
    fontSize: defaultTheme.typography.sizes.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: defaultTheme.spacing.sm,
    marginTop: defaultTheme.spacing.md,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: defaultTheme.radii.pill,
  },
  badgeUnlocked: { backgroundColor: defaultTheme.colors.bidHighlight },
  badgeLocked: {
    backgroundColor: defaultTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
  },
  badgeText: {
    color: defaultTheme.colors.primary,
    fontSize: defaultTheme.typography.sizes.xs,
    fontWeight: '600',
  },
  badgeTextLocked: {
    color: defaultTheme.colors.textMuted,
    fontSize: defaultTheme.typography.sizes.xs,
  },
});
