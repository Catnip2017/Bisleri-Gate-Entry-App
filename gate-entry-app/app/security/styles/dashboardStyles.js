// app/security/styles/dashboardStyles.js - UPDATED for 4 tabs
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

  // ✅ UPDATED: Button row for 4 tabs
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
    flexWrap: 'wrap', // Allow wrapping on smaller screens
  },

  // ✅ UPDATED: Active button styles for 4 tabs
  activeButton: {
    backgroundColor: '#00bfff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 2,
    minWidth: 80,
    alignItems: 'center',
  },

  // ✅ UPDATED: Inactive button styles for 4 tabs
  inactiveButton: {
    backgroundColor: '#ccf5ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 2,
    minWidth: 80,
    alignItems: 'center',
  },

  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12, // Slightly smaller for 4 tabs
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

  // ✅ RESPONSIVE: Mobile styles for 4 tabs
  '@media (max-width: 768px)': {
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
    },

    activeButton: {
      minWidth: 70,
      paddingHorizontal: 8,
      marginVertical: 4,
    },

    inactiveButton: {
      minWidth: 70,
      paddingHorizontal: 8,
      marginVertical: 4,
    },

    buttonText: {
      fontSize: 11,
    },
  },

  // ✅ RESPONSIVE: Tablet styles for 4 tabs
  '@media (min-width: 769px) and (max-width: 1024px)': {
    activeButton: {
      minWidth: 90,
      paddingHorizontal: 14,
    },

    inactiveButton: {
      minWidth: 90,
      paddingHorizontal: 14,
    },

    buttonText: {
      fontSize: 13,
    },
  },
});

export default styles;