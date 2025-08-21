import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    elevation: 2,
  },
  menuButton: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  logo: {
    width: 120,
    height: 40,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 10,
  },
  homeButton: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  homeButtonText: {
    color: "#1976d2",
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#ffebee",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: "#d32f2f",
    fontWeight: "600",
  },

  // Layout
  body: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 250,
    backgroundColor: "#E0F7FA",
    padding: 20,
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1976d2",
  },
  sidebarItem: {
    fontSize: 14,
    color: "#424242",
    marginBottom: 10,
    fontWeight: "500",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingHorizontal: 10,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#1976d2",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#1976d2",
    fontWeight: "600",
  },

  // Content
  screenContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  denied: {
    color: "red",
    textAlign: "center",
    marginTop: 20,
  },
});