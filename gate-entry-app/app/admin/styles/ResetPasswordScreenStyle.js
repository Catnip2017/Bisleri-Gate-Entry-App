import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  // Two-panel layout
  panels: {
    flexDirection: 'row',
    gap: 20,
  },
  leftPanel: {
    width: 300,
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 14,
    fontSize: 14,
    color: '#333',
  },
  // User info card shown after selection
  userInfoCard: {
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#90caf9',
    padding: 14,
    marginTop: 8,
  },
  userInfoName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1565c0',
    marginBottom: 4,
  },
  userInfoRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 3,
  },
  userInfoLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    width: 60,
  },
  userInfoValue: {
    fontSize: 12,
    color: '#444',
    flex: 1,
  },
  rolePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  // Password fields
  resetButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    elevation: 2,
    alignItems: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  resetText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  strengthIndicator: {
    height: 4,
    borderRadius: 2,
    marginTop: -8,
    marginBottom: 14,
    width: '100%',
  },
  strengthWeak: { backgroundColor: '#dc3545' },
  strengthMedium: { backgroundColor: '#ffc107' },
  strengthStrong: { backgroundColor: '#28a745' },

  // Dropdown
  searchContainer: {
    position: 'relative',
    zIndex: 9999,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    maxHeight: 180,
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dropdownRole: {
    fontSize: 12,
    color: '#888',
  },
});

export default styles;
