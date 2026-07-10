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
  // Two-panel horizontal layout
  panels: {
    flexDirection: 'row',
    gap: 20,
  },
  leftPanel: {
    width: 280,
    flexShrink: 0,
  },
  rightPanel: {
    flex: 1,
  },
  panelDivider: {
    width: 0.5,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
    color: '#1976d2',
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
    fontSize: 14,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#e9ecef',
    color: '#6c757d',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  field: {
    flex: 1,
    marginHorizontal: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  roleButtonTextActive: {
    color: '#1976d2',
  },
  roleButtonDisabled: {
    borderColor: '#e0e0e0',
    backgroundColor: '#f0f0f0',
    opacity: 0.5,
  },
  roleButtonTextDisabled: {
    color: '#aaa',
  },
  copackerNote: {
    fontSize: 12,
    color: '#dd6b20',
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#fbd38d',
    borderRadius: 6,
    padding: 8,
    marginBottom: 14,
  },
  registerButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    elevation: 2,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  registerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },

  // ðŸ”½ Dropdown Styles for Warehouse Autocomplete
  searchContainer: {
    position: 'relative',
    marginBottom: 15,
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
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    maxHeight: 200,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  dropdownItemCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 2,
  },
  dropdownItemName: {
    fontSize: 13,
    color: '#666',
  },
});

export default styles;