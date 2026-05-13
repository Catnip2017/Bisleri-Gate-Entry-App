// app/copacker/styles/copackerStyles.js
import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
  // ── Outer container ───────────────────────────────────────────────────────
  flex1: { flex: 1 },

  // ── Header (matches SecurityDashboard / AdminDashboard) ───────────────────
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    elevation: 4,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
    }),
  },
  menuButton: { paddingHorizontal: 10, paddingVertical: 8 },
  menuText: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  logo: {
    width: 120,
    height: 40,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -60 }],
  },
  homeButton: {
    backgroundColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  homeText: { fontWeight: 'bold', color: '#333' },

  // ── Body layout ───────────────────────────────────────────────────────────
  body: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar: {
    width: 230,
    backgroundColor: '#E0F7FA',
    padding: 16,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  sidebarTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 14, color: '#1a365d' },
  sidebarItem: { marginBottom: 10, fontSize: 14, color: '#333', fontWeight: '600' },
  sidebarLabel: { fontSize: 12, color: '#718096', marginBottom: 2 },
  sidebarValue: { fontSize: 14, color: '#2d3748', fontWeight: '600', marginBottom: 12 },
  logoutButton: {
    marginTop: 20,
    backgroundColor: '#e53e3e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // ── Main content area ─────────────────────────────────────────────────────
  mainContent: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 40 },

  // ── Page title + Add New button row ──────────────────────────────────────
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a365d' },
  addButton: {
    backgroundColor: '#2b6cb0',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // ── Date label row ────────────────────────────────────────────────────────
  dateRow: { marginBottom: 8 },
  dateLabel: { fontSize: 13, color: '#718096', fontStyle: 'italic' },

  // ── Table wrapper (horizontal scroll) ─────────────────────────────────────
  tableWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2b6cb0',
    paddingVertical: 10,
  },
  tableHeaderCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    alignItems: 'center',
  },
  tableRowEven: { backgroundColor: '#f7fafc' },
  tableRowOdd: { backgroundColor: '#fff' },
  tableCell: {
    fontSize: 12,
    color: '#2d3748',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tableCellMuted: { fontSize: 12, color: '#a0aec0', textAlign: 'center' },

  // Column widths
  colSr: { width: 40 },
  colLine: { width: 60 },
  colAsset: { width: 120 },
  colDate: { width: 90 },
  colTime: { width: 75 },
  colImage: { width: 70 },
  colSku: { width: 130 },
  colSkuId: { width: 110 },
  colQty: { width: 100 },
  colUser: { width: 100 },

  // Thumbnail
  thumbnail: { width: 50, height: 50, borderRadius: 4, alignSelf: 'center' },
  thumbnailPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  thumbnailPlaceholderText: { fontSize: 18 },

  // Qty edit inline
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 12, color: '#2d3748', marginRight: 4 },
  editIcon: { fontSize: 14, color: '#2b6cb0' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: '#a0aec0', marginTop: 8 },

  // Loading
  loadingContainer: { alignItems: 'center', paddingVertical: 40 },

  // ── Modal overlay ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a365d', marginBottom: 16 },
  modalScroll: { maxHeight: 500 },

  // Form fields inside modal
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4a5568', marginBottom: 4, marginTop: 10 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: { fontSize: 14, color: '#2d3748' },
  dropdownItemSub: { fontSize: 11, color: '#718096' },

  // Date picker row
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  datePickerText: { flex: 1, fontSize: 14, color: '#2d3748' },

  // Camera button
  cameraButton: {
    backgroundColor: '#2b6cb0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  cameraButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cameraButtonDisabled: { backgroundColor: '#a0aec0' },
  imagePreviewContainer: { alignItems: 'center', marginTop: 8 },
  imagePreview: { width: 120, height: 120, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' },
  imagePreviewLabel: { fontSize: 11, color: '#718096', marginTop: 4 },

  // Modal buttons
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  cancelButtonText: { color: '#4a5568', fontWeight: '600' },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2b6cb0',
  },
  submitButtonDisabled: { backgroundColor: '#a0aec0' },
  submitButtonText: { color: '#fff', fontWeight: 'bold' },

  // Confirm popup
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  confirmTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a365d', marginBottom: 10 },
  confirmRemark: {
    fontSize: 13,
    color: '#4a5568',
    backgroundColor: '#f7fafc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    lineHeight: 20,
  },
});

export default styles;
