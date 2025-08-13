// app/security/styles/insightsStyles.js - COMPLETE WITH 3-COLOR EDIT SYSTEM + DOCUMENT ASSIGNMENT
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
  },

  // Card wrapper
  card: {
    backgroundColor: '#E0F7FA',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // ✅ 4x1 Stats Cards Styling with operational focus
  statsCardsContainer: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },

  statsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statCard: {
    flex: 1,
    backgroundColor: '#007bff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },

  // Enhanced Filters
  filters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  
  filterItem: {
    flex: 1,
    marginHorizontal: 4,
    minWidth: 120,
    maxWidth: 180,
  },
  
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  
  input: {
    borderColor: '#aaa',
    borderWidth: 1,
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    fontSize: 14,
  },

  // Date picker button styles
  datePickerButton: {
    borderColor: '#aaa',
    borderWidth: 1,
    padding: 10,
    borderRadius: 4,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },

  datePickerText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  searchButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    marginTop: 20,
  },

  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Operational Summary Section
  operationalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },

  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },

  summaryItem: {
    alignItems: 'center',
  },

  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#1a365d',
  },

  // Enhanced Table Styles
  tableScrollContainer: {
    maxHeight: 500,
  },

  tableContainer: {
    minWidth: 1900, // ✅ INCREASED for document assignment columns
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },

  tableHeaderCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
    fontWeight: 'bold',
    color: 'white',
    fontSize: 13,
    textAlign: 'center',
  },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    minHeight: 50,
    alignItems: 'center',
  },

  evenRow: {
    backgroundColor: '#f8f9fa',
  },

  oddRow: {
    backgroundColor: 'white',
  },

  tableCell: {
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#dee2e6',
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },

  // ✅ Column Widths including new document assignment columns
  colGateEntry: { width: 150 },
  colVehicle: { width: 120 },
  colDocumentType: { width: 140 },  
  colDocumentNo: { width: 160 }, 
  colDate: { width: 100 },
  colTime: { width: 80 },
  colMovement: { width: 90 },
  colWarehouse: { width: 150 },
  colSecurity: { width: 120 },
  colStatus: { width: 140 },
  colRemarks: { width: 140 },
  colDocumentDate: { width: 160 },  
  colDocumentAge: { width: 120 },
  
  // Operational Column Widths
  colDriverName: { width: 140 },
  colKMReading: { width: 100 },
  colLoaderNames: { width: 160 },
  colEditCount: { width: 80 },
  colTimeRemaining: { width: 120 },
  
  // ✅ NEW: Document Assignment Column Widths
  colDocumentNo: { width: 160 },              // NEW: Document assignment column
  colOperationalActions: { width: 130 },      // RENAMED: Original actions column  
  colAssignmentActions: { width: 120 },       // NEW: Document assignment actions

  // ✅ 3-Color Edit Button System
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  completeInfoButton: {
    backgroundColor: '#ffc107',
    borderWidth: 2,
    borderColor: '#ffca2c',
    shadowColor: '#ffc107',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  editDetailsButton: {
    backgroundColor: '#28a745',
    borderWidth: 2,
    borderColor: '#34ce57',
    shadowColor: '#28a745',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  expiredButton: {
    backgroundColor: '#6c757d',
    borderWidth: 2,
    borderColor: '#868e96',
    opacity: 0.7,
  },

  noAccessButton: {
    backgroundColor: '#343a40',
    borderWidth: 2,
    borderColor: '#495057',
    opacity: 0.6,
  },

  defaultButton: {
    backgroundColor: '#007bff',
    borderWidth: 2,
    borderColor: '#0056b3',
  },

  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 11,
  },

  disabledButtonText: {
    color: '#ffffff',
    opacity: 0.7,
  },

  // Row highlighting for high priority records
  highPriorityRow: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },

  mediumPriorityRow: {
    backgroundColor: '#d1edff',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },

  expiredRow: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#6c757d',
    opacity: 0.8,
  },

  // ✅ NEW: Pending assignment row highlighting
  pendingAssignmentRow: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },

  // Operational Data Cell Styling
  completeField: {
    color: '#28a745',
    fontWeight: 'bold',
    backgroundColor: '#f8fff8',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  incompleteField: {
    color: '#dc3545',
    fontStyle: 'italic',
    backgroundColor: '#fff5f5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  requiredField: {
    color: '#dc3545',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },

  // ✅ NEW: Document assignment cell styles
  assignmentDropdownButton: {
    backgroundColor: '#007bff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },

  assignmentDropdownText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },

  assignedDocumentText: {
    color: '#28a745',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
  },

  expiredAssignmentText: {
    color: '#6c757d',
    fontStyle: 'italic',
    fontSize: 11,
    textAlign: 'center',
  },

  // ✅ NEW: Assignment action button styles
  assignmentActionButton: {
    backgroundColor: '#28a745',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },

  assignmentActionButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },

  assignedStatusText: {
    color: '#28a745',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  expiredStatusText: {
    color: '#6c757d',
    fontSize: 11,
    textAlign: 'center',
  },

  // ✅ NEW: Document assignment modal styles
  assignmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  assignmentModalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  assignmentModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },

  assignmentRecordInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },

  assignmentInfoText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },

  assignmentSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },

  assignmentLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noDocumentsContainer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },

  noDocumentsText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },

  refreshButton: {
    backgroundColor: '#17a2b8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },

  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Document selection list
  documentsList: {
    maxHeight: 300,
    marginBottom: 16,
  },

  documentOption: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },

  selectedDocumentOption: {
    backgroundColor: '#e7f3ff',
    borderColor: '#007bff',
    borderWidth: 2,
  },

  documentOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  documentOptionDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },

  documentOptionAge: {
    fontSize: 12,
    color: '#007bff',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Assignment modal buttons
  assignmentModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },

  assignmentModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  assignmentCancelButton: {
    backgroundColor: '#6c757d',
  },

  assignmentSubmitButton: {
    backgroundColor: '#28a745',
  },

  assignmentButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },

  assignmentModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Priority Indicators
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  highPriorityIndicator: {
    backgroundColor: '#ffc107',
  },

  mediumPriorityIndicator: {
    backgroundColor: '#28a745',
  },

  lowPriorityIndicator: {
    backgroundColor: '#6c757d',
  },

  // Completion Progress Styling
  completionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },

  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 4,
  },

  progressPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#28a745',
    minWidth: 40,
  },

  // Field Status Icons
  fieldStatusIcon: {
    fontSize: 12,
    marginLeft: 4,
  },

  completeIcon: {
    color: '#28a745',
  },

  incompleteIcon: {
    color: '#dc3545',
  },

  optionalIcon: {
    color: '#6c757d',
  },

  // Edit Window Warning Styles
  editWindowWarning: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },

  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },

  warningText: {
    fontSize: 13,
    color: '#856404',
  },

  // Quick Filter Buttons
  quickFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  quickFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 100,
  },

  quickFilterActive: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },

  quickFilterInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#ced4da',
  },

  quickFilterText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  quickFilterTextActive: {
    color: '#ffffff',
  },

  quickFilterTextInactive: {
    color: '#6c757d',
  },

  // Bulk Action Buttons
  bulkActionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },

  bulkActionButton: {
    backgroundColor: '#17a2b8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },

  bulkActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Legend for 3-Color System
  colorLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },

  legendText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },

  // Time-based Styling
  urgentTimeRemaining: {
    color: '#dc3545',
    fontWeight: 'bold',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },

  warningTimeRemaining: {
    color: '#ffc107',
    fontWeight: 'bold',
    backgroundColor: '#fff9c4',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },

  normalTimeRemaining: {
    color: '#28a745',
    fontWeight: '500',
  },

  expiredTimeRemaining: {
    color: '#6c757d',
    fontStyle: 'italic',
  },

  // Data Quality Indicators
  dataQualityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  highQualityBadge: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },

  mediumQualityBadge: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },

  lowQualityBadge: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },

  qualityBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  highQualityText: {
    color: '#155724',
  },

  mediumQualityText: {
    color: '#856404',
  },

  lowQualityText: {
    color: '#721c24',
  },

  // Enhanced Loading States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  priorityLoadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },

  loadingProgress: {
    marginTop: 16,
    alignItems: 'center',
  },

  loadingStep: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },

  noDataContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Special Styling for KM Readings
  kmReadingCell: {
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  kmReadingComplete: {
    color: '#28a745',
    fontWeight: 'bold',
  },

  kmReadingMissing: {
    color: '#dc3545',
    fontStyle: 'italic',
  },

  // Loader Names Special Styling
  loaderNamesCell: {
    maxWidth: 160,
    overflow: 'hidden',
  },

  loaderNamesText: {
    fontSize: 11,
    lineHeight: 13,
  },

  multipleLoaders: {
    color: '#007bff',
    fontWeight: 'bold',
  },

  singleLoader: {
    color: '#28a745',
  },

  noLoaders: {
    color: '#dc3545',
    fontStyle: 'italic',
  },

  // Accessibility Enhancements
  accessibleActionButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  screenReaderText: {
    position: 'absolute',
    left: -10000,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },

  // Animation States for Button Transitions
  buttonTransition: {
    transition: 'all 0.3s ease',
  },

  pulseAnimation: {
    transform: [{ scale: 1.05 }],
  },

  // Character Count Display
  characterCount: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'right',
    marginTop: 4,
  },

  characterCountWarning: {
    color: '#ffc107',
  },

  characterCountError: {
    color: '#dc3545',
  },

  // KM Reading Special Styling
  kmReadingContainer: {
    position: 'relative',
  },

  kmReadingInput: {
    paddingRight: 60,
  },

  kmUnitsLabel: {
    position: 'absolute',
    right: 12,
    top: 12,
    fontSize: 14,
    color: '#6c757d',
    fontWeight: 'bold',
  },

  // Field Priority Indicators
  highPriorityField: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    paddingLeft: 12,
  },

  mediumPriorityField: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    paddingLeft: 12,
  },

  // Success Indicators
  fieldCompleted: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },

  completionCheckmark: {
    position: 'absolute',
    right: 8,
    top: 8,
    color: '#28a745',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Form Progress Indicator
  progressContainer: {
    backgroundColor: '#e9ecef',
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 3,
  },

  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },

  // Quick Action Buttons
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },

  quickActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#007bff',
  },

  quickActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Status Indicators
  statusIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  statusNeedsEdit: {
    backgroundColor: '#ffeaa7',
    color: '#d63031',
  },

  statusEditable: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },

  statusComplete: {
    backgroundColor: '#d1edff',
    color: '#155724',
  },

  statusExpired: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },

  // Enhanced table container for wider content
  enhancedTableContainer: {
    minWidth: 1900, // Increased for new columns
  },

  // Progress indicators for multi-entry groups
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },

  progressBarContainer: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    flex: 1,
    marginHorizontal: 8,
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 2,
  },

  // Quick filter for pending assignments
  pendingAssignmentFilter: {
    backgroundColor: '#dc3545',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },

  pendingAssignmentFilterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Batch assignment helpers
  batchAssignmentContainer: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },

  batchAssignmentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: 8,
  },

  batchAssignmentText: {
    fontSize: 13,
    color: '#495057',
  },

  // RESPONSIVE: Mobile stacking for stats cards
  '@media (max-width: 768px)': {
    operationalSummary: {
      flexDirection: 'column',
      gap: 8,
    },
    
    quickFilterRow: {
      flexDirection: 'column',
      gap: 8,
    },
    
    quickFilterButton: {
      width: '100%',
    },
    
    colorLegend: {
      flexDirection: 'column',
      gap: 8,
    },
    
    colDriverName: { width: 120 },
    colKMReading: { width: 80 },
    colLoaderNames: { width: 140 },
    colTimeRemaining: { width: 100 },
    colDocumentNo: { width: 140 },
    colAssignmentActions: { width: 100 },
    
    filters: {
      flexDirection: 'column',
    },
    
    filterItem: {
      marginBottom: 10,
      width: '100%',
    },
    
    summaryContainer: {
      flexDirection: 'column',
      gap: 8,
    },
    
    statsRowContainer: {
      flexDirection: 'column',
      gap: 12,
    },
    
    statCard: {
      width: '100%',
      marginHorizontal: 0,
    },
    
    statNumber: {
      fontSize: 32,
    },
    
    statLabel: {
      fontSize: 14,
    },

    assignmentModalContainer: {
      width: '95%',
      maxHeight: '90%',
      padding: 16,
    },
    
    assignmentModalTitle: {
      fontSize: 18,
    },
    
    assignmentModalButtonRow: {
      flexDirection: 'column',
      gap: 10,
    },
    
    assignmentModalButton: {
      marginHorizontal: 0,
    },
  },

  // RESPONSIVE: Tablet Design (Redmi Pad 2 specific)
  '@media (min-width: 769px) and (max-width: 1024px)': {
    tableHeaderCell: {
      fontSize: 11,
    },
    
    tableCell: {
      fontSize: 10,
    },
    
    actionButton: {
      minWidth: 100,
      paddingHorizontal: 10,
    },
    
    actionButtonText: {
      fontSize: 10,
    },

    assignmentDropdownButton: {
      minWidth: 120,
      paddingHorizontal: 8,
    },

    assignmentActionButton: {
      minWidth: 70,
      paddingHorizontal: 6,
    },

    assignmentModalContainer: {
      width: '85%',
      maxHeight: '80%',
    },
  },

  // Accessibility
  accessibleButton: {
    minHeight: 44,
    minWidth: 44,
  },

  // Focus States
  inputFocused: {
    borderColor: '#007bff',
    borderWidth: 2,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    backgroundColor: '#f8f9ff',
  },

  // Enhanced form section styling
  enhancedFormSection: {
    backgroundColor: '#fafbfc',
    borderWidth: 2,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },

  tableDataScrollView: {
    maxHeight: 400,
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    // Remove paddingBottom: 20 if present
  },

  // Add these styles to your existing insightsStyles.js file

  // NEW: Pagination styles
  paginationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 12,
  },

  paginationText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '600',
  },

  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    gap: 12,
  },

  paginationButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  paginationButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.5,
  },

  paginationButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  pageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ced4da',
    gap: 8,
  },

  pageInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    textAlign: 'center',
    minWidth: 50,
    maxWidth: 60,
  },

  pageInputLabel: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },

  // Enhanced table data container for better scrolling
  tableDataContainer: {
    maxHeight: 600, // Increased height for 20 entries
    backgroundColor: '#ffffff',
  },

});

export default styles;