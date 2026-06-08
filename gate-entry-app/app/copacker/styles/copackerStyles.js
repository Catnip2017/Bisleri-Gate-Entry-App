// app/copacker/styles/copackerStyles.js
import { StyleSheet, Platform, useWindowDimensions } from 'react-native';

/**
 * Responsive styles hook — recalculates whenever the window is resized.
 * Breakpoints: small < 600, medium 600–1023, large >= 1024
 */
export const useCopackerStyles = () => {
  const { width, height } = useWindowDimensions();

  const isSmall  = width < 600;
  const isMedium = width >= 600 && width < 1024;
  const isLarge  = width >= 1024;

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebarWidth = isSmall ? width * 0.75 : isMedium ? 200 : 230;

  // ── Modal dimensions ──────────────────────────────────────────────────────
  const modalMaxWidth  = isSmall ? width - 32 : isMedium ? 460 : 520;
  const modalScrollH   = Math.min(height * 0.55, 520);
  const confirmMaxW    = isSmall ? width - 32 : 400;

  return StyleSheet.create({
    // ── Outer container ─────────────────────────────────────────────────────
    flex1: { flex: 1 },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isSmall ? 8 : 12,
      paddingVertical: isSmall ? 8 : 10,
      backgroundColor: '#fff',
      elevation: 4,
      ...Platform.select({
        web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
      }),
    },
    menuButton: { paddingHorizontal: 10, paddingVertical: 8 },
    menuText: { fontSize: isSmall ? 20 : 24, fontWeight: 'bold', color: '#000' },
    logo: {
      width: isSmall ? 90 : 120,
      height: isSmall ? 30 : 40,
      position: 'absolute',
      left: '50%',
      transform: [{ translateX: isSmall ? -45 : -60 }],
    },
    homeButton: {
      backgroundColor: '#eee',
      paddingHorizontal: isSmall ? 8 : 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    homeText: { fontWeight: 'bold', color: '#333', fontSize: isSmall ? 12 : 14 },

    // ── Body layout ─────────────────────────────────────────────────────────
    body: { flex: 1, flexDirection: 'row' },

    // ── Sidebar ─────────────────────────────────────────────────────────────
    sidebar: {
      width: sidebarWidth,
      backgroundColor: '#E0F7FA',
      padding: isSmall ? 12 : 16,
      borderRightWidth: 1,
      borderColor: '#ccc',
      // On small screens, sidebar overlays the content
      ...Platform.select({
        web: isSmall ? {
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          boxShadow: '2px 0 8px rgba(0,0,0,0.2)',
        } : {},
      }),
    },
    sidebarTitle: {
      fontSize: isSmall ? 15 : 18,
      fontWeight: 'bold',
      marginBottom: 14,
      color: '#1a365d',
    },
    sidebarLabel: { fontSize: isSmall ? 11 : 12, color: '#718096', marginBottom: 2 },
    sidebarValue: {
      fontSize: isSmall ? 12 : 14,
      color: '#2d3748',
      fontWeight: '600',
      marginBottom: 10,
    },
    logoutButton: {
      marginTop: 20,
      backgroundColor: '#e53e3e',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    // ── Main content area ───────────────────────────────────────────────────
    mainContent: { flex: 1 },
    scrollContent: {
      padding: isSmall ? 8 : 12,
      paddingBottom: 40,
    },

    // ── Title row ───────────────────────────────────────────────────────────
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isSmall ? 8 : 12,
    },
    pageTitle: {
      fontSize: isSmall ? 16 : isMedium ? 18 : 20,
      fontWeight: 'bold',
      color: '#1a365d',
      flexShrink: 1,
    },
    addButton: {
      backgroundColor: '#2b6cb0',
      paddingVertical: isSmall ? 6 : 8,
      paddingHorizontal: isSmall ? 12 : 18,
      borderRadius: 8,
      marginLeft: 8,
    },
    addButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: isSmall ? 12 : 14,
    },

    // ── Date label ──────────────────────────────────────────────────────────
    dateRow: { marginBottom: 8 },
    dateLabel: {
      fontSize: isSmall ? 11 : 13,
      color: '#718096',
      fontStyle: 'italic',
    },

    // ── Table ───────────────────────────────────────────────────────────────
    tableWrapper: {
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#2b6cb0',
      paddingVertical: isSmall ? 8 : 10,
    },
    tableHeaderCell: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: isSmall ? 11 : 12,
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderColor: '#e2e8f0',
      paddingVertical: isSmall ? 6 : 8,
      alignItems: 'center',
    },
    tableRowEven: { backgroundColor: '#f7fafc' },
    tableRowOdd:  { backgroundColor: '#fff' },
    tableCell: {
      fontSize: isSmall ? 11 : 12,
      color: '#2d3748',
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    tableCellMuted: {
      fontSize: isSmall ? 11 : 12,
      color: '#a0aec0',
      textAlign: 'center',
    },

    // Thumbnail
    thumbnail: {
      width: isSmall ? 42 : 50,
      height: isSmall ? 42 : 50,
      borderRadius: 4,
      alignSelf: 'center',
    },
    thumbnailPlaceholder: {
      width: isSmall ? 42 : 50,
      height: isSmall ? 42 : 50,
      borderRadius: 4,
      backgroundColor: '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    thumbnailPlaceholderText: { fontSize: isSmall ? 14 : 18 },

    // Empty / loading states
    emptyContainer:  { alignItems: 'center', paddingVertical: 40 },
    emptyText:       { fontSize: isSmall ? 14 : 16, color: '#a0aec0', marginTop: 8 },
    loadingContainer:{ alignItems: 'center', paddingVertical: 40 },

    // ── Modal overlay ────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isSmall ? 12 : 16,
    },
    modalCard: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: isSmall ? 14 : 20,
      width: '100%',
      maxWidth: modalMaxWidth,
      ...Platform.select({
        web: { boxShadow: '0px 8px 24px rgba(0,0,0,0.2)' },
        android: { elevation: 10 },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
      }),
    },
    modalTitle: {
      fontSize: isSmall ? 15 : 18,
      fontWeight: 'bold',
      color: '#1a365d',
      marginBottom: isSmall ? 10 : 16,
    },
    modalScroll: { maxHeight: modalScrollH },

    // Form fields
    fieldLabel: {
      fontSize: isSmall ? 12 : 13,
      fontWeight: '600',
      color: '#4a5568',
      marginBottom: 4,
      marginTop: isSmall ? 8 : 10,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: '#cbd5e0',
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: isSmall ? 6 : 8,
      fontSize: isSmall ? 13 : 14,
      color: '#2d3748',
      backgroundColor: '#fff',
    },
    fieldInputDisabled: { backgroundColor: '#f7fafc', color: '#718096' },

    // Dropdown
    dropdownContainer: { position: 'relative', zIndex: 999 },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#cbd5e0',
      borderRadius: 6,
      maxHeight: 160,
      zIndex: 1000,
      ...Platform.select({
        web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.1)' },
        android: { elevation: 8 },
      }),
    },
    dropdownItem: {
      paddingVertical: isSmall ? 8 : 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    dropdownItemText: { fontSize: isSmall ? 13 : 14, color: '#2d3748' },
    dropdownItemSub:  { fontSize: isSmall ? 10 : 11, color: '#718096' },

    // Date picker
    datePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#cbd5e0',
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: isSmall ? 6 : 8,
    },
    datePickerText: { flex: 1, fontSize: isSmall ? 13 : 14, color: '#2d3748' },

    // Camera button
    cameraButton: {
      backgroundColor: '#2b6cb0',
      paddingVertical: isSmall ? 10 : 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },
    cameraButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: isSmall ? 13 : 14,
    },
    cameraButtonDisabled: { backgroundColor: '#a0aec0' },
    imagePreviewContainer: { alignItems: 'center', marginTop: 8 },
    imagePreview: {
      width: isSmall ? 100 : 120,
      height: isSmall ? 100 : 120,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#cbd5e0',
    },
    imagePreviewLabel: { fontSize: 11, color: '#718096', marginTop: 4 },

    // Modal buttons
    modalButtonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: isSmall ? 14 : 20,
      gap: 10,
    },
    cancelButton: {
      paddingVertical: isSmall ? 8 : 10,
      paddingHorizontal: isSmall ? 14 : 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#cbd5e0',
    },
    cancelButtonText: { color: '#4a5568', fontWeight: '600', fontSize: isSmall ? 13 : 14 },
    submitButton: {
      paddingVertical: isSmall ? 8 : 10,
      paddingHorizontal: isSmall ? 16 : 24,
      borderRadius: 8,
      backgroundColor: '#2b6cb0',
    },
    submitButtonDisabled: { backgroundColor: '#a0aec0' },
    submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: isSmall ? 13 : 14 },

    // Confirm popup
    confirmCard: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: isSmall ? 14 : 20,
      width: '100%',
      maxWidth: confirmMaxW,
      ...Platform.select({
        web: { boxShadow: '0px 8px 24px rgba(0,0,0,0.2)' },
        android: { elevation: 10 },
      }),
    },
    confirmTitle: {
      fontSize: isSmall ? 14 : 16,
      fontWeight: 'bold',
      color: '#1a365d',
      marginBottom: 10,
    },
    confirmRemark: {
      fontSize: isSmall ? 12 : 13,
      color: '#4a5568',
      backgroundColor: '#f7fafc',
      padding: 10,
      borderRadius: 6,
      marginBottom: 16,
      lineHeight: isSmall ? 18 : 20,
    },
  });
};

// Keep a default static export for any legacy imports
export default useCopackerStyles;
