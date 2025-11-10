import { StyleSheet } from "react-native";

const CELL_WIDTH = 120;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f4f4f4",
    flexGrow: 1,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "100%",             // ✅ was "95%"
    maxWidth: 1400,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#ccc",
    paddingBottom: 200,   
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1976d2",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },

  // ✅ Insight Type Toggle Styles
  insightTypeContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  insightTypeLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  insightTypeRow: {
    flexDirection: "row",
    gap: 10,
  },
  insightTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    backgroundColor: "#f8f9fa",
    minWidth: 120,
    alignItems: "center",
  },
  insightTypeButtonActive: {
    borderColor: "#1976d2",
    backgroundColor: "#e3f2fd",
  },
  insightTypeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  insightTypeButtonTextActive: {
    color: "#1976d2",
  },

  // ✅ FIXED: Search Container and Dropdown Styles (matching RegisterScreen pattern)
  searchContainer: {
    position: "relative",
    marginBottom: 15,
    zIndex: 9999,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    maxHeight: 200,
    zIndex: 9999,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  dropdownItemCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 2,
  },
  dropdownItemName: {
    fontSize: 13,
    color: "#666",
  },

  // ✅ Input filled state
  inputFilled: {
    backgroundColor: "#e8f5e8",
    borderColor: "#28a745",
    borderWidth: 2,
  },

  // ✅ Date Picker Styles
  datePickerButton: {
    borderWidth: 1,
    borderColor: "#888",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: "#fff",
    justifyContent: "flex-start",
    minHeight: 38,
  },
  datePickerText: {
    fontSize: 13,
    color: "#333",
    textAlign: "left",
    width: "100%",  
  },

  inputRow: {
    marginBottom: 12,
    alignItems: "center",
  },
  inputInline: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    flexWrap: "wrap",          // ✅ default for tablet / small screens
    gap: 10,
    paddingHorizontal: 10,
  },

  inputInlineWide: {
  flexWrap: "nowrap",
  justifyContent: "center",  // ✅ centers the items in the row
  alignItems: "flex-end",
  gap: 15,                   // ✅ even spacing between fields
  width: "100%",              // ✅ controls how wide the row looks (adjust 65–80%)
  alignSelf: "center"        // ✅ keeps bottom aligned
},
  inputBox: {
    flexBasis: "48%",          // ✅ two per row on tablet/phone
    maxWidth: "48%",
    minWidth: 160,
    flexGrow: 1,
    marginVertical: 6, 
  },
  inputBoxCompact: {
  flexBasis: "48%",   // two per row for tablets
  maxWidth: "48%",
  marginVertical: 6,
},

inputBoxWide: {
  flexBasis: "18%",          // ✅ desktop/web = 5 items per row
  maxWidth: "18%",
  marginVertical: 6,
  flexShrink: 1,
  flexGrow: 1,
},

  inputReadOnly: {
    backgroundColor: "#f5f5f5",
    color: "#000", // ensure dark text is visible
  },
  input: {
    borderWidth: 1,
    borderColor: "#888",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 4,
    fontSize: 13,
    backgroundColor: "#fff",
  },
  showButton: {
    backgroundColor: "#1976d2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: "center",
    alignSelf: "center",
    height: 38,
    marginTop: 16,
    marginLeft: 6,
  },
  showButtonText: {
    fontWeight: "bold",
    color: "#fff",
    fontSize: 14,
  },
  summaryBox: {
    flexDirection: "row",
    backgroundColor: "#e3f2fd",
    padding: 15,
    justifyContent: "space-around",
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bbdefb",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryCount: {
    fontWeight: "bold",
    fontSize: 20,
    color: "#1976d2",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  tableContainer: {
    marginTop: 20,
  },
  tableTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 10,
    color: "#333",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1976d2",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  headerCell: {
    width: CELL_WIDTH,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontWeight: "bold",
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#1565c0",
    color: "#fff",
    fontSize: 11,
  },
  cell: {
    width: CELL_WIDTH,
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 10,
    color: "#333",
  },
  noDataText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    marginTop: 20,
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },

  // ADD THESE NEW STYLES FOR DOWNLOAD BUTTONS:
  downloadButtonContainer: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: 20,
    paddingRight: 20,
  },
  downloadButton: {
    backgroundColor: "#28a745",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  downloadButtonDisabled: {
    backgroundColor: "#6c757d",
    opacity: 0.6,
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Excel button style
  downloadButtonExcel: {
    backgroundColor: "#007bff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  inputDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#ccc",
    color: "#666",
  },

  paginationInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 4,
    marginBottom: 10,
  },
  paginationText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  paginationControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 20,
  },
  paginationButton: {
    padding: 10,
    backgroundColor: "#007bff",
    borderRadius: 6,
    minWidth: 45,
    alignItems: "center",
  },
  paginationButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  paginationButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  pageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pageInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    width: 50,
    textAlign: "center",
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pageInputLabel: {
    fontSize: 14,
    color: "#666",
  },
});

export default styles;
