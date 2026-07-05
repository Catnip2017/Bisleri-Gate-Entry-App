
// app/landing/LandingScreen.js - MERGED Multi-Role Navigation
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import styles from "./LandingScreenStyles";
import { storage } from "../../utils/storage";
import { getCurrentUser } from "../../utils/jwtUtils";
import { authAPI } from "../../services/api";
import { showAlert } from "../../utils/customModal";

export default function LandingScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const userData = await getCurrentUser();
        if (!userData) {
          router.replace("/LoginScreen");
          return;
        }

        // 🔹 Normalize roles into an array
        const rolesArray = userData.roles && Array.isArray(userData.roles)
          ? userData.roles.map(r => r.trim().toLowerCase().replace(/\s+/g, ""))
          : userData.role
            ? userData.role.split(",").map(r => r.trim().toLowerCase().replace(/\s+/g, ""))
            : [];

        setUser({ ...userData, roles: rolesArray });
        console.log("✅ Normalized user roles:", rolesArray);
      } catch (e) {
        console.error("Error loading user data:", e);
        router.replace("/LoginScreen");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 🔹 Helper to check if user has a role
  const hasRole = (roleName) => {
    if (!user || !user.roles) return false;
    return user.roles.includes(roleName.toLowerCase());
  };

  const handleAdminCardPress = () => {
    if (hasRole("securityadmin") || hasRole("itadmin")) {
      router.push("/admin/AdminDashboard");
    } else {
      showAlert("Access Denied", "You do not have Admin privileges.");
    }
  };

  const handleSecurityCardPress = () => {
    if (hasRole("securityguard") || hasRole("itadmin")) {
      router.push("/security");
    } else {
      showAlert("Access Denied", "You do not have Security Guard privileges.");
    }
  };

  const handleAdminHubPress = () => {
    router.push('/admin-hub');
  };

  const handleLogout = () => {
    showAlert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: performLogout },
    ]);
  };

  const performLogout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      console.error("Logout API error:", e);
    } finally {
      await storage.removeItem("access_token");
      router.replace("/LoginScreen");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { justifyContent: "center", alignItems: "center" }]}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const roleDisplayName = {
    securityadmin: "Security Admin",
    itadmin: "IT Admin",
    securityguard: "Security Guard",
  };

  const displayRoles = user?.roles
    ?.map(r => roleDisplayName[r] || r)
    .join(", ");

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/bisleri-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        {user && (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              Welcome, {user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
            </Text>
            <Text style={styles.roleText}>Role: {displayRoles}</Text>
          </View>
        )}
      </View>

      {/* Top-left back navigation */}
      {user && hasRole("itadmin") && (
        <View style={styles.topLeftRow}>
          <Pressable onPress={handleAdminHubPress} style={styles.adminHubLink}>
            <Text style={styles.adminHubLinkText}>← Admin Hub</Text>
          </Pressable>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Bisleri Gate Entry Management System</Text>

        <View style={styles.cardContainer}>
          {/* Only render the cards this user can actually open — being told
              "Access Denied" by your own home screen every day is bad UX. */}
          {(hasRole("securityadmin") || hasRole("itadmin")) && (
            <TouchableOpacity
              style={[styles.card, styles.adminCard]}
              onPress={handleAdminCardPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open Administrator dashboard"
            >
              <View style={styles.cardIconContainer}>
                <Image source={require("../../assets/images/admin.png")} style={styles.icon} />
              </View>
              <Text style={styles.cardText}>Administrator</Text>
              <Text style={{ fontSize: 12, color: "#666", marginTop: 4, textAlign: "center" }}>
                Insights, reports and exports
              </Text>
            </TouchableOpacity>
          )}

          {(hasRole("securityguard") || hasRole("itadmin")) && (
            <TouchableOpacity
              style={[styles.card, styles.guardCard]}
              onPress={handleSecurityCardPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open Security Guard dashboard"
            >
              <View style={styles.cardIconContainer}>
                <Image source={require("../../assets/images/guard.png")} style={styles.icon} />
              </View>
              <Text style={styles.cardText}>Security Guard</Text>
              <Text style={{ fontSize: 12, color: "#666", marginTop: 4, textAlign: "center" }}>
                Gate entries and movements
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
