import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f9f9f9',
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    width: '90%',
    maxWidth: 500,
    alignSelf: 'center',
    padding: 25,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 50,
    height: 800,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 18,
    fontSize: 14,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#e9ecef',
    color: '#6c757d',
  },
  searchButton: {
    backgroundColor: '#17a2b8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignSelf: 'center',
    marginBottom: 20,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modifyButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 15,
    elevation: 2,
  },
  modifyButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  modifyText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  userInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  rolesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
    flexWrap: 'wrap',
  },
  roleButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: '28%',
    alignItems: 'center',
  },
  roleButtonSelected: {
    backgroundColor: '#1976d2',
  },
  roleButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 14,
  },
  roleButtonTextSelected: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

    dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    maxHeight: 150,
    zIndex: 10,
  },
  
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  toggleRow: {
  flexDirection: "row",
  justifyContent: "center",
  marginBottom: 20,
},
toggleButton: {
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  marginHorizontal: 5,
  backgroundColor: "#fff",
},
activeButton: {
  backgroundColor: "#1976d2",
  borderColor: "#1976d2",
},
toggleText: {
  fontSize: 14,
  color: "#555",
  fontWeight: "600",
},
activeText: {
  color: "#fff",
},
formGroup: {
  marginBottom: 15,
},


});

export default styles;