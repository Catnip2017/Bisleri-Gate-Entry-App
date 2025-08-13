// app/security/styles/operationalEditModalStyles.js - FIXED STYLES FOR PROPER FORM VISIBILITY
import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: Math.min(width * 0.9, 700), // Increased max width for tablets
    maxHeight: height * 0.85,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Modal Header
  modalHeader: {
    marginBottom: 16, // Reduced to give more space to content
    borderBottomWidth: 2,
    borderBottomColor: '#e9ecef',
    paddingBottom: 12,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#333',
  },

  statusBanner: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },

  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal Content - FIXED: Proper height and scrolling
  modalContent: {
    flex: 1, // Allow it to take available space
    marginBottom: 16,
    paddingRight: 4, // Space for scrollbar
  },

  // Information Section
  infoSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    width: '48%',
  },

  editCountText: {
    fontSize: 12,
    color: '#28a745',
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Missing Fields Alert
  missingFieldsAlert: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },

  alertTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },

  alertText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4,
  },

  // Form Section - FIXED: Ensure proper visibility
  formSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 300, // Ensure minimum height
  },

  inputGroup: {
    marginBottom: 20,
    width: '100%', // Ensure full width
  },

  inputLabel: {
    fontSize: 15, // Increased font size
    fontWeight: 'bold',
    marginBottom: 8, // Increased margin
    color: '#333',
    lineHeight: 20,
  },

  requiredField: {
    color: '#dc3545',
  },

  // Modal Input - FIXED: Better visibility and interaction
  modalInput: {
    borderWidth: 2, // Increased border width
    borderColor: '#ced4da',
    borderRadius: 8, // Increased border radius
    padding: 14, // Increased padding
    fontSize: 16, // Increased font size for better readability
    backgroundColor: '#fff',
    color: '#333',
    minHeight: 48, // Ensure minimum touch target
    width: '100%', // Ensure full width
  },

  multilineInput: {
    height: 90, // Increased height for multiline
    textAlignVertical: 'top',
    paddingTop: 14, // Consistent padding
  },

  inputError: {
    borderColor: '#dc3545',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },

  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 6, // Increased margin
    fontWeight: '500',
    lineHeight: 16,
  },

  contextText: {
    fontSize: 12,
    color: '#007bff',
    marginTop: 6, // Increased margin
    fontStyle: 'italic',
    lineHeight: 16,
  },

  hintText: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 6, // Increased margin
    fontStyle: 'italic',
    lineHeight: 14,
  },

  // Action Buttons - FIXED: Better spacing and touch targets
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12, // Add gap between buttons
  },

  modalButton: {
    flex: 1,
    paddingVertical: 16, // Increased padding
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50, // Ensure minimum touch target
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  cancelButton: {
    backgroundColor: '#6c757d',
  },

  saveButton: {
    backgroundColor: '#28a745',
  },

  completeButton: {
    backgroundColor: '#ffc107',
  },

  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Form Validation States
  validInput: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },

  invalidInput: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },

  // Loading States
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
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

  // Field Priority Indicators
  highPriorityField: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    paddingLeft: 12,
    backgroundColor: '#fff9c4',
  },

  mediumPriorityField: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    paddingLeft: 12,
    backgroundColor: '#f8fff8',
  },

  // Success Indicators
  fieldCompleted: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },

  completionCheckmark: {
    position: 'absolute',
    right: 12,
    top: 12,
    color: '#28a745',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Responsive Design - FIXED: Better tablet support
  '@media (max-width: 768px)': {
    modalContainer: {
      width: '95%',
      maxHeight: '90%',
      padding: 16,
    },
    
    modalTitle: {
      fontSize: 18,
    },
    
    infoGrid: {
      flexDirection: 'column',
    },
    
    infoText: {
      width: '100%',
      marginBottom: 6,
    },
    
    modalButtonRow: {
      flexDirection: 'column',
      gap: 10,
    },
    
    modalButton: {
      marginHorizontal: 0,
    },

    modalInput: {
      fontSize: 14,
      padding: 12,
    },

    multilineInput: {
      height: 80,
    },
  },

  // Tablet-specific styles (Samsung tablet optimization)
  '@media (min-width: 769px) and (max-width: 1024px)': {
    modalContainer: {
      width: '85%',
      maxHeight: '80%',
    },
    
    modalInput: {
      fontSize: 16,
      padding: 16,
    },
    
    multilineInput: {
      height: 100,
    },
    
    inputLabel: {
      fontSize: 16,
    },
    
    sectionTitle: {
      fontSize: 18,
    },
  },

  // Accessibility
  accessibleButton: {
    minHeight: 44,
    minWidth: 44,
  },

  accessibleInput: {
    minHeight: 48,
  },

  // Focus States (for better UX)
  inputFocused: {
    borderColor: '#007bff',
    borderWidth: 2,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    backgroundColor: '#f8f9ff',
  },

  // Improved spacing for Samsung tablets
  tabletSpacing: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  // Better contrast for readability
  highContrastText: {
    color: '#000',
    fontWeight: '600',
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
});

export default styles;