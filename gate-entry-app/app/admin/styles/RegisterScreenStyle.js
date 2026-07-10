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
    maxWidth: 1080,
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

  // ── 3-column layout ────────────────────────────────────────────────────────
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Col 1: Roles (fixed, narrow)
  roleCol: {
    width: 185,
    flexShrink: 0,
    paddingRight: 16,
  },

  // Col 2: Personal details (fills remaining space)
  detailsCol: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Col 3: Scope (fixed, appears conditionally)
  scopeCol: {
    width: 220,
    flexShrink: 0,
    paddingLeft: 16,
  },

  // Vertical divider between columns
  vDivider: {
    width: 1,
    backgroundColor: '#e8e8e8',
    alignSelf: 'stretch',
  },

  // ── Section titles ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 1,
    marginBottom: 10,
  },
  scopeSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    opacity: 0.45,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderRadius: 3,        // square checkbox for all roles
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  checkTick: { color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 11 },
  roleBtnText: { fontSize: 13, fontWeight: '500', color: '#555', flex: 1 },
  roleBtnTextActive: { color: '#1565c0', fontWeight: '600' },
  roleBtnTextDisabled: { color: '#bbb' },

  roleHint: {
    fontSize: 10,
    color: '#bbb',
    marginTop: 8,
    lineHeight: 15,
  },

  // ── Form fields ────────────────────────────────────────────────────────────
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 5,
  },
  disabledLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 3,
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

  // ── Scope: Co Packer note ─────────────────────────────────────────────────
  cpNote: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  cpNoteText: { fontSize: 11, color: '#b45309', lineHeight: 16 },

  // ── Scope: IT Admin note ──────────────────────────────────────────────────
  itNote: {
    backgroundColor: '#e3f2fd',
    borderRadius: 7,
    padding: 12,
  },
  itNoteText: { fontSize: 12, color: '#1565c0', lineHeight: 18 },

  // ── Warehouse autocomplete ─────────────────────────────────────────────────
  whContainer: {
    position: 'relative',
    zIndex: 999,
  },
  whDropdown: {
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
    zIndex: 999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  whDropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  whCode: { fontSize: 13, fontWeight: '700', color: '#1976d2', marginBottom: 1 },
  whName: { fontSize: 11, color: '#777' },

  // ── Custom Dropdown (dept / GP location) ─────────────────────────────────
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 14,
  },
  dropdownTriggerText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    zIndex: 9999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  dropdownMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  dropdownMenuItemActive: {
    backgroundColor: '#e8f1fb',
  },
  dropdownMenuItemText: {
    fontSize: 13,
    color: '#444',
  },
  dropdownMenuItemTextActive: {
    color: '#1565c0',
    fontWeight: '600',
  },
});

export default styles;
