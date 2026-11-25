// app/LoginScreen_Styles.js - Login page styles.
// 25 Nov 2026 UI overhaul: teal brand band (logo + OPS HUB + water splash),
// then a rounded card — bottle visual on the left (wide screens), sign-in
// form on the right. Labels sit ABOVE the inputs (easier to scan on phones).
import { StyleSheet, Platform } from 'react-native';

const shadow = (web, ios, android) => Platform.select({
  web: { boxShadow: web },
  ios,
  android: { elevation: android },
});

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#EEF5F2',
  },

  // ── Brand band ──────────────────────────────────────────────────────────
  band: {
    backgroundColor: '#00A68B',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bandWide: { height: 92, paddingHorizontal: 36 },
  bandNarrow: { height: 72, paddingHorizontal: 18 },
  bandWater: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 40,
    width: 480,
    opacity: 0.85,
  },
  bandFade: { position: 'absolute', top: 0, bottom: 0, width: 120 },
  bandBrand: { alignItems: 'flex-start' },
  bandLogoWide: { width: 160, height: 54 },
  bandLogoNarrow: { width: 118, height: 40 },
  bandSub: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginTop: -2,
    marginLeft: 4,
  },

  // ── Card ────────────────────────────────────────────────────────────────
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E9E5',
    overflow: 'hidden',
    ...shadow('0px 12px 32px rgba(0,96,79,0.12)',
      { shadowColor: '#00604F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16 }, 6),
  },
  cardWide: {
    maxWidth: 940,
    flexDirection: 'row',
    minHeight: 480,
  },
  visualPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCFDFD',
    borderRightWidth: 1,
    borderRightColor: '#EEF3F1',
    padding: 20,
  },
  bottle: {
    width: 380,
    height: 440,
    maxWidth: '100%',
  },
  formPane: {
    padding: 28,
    justifyContent: 'center',
  },
  formPaneWide: {
    flex: 1,
    paddingHorizontal: 48,
  },

  // ── Text ────────────────────────────────────────────────────────────────
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00604F',
  },
  subtitle: {
    fontSize: 15,
    color: '#5B6B75',
    marginTop: 6,
    marginBottom: 26,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#12202A',
    marginBottom: 6,
    marginTop: 14,
  },

  // ── Inputs ──────────────────────────────────────────────────────────────
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CFDDD7',
    borderRadius: 10,
    paddingVertical: 13,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#12202A',
    minHeight: 50,
  },
  eye: {
    position: 'absolute',
    right: 0,
    height: '100%',
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Button + hint ───────────────────────────────────────────────────────
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  buttonShadow: shadow('0px 4px 12px rgba(15,107,70,0.28)',
    { shadowColor: '#0F6B46', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6 }, 4),
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  hint: {
    fontSize: 12.5,
    color: '#5B6B75',
    textAlign: 'center',
    flexShrink: 1,
  },
});

export default styles;
