// app/admin-hub/user-management/UserManagementStyles.js
import { StyleSheet, Platform } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    height: 52,
    backgroundColor: '#E0F7FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
    ...Platform.select({
      web:     { boxShadow: '0px 2px 4px rgba(0,0,0,0.08)' },
      android: { elevation: 3 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
    }),
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 90,
  },
  backText: { fontSize: 14, color: '#1a365d', fontWeight: '500' },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#1a365d' },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 10,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1976d2',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1976d2',
    fontWeight: '600',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  screenContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  denied: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});
