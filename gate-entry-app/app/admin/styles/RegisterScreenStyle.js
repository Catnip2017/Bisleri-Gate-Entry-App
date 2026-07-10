import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },

  // ── Two-panel layout ──────────────────────────────────────────────────────
  panels: {
    flexDirection: 'row',
    gap: 0,
  },
  leftPanel: {
    width: 240,
    flexShrink: 0,
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: '#e8e8e8',
  },
  rightPanel: {
    flex: 1,
    paddingLeft: 24,
  },
  panelDivider: {
    // kept for backward compat but no longer used as a separate <View>
    width: 0,
  },

  // ── Left panel: Role selector ─────────────────────────────────────────────
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  roleContainer: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 20,
  },
  roleButton: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleButtonActive: {
    borderColor: '#1976d2',
    backgroundColor: '#e8f1fb',
  },
  roleButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
  },
  roleButtonTextActive: {
    color: '#1565c0',
    fontWeight: '600',
  },
  roleButtonDisabled: {
    borderColor: '#eee',
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  roleButtonTextDisabled: {
    color: '#bbb',
  },

  // ── Scope section (under role pills) ─────────────────────────────────────
  scopeBox: {
    backgroundColor: '#f5f9ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dae6f5',
    padding: 14,
    marginBottom: 4,
  },
  copackerNote: {
    fontSize: 12,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    lineHeight: 17,
  },

  // ── Right panel: form fields ──────────────────────────────────────────────
  label: {
    fontWeight: '600',
    marginBottom: 5,
    color: '#444',
    fontSize: 13,
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
    backgroundColor: '#e9ecef',
    color: '#888',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  field: {
    flex: 1,
  },

  // ── Register button ───────────────────────────────────────────────────────
  registerButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 18,
    width: '100%',
    elevation: 2,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    backgroundColor: '#b0bec5',
    elevation: 0,
  },
  registerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },

  // ── Warehouse autocomplete dropdown ───────────────────────────────────────
  searchContainer: {
    position: 'relative',
    marginBottom: 14,
    zIndex: 9999,
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
    maxHeight: 200,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  dropdownItemCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1976d2',
    marginBottom: 1,
  },
  dropdownItemName: {
    fontSize: 12,
    color: '#777',
  },
});

export default styles;
