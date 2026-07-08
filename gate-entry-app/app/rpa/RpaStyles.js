// app/rpa/RpaStyles.js
import { StyleSheet, Platform } from 'react-native';
import { BACKGROUND_PRIMARY } from '../../utils/platformColors';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_PRIMARY,
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
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.08)' },
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
  backText: {
    fontSize: 14,
    color: '#1a365d',
    fontWeight: '500',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a365d',
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a365d',
    marginBottom: 6,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 28,
    textAlign: 'center',
  },

  // ── Domain grid ───────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 480,
  },
  domainTile: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    width: '46%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 3px 8px rgba(0,0,0,0.10)',
        // cursor is set per-tile in index.js: 'pointer' for live domains,
        // 'not-allowed' only for coming-soon tiles.
      },
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
      },
    }),
  },
  domainTilePressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  domainLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2d3748',
    textAlign: 'center',
  },
  comingSoonBadge: {
    marginTop: 6,
    backgroundColor: '#edf2f7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 10,
    color: '#a0aec0',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default styles;
