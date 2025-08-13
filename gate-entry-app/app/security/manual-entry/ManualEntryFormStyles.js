// app/security/styles/ManualEntryFormStyles.js - ENHANCED WITH EMPTY VEHICLE STYLING
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

  // Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a365d',
  },

  // Form Rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  // Field widths
  field50: {
    width: '48%',
  },

  fieldFull: {
    width: '100%',
    marginBottom: 15,
  },

  // Labels and inputs
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
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

  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },

  // NEW: Enhanced input styling for multi-document feature
  highlightInput: {
    borderColor: '#007bff',
    borderWidth: 2,
    backgroundColor: '#f8f9ff',
  },

  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },

  // NEW: Hint and info text styling
  hintText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },

  warningText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // NEW: Information box for multi-document explanation
  infoBox: {
    backgroundColor: '#e7f3ff',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: 8,
  },

  infoText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
    paddingLeft: 8,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 30,
    paddingHorizontal: 20,
  },

  button: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  submitButton: {
    backgroundColor: '#28a745',
  },

  clearButton: {
    backgroundColor: '#dc3545',
  },

  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
    elevation: 0,
    shadowOpacity: 0,
  },

  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // NEW: Character count styling
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

  // NEW: Field status indicators
  fieldCompleted: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },

  fieldRequired: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },

  // NEW: Loading states
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginTop: 16,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },

  // NEW: Success message styling
  successBanner: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },

  successTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#155724',
    marginBottom: 4,
  },

  successText: {
    fontSize: 14,
    color: '#155724',
  },

  // NEW: Document count display
  documentCountContainer: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },

  documentCountText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 18,
  },

  // NEW: Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },

  stepItem: {
    alignItems: 'center',
    flex: 1,
  },

  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  stepLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },

  activeStep: {
    backgroundColor: '#28a745',
  },

  completedStep: {
    backgroundColor: '#6c757d',
  },

  // NEW: Form validation styling
  validationContainer: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },

  validationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 6,
  },

  validationText: {
    fontSize: 13,
    color: '#721c24',
  },

  // Responsive Design for Mobile
  '@media (max-width: 768px)': {
    card: {
      marginHorizontal: 8,
      padding: 12,
    },
    
    buttonRow: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
    },
    
    button: {
      width: '80%',
      marginVertical: 6,
    },
    
    infoBox: {
      padding: 12,
    },
    
    infoTitle: {
      fontSize: 14,
    },
    
    infoText: {
      fontSize: 12,
    },
    
    stepIndicator: {
      flexDirection: 'column',
      gap: 8,
    },
    
    stepItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    
    stepNumber: {
      marginRight: 12,
      marginBottom: 0,
    },
  },

  // Tablet Responsive Design
  '@media (min-width: 769px) and (max-width: 1024px)': {
    card: {
      marginHorizontal: 20,
      padding: 20,
    },
    
    sectionTitle: {
      fontSize: 20,
    },
    
    label: {
      fontSize: 16,
    },
    
    input: {
      padding: 12,
      fontSize: 16,
    },
    
    button: {
      paddingVertical: 14,
      paddingHorizontal: 30,
    },
    
    buttonText: {
      fontSize: 18,
    },
  },

  // Accessibility
  accessibleInput: {
    minHeight: 48,
  },

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
  },

  // NEW: Multi-document specific styling
  multiDocumentContainer: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#b0d4f1',
  },

  multiDocumentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: 8,
    textAlign: 'center',
  },

  multiDocumentDescription: {
    fontSize: 13,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 18,
  },

  // NEW: Enhanced button styling for multi-document
  enhancedSubmitButton: {
    backgroundColor: '#007bff',
    borderWidth: 2,
    borderColor: '#0056b3',
    elevation: 4,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // ✅ NEW: Empty vehicle button styling
  emptyVehicleButton: {
    backgroundColor: '#ff8c00',  // Orange color for empty vehicles
    borderWidth: 2,
    borderColor: '#ff6347',
    elevation: 4,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  enhancedButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
  },

  // NEW: Progress indicator for multi-entry
  progressContainer: {
    backgroundColor: '#e9ecef',
    height: 6,
    borderRadius: 3,
    marginVertical: 10,
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
    marginTop: 4,
  },

  // ✅ NEW: Empty vehicle specific styling
  emptyVehicleContainer: {
    backgroundColor: '#fff8e1',  // Light amber background
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffcc02',
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
  },

  emptyVehicleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 8,
    textAlign: 'center',
  },

  emptyVehicleDescription: {
    fontSize: 13,
    color: '#bf360c',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ✅ NEW: Conditional styling based on document count
  conditionalHintText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 18,
    padding: 8,
    borderRadius: 4,
  },

  emptyVehicleHint: {
    backgroundColor: '#fff8e1',
    color: '#e65100',
    borderLeftWidth: 3,
    borderLeftColor: '#ff8c00',
  },

  manualEntryHint: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderLeftWidth: 3,
    borderLeftColor: '#007bff',
  },
});

export default styles;