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

  // ✅ 2-tab navigation (Gate Entry | Insights)
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
    gap: 8,
  },

  // Symmetric tab buttons (old version rounded only one side of each tab)
  activeButton: {
    backgroundColor: '#007bff',
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inactiveButton: {
    backgroundColor: '#ffffff',
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dee2e6',
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#6c757d',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },

  activeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },

  // ✅ Overlay sidebar (drawer) — no longer pushes content sideways
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 100,
  },

  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  sidebarPanel: {
    width: 280,
    height: '100%',
    backgroundColor: '#ffffff',
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  sidebarCloseButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  sidebarItem: {
    marginBottom: 12,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },

  sidebarLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc3545',
    minHeight: 48,
    borderRadius: 8,
    marginTop: 24,
  },

  sidebarLogoutText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
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