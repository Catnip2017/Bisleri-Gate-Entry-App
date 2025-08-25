// app/security/styles/dashboardStyles.js - UPDATED for 3 tabs
import { StyleSheet } from 'react-native';
import { BACKGROUND_PRIMARY } from '../../../utils/platformColors';

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

  // ✅ UPDATED: Button row for 3 tabs
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },

  // ✅ UPDATED: Active button styles for 3 tabs
  activeButton: {
    backgroundColor: '#00bfff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    marginHorizontal: 1,
    minWidth: 100,
    alignItems: 'center',
  },

  // ✅ UPDATED: Inactive button styles for 3 tabs  
  inactiveButton: {
    backgroundColor: '#ccf5ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    marginHorizontal: 1,
    minWidth: 100,
    alignItems: 'center',
  },

  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
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

  // ✅ RESPONSIVE: Mobile styles for 3 tabs
  '@media (max-width: 768px)': {
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },

    activeButton: {
      minWidth: 80,
      paddingHorizontal: 12,
      borderRadius: 6,
    },

    inactiveButton: {
      minWidth: 80,
      paddingHorizontal: 12,
      borderRadius: 6,
    },

    buttonText: {
      fontSize: 12,
    },
  },

  // ✅ RESPONSIVE: Tablet styles for 3 tabs
  '@media (min-width: 769px) and (max-width: 1024px)': {
    activeButton: {
      minWidth: 120,
      paddingHorizontal: 20,
    },

    inactiveButton: {
      minWidth: 120,
      paddingHorizontal: 20,
    },

    buttonText: {
      fontSize: 15,
    },
  },
});

export default styles;