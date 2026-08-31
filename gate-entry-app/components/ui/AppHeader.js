// components/ui/AppHeader.js - The ONE merged header, for all pages/roles.
//
// Aug 2026 redesign: a single navy brand band, one line. The back-chip (when
// present) sits on the left of the SAME row as the logo — not on a row
// underneath. The logo is centered via absolute positioning so it stays put
// regardless of how wide the left/right clusters are.
//   [ back-chip ]              [ Bisleri logo ]              [ toggle ][ avatar ]
// The band colour is the brand navy in BOTH light and dark mode; the toggle
// only changes the page body around it (see contexts/ThemeContext.js).
import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const AppHeader = ({ rightSlot, backLabel, title, onBack }) => {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBgEnd }]}>
      <View style={styles.row}>
        {/* Left cluster — back-chip (+ optional title underline), or an
            empty spacer so the centered logo stays centered either way. */}
        <View style={styles.sideCluster}>
          {backLabel ? (
            <TouchableOpacity
              style={styles.backChip}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={`Back to ${backLabel}`}
            >
              <Text style={styles.backChipText} numberOfLines={1}>← {backLabel}</Text>
              {title ? <Text style={styles.backChipTitle} numberOfLines={1}>{title}</Text> : null}
            </TouchableOpacity>
          ) : title ? (
            <Text style={styles.titleOnly} numberOfLines={1}>{title}</Text>
          ) : null}
        </View>

        {/* Logo — absolutely centered on the row, independent of cluster widths */}
        <View style={styles.logoWrap} pointerEvents="none">
          <Image
            source={require('../../assets/images/bisleri-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Right cluster — theme toggle + avatar */}
        <View style={[styles.sideCluster, styles.rightCluster]}>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 56,
  },
  sideCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  rightCluster: {
    justifyContent: 'flex-end',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logo: {
    width: 120,
    height: 44,
  },
  backChip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: 150,
  },
  backChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  backChipTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.8,
    marginTop: 1,
  },
  titleOnly: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default AppHeader;
