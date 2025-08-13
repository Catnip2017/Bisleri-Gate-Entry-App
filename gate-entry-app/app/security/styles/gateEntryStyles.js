// app/security/styles/gateEntryStyles.js - FIXED CLEAN TABLE STYLES
import { StyleSheet, Dimensions, Platform } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const isTablet = screenWidth >= 750 && screenWidth <= 850;




const styles = StyleSheet.create({
  container: {
  flex: 1,
  ...Platform.select({
    web: { minHeight: '100vh' }, // Fill the viewport on web
    default: { minHeight: '100%' }
  }),
  backgroundColor: '#E0F7FA',
},

  cardContainer: {
    backgroundColor: '#E0F7FA',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
     flexGrow: 1, // This ensures content grows to fill space
  },

  // Custom dynamic fields (responsive to Redmi Pad 2 or tablet screen)
  field40: { width: isTablet ? '40%' : '30%', marginBottom: 8 },
  field35: { width: isTablet ? '35%' : '25%', marginBottom: 8 },
  field10: { width: isTablet ? '10%' : '20%', marginBottom: 8 },

  // Heading
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1a365d',
  },

  // Form Rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 15,
  },

  // Field Widths (UPDATED for new layout)
  field25: { width: '24%', marginBottom: 8 },
  field33: { width: '32%', marginBottom: 8 }, // For 3 equal columns
  field30: { width: '29%', marginBottom: 8 }, // Bigger vehicle field
  field20: { width: '19%', marginBottom: 8 },
  field15: { width: '14%', marginBottom: 8 },
  field75: { width: '74%', marginBottom: 8 }, // 3 parts for remarks
  fieldFull: { width: '100%', marginBottom: 8 },

  // Labels & Inputs
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#333',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#fff',
    fontSize: 14,
  },

  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },

  // Radio Button Styling
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },

  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },

  radioCircle: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  selectedDot: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },

  radioText: {
    fontSize: 14,
    color: '#333',
  },

  // Vehicle Input Row
  vehicleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },

  // ✅ FIXED: Clean Table Styles for Redmi Pad 2
  cleanTableContainer: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden',
  },

  tableScrollView: {
    maxHeight: 400,
  },

  tableWrapper: {
    backgroundColor: '#ffffff',
  },

  // ✅ FIXED: Header Row - Perfectly aligned
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    height: 50,
    borderBottomWidth: 2,
    borderBottomColor: '#0056b3',
    alignItems: 'center',
  },

  tableHeaderCell: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },

  tableHeaderText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
    flexWrap: 'wrap',
  },

  // ✅ FIXED: Data Container for vertical scrolling
  tableDataContainer: {
    maxHeight: 350,
    backgroundColor: '#ffffff',
  },

  // ✅ FIXED: Data Row - Clean structure
  tableDataRow: {
    flexDirection: 'row',
    height: 45,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    alignItems: 'center',
  },

  // ✅ FIXED: Table Cell - Uniform styling
  tableCell: {
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
  },

  // Row alternating colors
  evenRow: {
    backgroundColor: '#f8f9fa',
  },

  oddRow: {
    backgroundColor: '#ffffff',
  },

  // ✅ FIXED: Cell Text - Clean and readable
  cellText: {
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 13,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },

  // Status Container
  statusContainer: {
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  statusText: {
    fontSize: 13,
    color: '#666',
  },

  // Search Results Container
  searchResultsContainer: {
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },

  searchResultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#155724',
    marginBottom: 4,
  },

  selectedCountText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
  },

  // Empty Results
  noResultsContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },

  noResultsText: {
    fontSize: 16,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: 'bold',
  },

  noResultsSubtext: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },

  manualEntryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  manualEntryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Scroll Hint
  scrollHintContainer: {
    backgroundColor: '#fff3cd',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ffeaa7',
  },

  scrollHintText: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Action Buttons
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingHorizontal: 8,
    flexWrap: 'wrap',
  },

  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  submitButton: {
    backgroundColor: '#28a745',
  },

  manualButton: {
    backgroundColor: '#17a2b8',
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
    fontSize: 14,
    textAlign: 'center',
  },

  // Loading States
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

  // ✅ LEGACY TABLE STYLES (keeping for backward compatibility)
  tableContainer: {
    maxHeight: 400,
    backgroundColor: 'white',
  },

  table: {
    backgroundColor: 'white',
  },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    alignItems: 'center',
  },

  tableHeader: {
    backgroundColor: '#007bff',
    height: 50,
  },

  // Column Width Classes
  col70: { width: 70, minWidth: 70 },
  col80: { width: 80, minWidth: 80 },
  col90: { width: 90, minWidth: 90 },
  col100: { width: 100, minWidth: 100 },
  col110: { width: 110, minWidth: 110 },
  col120: { width: 120, minWidth: 120 },
  col130: { width: 130, minWidth: 130 },
  col140: { width: 140, minWidth: 140 },
  col150: { width: 150, minWidth: 150 },
  col160: { width: 160, minWidth: 160 },
  col200: { width: 200, minWidth: 200 },

  // Checkbox styling
  checkbox: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },

  // Responsive Design for Redmi Pad 2
  '@media (max-width: 768px)': {
    cardContainer: {
      marginHorizontal: 8,
      padding: 12,
    },
    
    row: {
      flexDirection: 'column',
    },
    
    field25: {
      width: '100%',
      marginBottom: 12,
    },
    
    field33: {
      width: '100%',
      marginBottom: 12,
    },
    
    field40: {
      width: '100%',
      marginBottom: 12,
    },
    
    field35: {
      width: '100%',
      marginBottom: 12,
    },
    
    field10: {
      width: '48%',
      marginBottom: 12,
    },
    
    field75: {
      width: '100%',
      marginBottom: 12,
    },
    
    vehicleInputRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    
    searchButton: {
      marginTop: 8,
      alignSelf: 'center',
    },
    
    buttonRow: {
      flexDirection: 'column',
      alignItems: 'center',
    },
    
    button: {
      width: '80%',
      marginVertical: 6,
    },
    
    tableScrollView: {
      maxHeight: 300,
    },
    
    tableHeaderText: {
      fontSize: 10,
    },
    
    cellText: {
      fontSize: 9,
    },
  },

  // Tablet Responsive (Redmi Pad 2 specific)
  '@media (min-width: 769px) and (max-width: 1024px)': {
    field25: {
      width: '23%',
    },
    
    field33: {
      width: '31%',
    },
    
    field40: {
      width: '38%',
    },
    
    field35: {
      width: '33%',
    },
    
    field10: {
      width: '12%',
    },
    
    field75: {
      width: '73%',
    },
    
    tableHeaderText: {
      fontSize: 11,
    },
    
    cellText: {
      fontSize: 10,
    },
  },

  // Accessibility
  accessibilityLabel: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },

  focusedInput: {
    borderColor: '#007bff',
    borderWidth: 2,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // ✅ OPTIMIZED TABLE STYLES (NEW)
  optimizedTableContainer: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden',
  },

  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    height: 50,
    borderBottomWidth: 2,
    borderBottomColor: '#0056b3',
  },

  tableHeaderCell: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },

  tableHeaderText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 13,
  },

  tableDataList: {
    backgroundColor: '#ffffff',
  },

  tableDataRow: {
    flexDirection: 'row',
    height: 45,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  tableDataCell: {
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
  },

  tableCellText: {
    fontSize: 10,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 12,
  },

  checkboxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },

  tableCheckbox: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});

export default styles;