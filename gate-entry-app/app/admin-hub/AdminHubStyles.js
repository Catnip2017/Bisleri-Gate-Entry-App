// app/admin-hub/AdminHubStyles.js
import { StyleSheet, Platform } from 'react-native';
import { BACKGROUND_PRIMARY } from '../../utils/platformColors';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_PRIMARY,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#E0F7FA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
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
    color: '#1a365d',
  },
  roleText: {
    fontSize: 12,
    color: '#4a5568',
    marginTop: 2,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a365d',
    marginBottom: 28,
    textAlign: 'center',
  },

  // ── Top-right actions (User Management + Logout) ───────────────────────────
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
    backgroundColor: '#fffff0',
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
    color: '#b7791f',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Horizontal tile grid ──────────────────────────────────────────────────
  // Compact fixed-width tiles flowing left-to-right and wrapping — room for
  // many future applications without redesigning this screen.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 1100,
  },
  tile: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ebf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
  },
  tileSublabel: {
    fontSize: 11,
    color: '#a0aec0',
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Logout ────────────────────────────────────────────────────────────────
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

export default styles;
