// app/security/styles/dashboardStyles.js
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // Main container
  container: {
    paddingBottom: 20,
    backgroundColor: 'white',
    paddingHorizontal: 12,
  },

  // ✅ Full-width top navbar
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    elevation: 4,
  },

  // ☰ Menu button on left
  menuButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  menuText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },

  // Logo in center
  logo: {
    width: 120,
    height: 40,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -60 }], // Half of logo width
  },

  // Home button on right
  homeButton: {
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  homeText: {
    fontWeight: 'bold',
    color: '#333',
  },

  // ✅ Button row below header
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },

  activeButton: {
    backgroundColor: '#00bfff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },

  inactiveButton: {
    backgroundColor: '#ccf5ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },

  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },

  // 🧊 Sidebar (Left side under header)
  sidebar: {
    width: 220,
    backgroundColor: '#E0F7FA',
    padding: 16,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },

  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  sidebarItem: {
    marginBottom: 12,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },

  // Tab content containers
  tabContent: {
    flex: 1,
  },

  // Show/hide tabs without unmounting
  visibleTab: {
    display: 'flex',
  },

  hiddenTab: {
    display: 'none',
  },
});

export default styles;