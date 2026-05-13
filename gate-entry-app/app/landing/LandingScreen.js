
// app/landing/LandingScreen.js - MERGED Multi-Role Navigation + Co Packer Card
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
import { authAPI, copackerAPI } from "../../services/api";
import { showAlert } from "../../utils/customModal";

export default function LandingScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copackerFeatureEnabled, setCopackerFeatureEnabled] = useState(false);

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

        // Check Co Packer feature flag (only matters if user has copacker role)
        if (rolesArray.includes("copacker") || rolesArray.includes("itadmin")) {
          try {
            const featureStatus = await copackerAPI.featureStatus();
            setCopackerFeatureEnabled(featureStatus.enabled === true);
          } catch (e) {
            console.warn("Could not fetch copacker feature status:", e);
            setCopackerFeatureEnabled(false);
          }
        }
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

  const handleCopackerCardPress = () => {
    if (hasRole("copacker") || hasRole("itadmin")) {
      router.push("/copacker");
    } else {
      showAlert("Access Denied", "You do not have Co Packer privileges.");
    }
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
    copacker: "Co Packer",
  };

  const displayRoles = user?.roles
    ?.map(r => roleDisplayName[r] || r)
    .join(", ");

  // Show Co Packer card if: feature is enabled AND user has copacker or itadmin role
  const showCopackerCard =
    copackerFeatureEnabled &&
    (hasRole("copacker") || hasRole("itadmin"));

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

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Bisleri Gate Entry Management System</Text>

        <View style={[
          styles.cardContainer,
          showCopackerCard && styles.cardContainerThree
        ]}>
          {/* Admin Card */}
          <TouchableOpacity
            style={[styles.card, styles.adminCard]}
            onPress={handleAdminCardPress}
            activeOpacity={0.7}
          >
            <View style={styles.cardIconContainer}>
              <Image source={require("../../assets/images/admin.png")} style={styles.icon} />
            </View>
            <Text style={styles.cardText}>Administrator</Text>
          </TouchableOpacity>

          {/* Security Card */}
          <TouchableOpacity
            style={[styles.card, styles.guardCard]}
            onPress={handleSecurityCardPress}
            activeOpacity={0.7}
          >
            <View style={styles.cardIconContainer}>
              <Image source={require("../../assets/images/guard.png")} style={styles.icon} />
            </View>
            <Text style={styles.cardText}>Security Guard</Text>
          </TouchableOpacity>

          {/* Co Packer Card — visible only when feature enabled + role matches */}
          {showCopackerCard && (
            <TouchableOpacity
              style={[styles.card, styles.copackerCard]}
              onPress={handleCopackerCardPress}
              activeOpacity={0.7}
            >
              <View style={styles.cardIconContainer}>
                <Text style={styles.copackerEmoji}>📦</Text>
              </View>
              <Text style={styles.cardText}>Co Packer</Text>
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
