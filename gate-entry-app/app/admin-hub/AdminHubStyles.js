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
import { useTheme } from '../../contexts/ThemeContext';

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
        alignItems: 'center',
      },
      heading: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 28,
        textAlign: 'center',
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
        justifyContent: 'center',
        gap: 16,
        width: '100%',
        maxWidth: 1100,
      },
      tile: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        width: 185,
        minHeight: 170,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        ...Platform.select({
          web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.12)', cursor: 'pointer' },
          android: { elevation: 5 },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
          },
        }),
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
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
      },
      tileLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
      },
      tileSublabel: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 4,
        textAlign: 'center',
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
