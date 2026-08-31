// components/ui/AppHeader.js - The ONE merged header, for all pages/roles.
//
// Aug 2026 redesign: the header is a single navy brand band — no more
// separate white top bar + breadcrumb row underneath. It carries, in order:
//   [menu?]  [ back-chip + title ]  ← left cluster (only when provided)
//   [ Bisleri logo ]                ← always centered
//   [ sun/moon toggle ]  [ avatar ] ← right cluster
// The band colour is the brand navy in BOTH light and dark mode; the toggle
// only changes the page body around it (see contexts/ThemeContext.js).
import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const AppHeader = ({ onMenuPress, rightSlot, backLabel, title, onBack }) => {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBgEnd }]}>
      <View style={styles.row}>
        {onMenuPress ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onMenuPress}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <MaterialIcons name="menu" size={24} color={colors.headerText} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}

        <Image
          source={require('../../assets/images/bisleri-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.rightCluster}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleTheme}
            accessibilityRole="button"
            accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={22} color={colors.headerText} />
          </TouchableOpacity>
          {rightSlot || <View style={styles.iconButton} />}
        </View>
      </View>

      {/* Merged breadcrumb/title row — same navy band, no seam */}
      {(backLabel || title) && (
        <View style={styles.crumbRow}>
          {backLabel ? (
            <TouchableOpacity
              style={styles.backChip}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={`Back to ${backLabel}`}
            >
              <Text style={styles.backChipText}>← {backLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 110,
    height: 36,
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  backChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  backChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default AppHeader;
