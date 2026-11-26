// components/ui/KpiCard.js - KPI stat card for insight dashboards.
//
// Look (revised July 2026): DARK brand-green card — white number, pastel
// icon chip that pops against the deep background. Color still encodes
// meaning: the amber emphasized={true} treatment ("action needed", e.g.
// Need completion > 0) is the only non-green card on screen.
//
// onPress is optional; when provided the card behaves as a button
// (tap-to-filter wiring comes later). Without it, the card is static.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { green, colors, radius, spacing, TOUCH_TARGET } from '../../utils/theme';
import { brand } from '../../contexts/ThemeContext';

const AMBER = {
  bg: '#B45309',
  border: '#F59E0B',
  chipBg: '#FAC775',
  icon: '#633806',
  label: '#FDE8C8',
  value: '#FFFFFF',
  caption: '#FAC775',
};

const KpiCard = ({
  label,
  value,
  icon,               // MaterialIcons name
  tint = '#C2DFCE',   // icon chip background (pastel pops on dark green)
  iconColor = '#03301B',
  caption,            // small text next to the number (e.g. "tap to view")
  captionColor,
  emphasized = false, // amber "action needed" treatment
  selected = false,   // active quick-filter state (white ring + lift)
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
              { color: captionColor || (emphasized ? AMBER.caption : 'rgba(255,255,255,0.72)') },
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
    backgroundColor: brand.navy,       // dark-navy brand surface (Aug 2026 scheme)
    borderWidth: 1,
    borderColor: brand.navyDark,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  cardEmphasized: {
    backgroundColor: AMBER.bg,
    borderColor: AMBER.border,
  },
  // Active filter (26 Nov 2026): white ring + a dark outer edge and a lift,
  // so the selected card stands out on the light page. Padding drops by the
  // extra border width so nothing inside moves.
  cardSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.md - 1,
    elevation: 6,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    ...(Platform.OS === 'web' ? {
      boxShadow: `0px 0px 0px 2px ${brand.navyDark}, 0px 6px 16px rgba(0,0,0,0.28)`,
      transform: [{ translateY: -1 }],
    } : {}),
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
    color: '#D7F0E9',                  // light mint tint on the teal surface (25 Nov 2026)
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
    color: '#FFFFFF',
  },
  caption: {
    fontSize: 11,
  },
});

export default KpiCard;
