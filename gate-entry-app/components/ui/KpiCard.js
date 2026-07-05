// components/ui/KpiCard.js - KPI stat card for insight dashboards.
//
// Design (chosen July 2026): white card, tinted icon chip, muted label,
// large number. Color encodes MEANING only:
//  - normal cards stay white regardless of value
//  - emphasized={true} (e.g. "Need completion" > 0) renders the amber
//    "action needed" treatment — the only colored card on screen
//
// onPress is optional; when provided the card behaves as a button
// (tap-to-filter wiring comes later). Without it, the card is static.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing, TOUCH_TARGET } from '../../utils/theme';

const AMBER = {
  bg: '#FAEEDA',
  border: '#EF9F27',
  chipBg: '#FAC775',
  icon: '#633806',
  label: '#854F0B',
  value: '#633806',
  caption: '#854F0B',
};

const KpiCard = ({
  label,
  value,
  icon,               // MaterialIcons name
  tint = '#E1F5EE',   // icon chip background
  iconColor = '#0F6E56',
  caption,            // small text next to the number (e.g. "tap to view")
  captionColor,
  emphasized = false, // amber "action needed" treatment
  selected = false,   // active quick-filter state (future use)
  onPress,
}) => {
  const displayValue =
    typeof value === 'number' ? value.toLocaleString() : (value ?? '—');

  const body = (
    <>
      <View style={styles.headerRow}>
        <View style={[styles.iconChip, { backgroundColor: emphasized ? AMBER.chipBg : tint }]}>
          <MaterialIcons
            name={icon}
            size={16}
            color={emphasized ? AMBER.icon : iconColor}
          />
        </View>
        <Text
          style={[styles.label, emphasized && { color: AMBER.label }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, emphasized && { color: AMBER.value }]}>
          {displayValue}
        </Text>
        {caption ? (
          <Text
            style={[
              styles.caption,
              { color: captionColor || (emphasized ? AMBER.caption : colors.textMuted) },
            ]}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </>
  );

  const cardStyle = [
    styles.card,
    emphasized && styles.cardEmphasized,
    selected && styles.cardSelected,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayValue}`}
        accessibilityState={{ selected }}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={`${label}: ${displayValue}`}>
      {body}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    minHeight: TOUCH_TARGET + 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  cardEmphasized: {
    backgroundColor: AMBER.bg,
    borderColor: AMBER.border,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  value: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 11,
  },
});

export default KpiCard;
