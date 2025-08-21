// app/landing/LandingScreen.js
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
        // normalize role to lowercase
        userData.role = userData.role?.toLowerCase();
        setUser(userData);
      } catch (e) {
        console.error("Error loading user data:", e);
        router.replace("/LoginScreen");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleAdminCardPress = () => {
    if (!user) return;

    if (user.role === "Security Admin") {
      router.push("/admin/insights"); // admin -> only insights
    } else if (user.role === "itadmin") {
      router.push("/admin"); // itadmin -> full admin section
    } else {
      Alert.alert("Access Denied", "You don't have Security Admin privileges.");
    }
  };

  const handleSecurityCardPress = () => {
    if (!user) return;

    if (user.role === "Security Guard" || user.role === "IT Admin") {
      router.push("/security"); // security + itadmin
    } else {
      Alert.alert("Access Denied", "You don't have security privileges.");
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
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.roleText}>Role: {user.role}</Text>
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Bisleri Gate Entry Management System</Text>

        <View style={styles.cardContainer}>
          {/* Admin / ITAdmin */}
          {(user?.role === "Security Admin" || user?.role === "IT Admin") && (
            <TouchableOpacity
              style={[styles.card, styles.adminCard]}
              onPress={handleAdminCardPress}
              activeOpacity={0.7}
            >
              <View style={styles.cardIconContainer}>
                <Image
                  source={require("../../assets/images/admin.png")}
                  style={styles.icon}
                />
              </View>
              <Text style={styles.cardText}>
                {user.role === "Security Admin" ? "Admin Insights" : "Administrator"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Security / ITAdmin */}
          {(user?.role === "Security Guard" || user?.role === "IT Admin") && (
            <TouchableOpacity
              style={[styles.card, styles.guardCard]}
              onPress={handleSecurityCardPress}
              activeOpacity={0.7}
            >
              <View style={styles.cardIconContainer}>
                <Image
                  source={require("../../assets/images/guard.png")}
                  style={styles.icon}
                />
              </View>
              <Text style={styles.cardText}>Security Guard</Text>
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
