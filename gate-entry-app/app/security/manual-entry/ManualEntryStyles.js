// app/security/manual-entry/ManualEntryStyles.js
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // Page container
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

  // Title Container
  titleContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },

  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    textAlign: 'center',
  },
});

export default styles;