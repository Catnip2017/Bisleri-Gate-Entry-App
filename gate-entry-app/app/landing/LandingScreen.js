
// app/landing/LandingScreen.js - MERGED Multi-Role Navigation
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import styles from "./LandingScreenStyles";
import { storage } from "../../utils/storage";
import { getCurrentUser } from "../../utils/jwtUtils";
import { authAPI } from "../../services/api";

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
      Alert.alert("Access Denied", "You don't have Admin privileges.");
    }
  };

  const handleSecurityCardPress = () => {
    if (hasRole("securityguard") || hasRole("itadmin")) {
      router.push("/security");
    } else {
      Alert.alert("Access Denied", "You don't have Security privileges.");
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      performLogout();
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: performLogout },
      ]);
    }
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

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Bisleri Gate Entry Management System</Text>

        <View style={styles.cardContainer}>
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
