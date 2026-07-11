import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#f5f5f5',
  },

  // ── Left panel ────────────────────────────────────────────────────────────
  leftPanel: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    padding: 16,
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a365d',
    marginBottom: 12,
  },
  searchWrapper: {
    position: 'relative',
    marginBottom: 12,
    zIndex: 99,
  },
  searchInput: {
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  searchSpinner: {
    position: 'absolute',
    right: 8,
    top: 9,
  },
  resultsList: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 9,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    marginBottom: 6,
    gap: 8,
  },
  userRowSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarTextLarge: {
    fontSize: 15,
  },
  userRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  userRowName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a365d',
  },
  userRowSub: {
    fontSize: 10,
    color: '#888',
  },
  badgeWarn: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  badgeWarnText: {
    fontSize: 10,
    color: '#e65100',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 11,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 17,
    paddingHorizontal: 8,
  },

  // ── Right panel ───────────────────────────────────────────────────────────
  rightPanel: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  rightPanelRow: {
    flex: 1,
    flexDirection: 'row',
  },
  mainCol: {
    flex: 1,
  },
  scopeDivider: {
    width: 1,
    backgroundColor: '#efefef',
  },
  scopeCol: {
    width: 215,
    flexShrink: 0,
    backgroundColor: '#fafcff',
  },
  scopeSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1976d2',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  dimLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 3,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 13,
    color: '#ccc',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 20,
  },
  // Scope dropdown
  ddTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8f9fa', paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 7, borderWidth: 0.5, borderColor: '#ccc', marginBottom: 12,
  },
  ddTriggerText: { fontSize: 12, color: '#333', flex: 1 },
  ddMenu: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#ccc',
    borderTopWidth: 0, borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
    zIndex: 9999, elevation: 6,
  },
  ddItem: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  ddItemActive: { backgroundColor: '#e8f1fb' },
  ddItemText: { fontSize: 12, color: '#444' },
  ddItemTextActive: { color: '#1565c0', fontWeight: '600' },

  // ── User header ───────────────────────────────────────────────────────────
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    marginBottom: 4,
  },
  userHeaderInfo: {
    flex: 1,
  },
  userHeaderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a365d',
  },
  userHeaderSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  authBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  authBadgeText: {
    fontSize: 10,
    color: '#1565c0',
    fontWeight: '500',
  },
  authBadgeLocal: {
    backgroundColor: '#f3e5f5',
  },
  authBadgeLocalText: {
    color: '#6a1b9a',
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },

  // ── Form fields ───────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 5,
  },
  required: {
    color: '#e53e3e',
  },
  fieldNote: {
    fontSize: 10,
    color: '#aaa',
    marginTop: -8,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    color: '#1a365d',
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    minHeight: 38,
  },
  inputDisabledText: {
    fontSize: 12,
    color: '#999',
  },

  // ── Role pills ────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#ccc',
    backgroundColor: '#fafafa',
  },
  pillSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  pillDisabled: {
    borderColor: '#eee',
    backgroundColor: '#f9f9f9',
    opacity: 0.5,
  },
  pillText: {
    fontSize: 12,
    color: '#888',
  },
  pillTextSelected: {
    color: '#1976d2',
    fontWeight: '500',
  },
  pillTextDisabled: {
    color: '#ccc',
  },
  copackerNote: {
    fontSize: 10,
    color: '#e65100',
    fontStyle: 'italic',
    marginBottom: 10,
  },

  // ── Warehouse dropdown ────────────────────────────────────────────────────
  dropdownWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 8,
    zIndex: 100,
    elevation: 5,
    maxHeight: 150,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  dropdownCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a365d',
  },
  dropdownName: {
    fontSize: 11,
    color: '#888',
  },

  // ── Save button ───────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  saveButtonDisabled: {
    backgroundColor: '#90bce8',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
