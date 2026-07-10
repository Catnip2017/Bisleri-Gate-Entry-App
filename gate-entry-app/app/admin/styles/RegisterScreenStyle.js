import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f4f6f8',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },

  // ── Auth badge ─────────────────────────────────────────────────────────────
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#f3e5f5',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#ce93d8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  authBadgeText: { fontSize: 13, color: '#6a1b9a', fontWeight: '700' },
  authBadgeNote: { fontSize: 12, color: '#9c27b0' },

  // ── TOP ROW: role panel | divider | details panel ──────────────────────────
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
  },

  // Role panel (fixed width, short)
  rolePanel: {
    width: 200,
    flexShrink: 0,
    paddingRight: 20,
  },

  // Personal details panel (fills remaining space)
  detailsPanel: {
    flex: 1,
    paddingLeft: 20,
  },

  // Vertical divider
  vDivider: {
    width: 1,
    backgroundColor: '#e8e8e8',
    alignSelf: 'stretch',
  },

  // Horizontal divider (between top row and scope section)
  hDivider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginVertical: 20,
  },

  // ── Section title ──────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 2,
  },

  // ── Role buttons ───────────────────────────────────────────────────────────
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    marginBottom: 6,
  },
  roleBtnActive: {
    borderColor: '#1976d2',
    backgroundColor: '#e8f1fb',
  },
  roleBtnDisabled: {
    borderColor: '#eee',
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  roleCheck: {
    width: 15, height: 15,
    borderRadius: 3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  roleCheckCircle: { borderRadius: 8 },
  roleCheckTick: { color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 11 },
  roleBtnText: { fontSize: 13, fontWeight: '500', color: '#555', flex: 1 },
  roleBtnTextActive: { color: '#1565c0', fontWeight: '600' },
  roleBtnTextDisabled: { color: '#bbb' },
  exclusiveTag: { fontSize: 10, marginLeft: 2 },

  itAdminNote: {
    marginTop: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 7,
    padding: 10,
  },
  itAdminNoteText: { fontSize: 11, color: '#1565c0', lineHeight: 16 },

  // ── Form fields (right panel) ──────────────────────────────────────────────
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 14,
    fontSize: 14,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#efefef',
    color: '#888',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: { flex: 1 },

  // ── Register button ────────────────────────────────────────────────────────
  registerButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    elevation: 2,
  },
  registerButtonDisabled: { backgroundColor: '#b0bec5', elevation: 0 },
  registerText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Scope row (bottom, full-width) ─────────────────────────────────────────
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
  },
  scopeBlock: {
    flex: 1,
  },

  copackerNote: {
    fontSize: 12,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    lineHeight: 17,
  },

  // ── Warehouse dropdown ─────────────────────────────────────────────────────
  searchContainer: {
    position: 'relative',
    zIndex: 9999,
    marginBottom: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    maxHeight: 160,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  dropdownItemCode: { fontSize: 13, fontWeight: '700', color: '#1976d2', marginBottom: 1 },
  dropdownItemName: { fontSize: 12, color: '#777' },
});

export default styles;
