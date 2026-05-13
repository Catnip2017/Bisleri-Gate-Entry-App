// app/landing/LandingScreenStyles.js
import { StyleSheet, Platform } from "react-native";
import { BACKGROUND_PRIMARY } from '../../utils/platformColors';

const cardShadow = Platform.select({
  web: { boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)" },
  android: { elevation: 6 },
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_PRIMARY,
  },
  header: {
    padding: 20,
    backgroundColor: "#E0F7FA",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 55,
  },
  welcomeContainer: {
    alignItems: "flex-end",
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a365d",
  },
  roleText: {
    fontSize: 14,
    color: "#4a5568",
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 60,
    color: "#1a365d",
    textAlign: "center",
    lineHeight: 32,
  },

  // ── 2-card container (default) ────────────────────────────────────────────
  cardContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    marginBottom: 40,
    gap: 12,
  },

  // ── 3-card container (when Co Packer card shown) ──────────────────────────
  cardContainerThree: {
    maxWidth: 620,
    gap: 10,
  },

  // ── Card base ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    flex: 1,
    maxWidth: 180,
    aspectRatio: 0.85,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    ...cardShadow,
  },

  adminCard: {
    borderTopWidth: 4,
    borderTopColor: "#2b6cb0",
  },
  guardCard: {
    borderTopWidth: 4,
    borderTopColor: "#38a169",
  },
  copackerCard: {
    borderTopWidth: 4,
    borderTopColor: "#d97706",
  },

  cardIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ebf8ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  icon: {
    width: 46,
    height: 46,
  },
  copackerEmoji: {
    fontSize: 36,
  },
  cardText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#2d3748",
    textAlign: "center",
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: {
    backgroundColor: "#007bff",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    ...Platform.select({
      web: { boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.2)" },
      android: { elevation: 4 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
    }),
  },
  logoutPressed: {
    backgroundColor: "#4da3ff",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
});

export default styles;
