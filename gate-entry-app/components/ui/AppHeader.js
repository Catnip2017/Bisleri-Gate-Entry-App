// components/ui/AppHeader.js - The ONE merged header, for all pages/roles.
//
// 25 Nov 2026 UI overhaul (Bisleri look, from the Inventory portal wireframe):
//   Wide screens (web >= 900px) — a thicker 76px teal-gradient band:
//     [ ☰ ][ Bisleri logo / OPS HUB ] | [ ← back-chip ][ Page title ]   ~water~ [ account pill ]
//   Narrow screens / phones — the slim 58px band, logo + menu + avatar only
//   (title, water image and the OPS HUB caption are hidden to save space).
// Props are unchanged (rightSlot, backLabel, title, onBack, onMenuPress), so
// every screen using AppShell picks this up without any change of its own.
import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, brand } from '../../contexts/ThemeContext';

export const WIDE_BREAKPOINT = 900;

const AppHeader = ({ rightSlot, backLabel, title, onBack, onMenuPress, hideBrand = false }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <View style={[
      styles.header,
      wide ? styles.headerWide : styles.headerNarrow,
      { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBgEnd },
      // Teal gradient band (wireframe). Web only; native falls back to solid teal.
      Platform.OS === 'web' ? { backgroundImage: brand.headerGradient } : null,
    ]}>
      {/* Decorative water splash on the right of the band (wide web only) */}
      {wide ? (
        <Image
          source={require('../../assets/images/header-water.png')}
          style={styles.water}
          resizeMode="cover"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {/* Soft fades so the splash melts into the band instead of ending in a hard edge */}
      {wide && Platform.OS === 'web' ? (
        <>
          <View pointerEvents="none" style={[styles.fade, { right: 450, backgroundImage: 'linear-gradient(90deg, rgba(0,183,156,1) 0%, rgba(0,183,156,0) 100%)' }]} />
          <View pointerEvents="none" style={[styles.fade, { right: 150, backgroundImage: 'linear-gradient(90deg, rgba(0,193,165,0) 0%, rgba(0,196,167,1) 100%)' }]} />
        </>
      ) : null}

      <View style={styles.row}>
        {/* Left cluster — menu, logo, then back-chip + page title */}
        <View style={styles.leftCluster}>
          {onMenuPress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onMenuPress}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <MaterialIcons name="menu" size={26} color={colors.headerText} />
            </TouchableOpacity>
          ) : null}

          {/* Logo lives in the fixed sidebar on desktop web (hideBrand) */}
          {!hideBrand ? (
          <View style={styles.brandBlock} accessibilityRole="header" accessibilityLabel="Bisleri Ops Hub">
            <Image
              source={require('../../assets/images/bisleri-logo-white.png')}
              style={wide ? styles.logoWide : styles.logoNarrow}
              resizeMode="contain"
            />
            {wide ? <Text style={styles.brandSub}>OPS HUB</Text> : null}
          </View>
          ) : <View style={{ width: 12 }} />}

          {wide && !hideBrand && (backLabel || title) ? <View style={styles.divider} /> : null}

          {backLabel ? (
            <TouchableOpacity
              style={styles.backChip}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={backLabel === 'Back' ? 'Back' : `Back to ${backLabel}`}
            >
              <MaterialIcons name="arrow-back" size={16} color={brand.navyDark} />
              <Text style={styles.backChipText} numberOfLines={1}>{backLabel}</Text>
            </TouchableOpacity>
          ) : null}

          {title ? (
            <Text style={wide ? styles.titleWide : styles.titleNarrow} numberOfLines={1}>{title}</Text>
          ) : null}
        </View>

        {/* Right cluster — account pill / avatar (dark-mode toggle removed 25 Nov 2026) */}
        <View style={styles.rightCluster}>
          {rightSlot || <View style={styles.iconButton} />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    zIndex: 5,
  },
  headerWide: { minHeight: 76 },
  headerNarrow: { minHeight: 58 },
  water: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 150,
    width: 420,
    opacity: 0.85,
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  leftCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: 2,
  },
  logoWide: {
    width: 138,
    height: 46,
  },
  logoNarrow: {
    width: 96,
    height: 36,
  },
  brandSub: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: -2,
    marginLeft: 4,
    opacity: 0.92,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 14,
  },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // 25 Nov 2026: solid white pill + deep-teal text — was translucent and
    // hard to see against the teal band.
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,96,79,0.15)',
    ...Platform.select({ web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.12)' } }),
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: 17,
    maxWidth: 170,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  backChipText: {
    color: brand.navyDark,
    fontWeight: '600',
    fontSize: 13,
  },
  titleWide: {
    flexShrink: 1,
    marginLeft: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    ...Platform.select({ web: { textShadow: '0px 1px 2px rgba(0,0,0,0.15)' } }),
  },
  titleNarrow: {
    flexShrink: 1,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AppHeader;
