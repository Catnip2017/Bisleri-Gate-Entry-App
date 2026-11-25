// app/admin-hub/AdminHubStyles.js
//
// Theme-aware (30 Oct 2026): was a static StyleSheet, so the Admin Hub
// ("Select an Application" screen) stayed light-mode only regardless of the
// app-wide dark/light toggle. Now a hook, useAdminHubStyles(), re-deriving
// the stylesheet from useTheme(). The legacy header/logout styles below
// (from before this screen moved to the shared AppShell header) are kept
// theme-aware too even though index.js no longer renders them, so nothing
// here regresses if they're ever reused.
import { useMemo } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { useTheme, brand } from '../../contexts/ThemeContext';

export function useAdminHubStyles() {
  const { isDark, colors } = useTheme();

  return useMemo(() => {
    // Page tint used by the header/overlay bands below — a pale cyan in
    // light mode, the theme's muted surface in dark mode.
    const bandBg = isDark ? colors.surfaceMuted : '#E0F7FA';

    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.background,
        // Very faint water-ripple glow behind the hub (web only)
        ...Platform.select({
          web: {
            backgroundImage:
              'radial-gradient(circle at 8% 85%, rgba(0,166,139,0.08) 0, rgba(0,166,139,0) 32%),' +
              'radial-gradient(circle at 92% 70%, rgba(0,166,139,0.07) 0, rgba(0,166,139,0) 30%)',
          },
        }),
      },

      // ── Welcome banner (25 Nov 2026) ───────────────────────────────────────
      banner: {
        width: '100%',
        maxWidth: 1100,
        minHeight: 120,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 28,
        paddingVertical: 22,
        marginBottom: 28,
        overflow: 'hidden',
        ...Platform.select({
          web: {
            boxShadow: '0px 6px 18px rgba(0,96,79,0.08)',

          },
        }),
      },
      bannerNarrow: {
        minHeight: 0,
        paddingHorizontal: 18,
        paddingVertical: 16,
        marginBottom: 20,
      },
      bannerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: brand.navyDark,
      },
      bannerSub: {
        fontSize: 15,
        color: colors.textSecondary,
        marginTop: 6,
      },
      bannerWater: {
        position: 'absolute',
        right: -20,
        bottom: -6,
        width: 460,
        height: 100,
        opacity: 0.6,
      },
      bannerFade: {
        position: 'absolute',
        right: 280,
        top: 0,
        bottom: 0,
        width: 160,
        ...Platform.select({ web: { backgroundImage: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)' } }),
      },

      // ── Header (legacy — AppShell now renders the real header) ──────────────
      header: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: bandBg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        ...Platform.select({
          web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.12)' },
          android: { elevation: 4 },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
          },
        }),
      },
      logo: {
        width: 110,
        height: 48,
      },
      headerRight: {
        alignItems: 'flex-end',
      },
      welcomeText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
      },
      roleText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
      },

      // ── Body ──────────────────────────────────────────────────────────────
      body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 32,
        alignItems: 'center',
      },
      heading: {
        width: '100%',
        maxWidth: 1100,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: colors.textSecondary,
        marginBottom: 14,
      },

      // ── Top-right actions (User Management + Logout) ───────────────────────
      topActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        width: '100%',
        maxWidth: 1700,
        gap: 10,
        marginBottom: 16,
      },
      userMgmtBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: isDark ? 'rgba(214,158,46,0.15)' : '#fffff0',
        borderWidth: 1,
        borderColor: '#d69e2e',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        ...Platform.select({
          web: { cursor: 'pointer' },
        }),
      },
      userMgmtBtnPressed: {
        opacity: 0.7,
      },
      userMgmtBtnText: {
        color: isDark ? '#F0C14B' : '#b7791f',
        fontSize: 13,
        fontWeight: '600',
      },

      // ── Horizontal tile grid ──────────────────────────────────────────────
      // Compact fixed-width tiles flowing left-to-right and wrapping — room
      // for many future applications without redesigning this screen.
      grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 18,
        width: '100%',
        maxWidth: 1100,
      },
      tile: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        width: 200,
        minHeight: 188,
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: 18,
        ...Platform.select({
          web: { boxShadow: '0px 4px 14px rgba(0,96,79,0.08)', cursor: 'pointer', transition: 'transform .15s ease, box-shadow .15s ease' },
          android: { elevation: 5 },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
          },
        }),
      },
      tileHovered: {
        transform: [{ translateY: -3 }],
        borderColor: '#BFDCD2',
        ...Platform.select({ web: { boxShadow: '0px 10px 24px rgba(0,96,79,0.14)' } }),
      },
      tileDisabled: {
        opacity: 0.45,
      },
      tilePressed: {
        opacity: 0.75,
        transform: [{ scale: 0.97 }],
      },

      // accent bar on top of each card (colour set inline per tile)
      tileAccent: {
        borderTopWidth: 4,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      },

      iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
      },
      tileLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
      },
      tileSublabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 4,
      },
      tileFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 'auto',
        paddingTop: 14,
      },
      tileOpen: {
        fontSize: 13,
        fontWeight: '700',
      },

      // ── Logout (legacy) ─────────────────────────────────────────────────────
      logoutBtn: {
        backgroundColor: '#007bff',
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 8,
        ...Platform.select({
          web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.2)', cursor: 'pointer' },
          android: { elevation: 3 },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          },
        }),
      },
      logoutBtnPressed: { backgroundColor: '#4da3ff' },
      logoutText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
      },
    });
  }, [isDark, colors]);
}

export default useAdminHubStyles;
