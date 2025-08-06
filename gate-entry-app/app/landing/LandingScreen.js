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
} from "react-native";
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import styles from "./LandingScreenStyles";
import { getCurrentUser, isAdmin, isSecurityGuard } from "../../utils/jwtUtils";
import { authAPI } from "../../services/api";

export default function LandingScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user data when component mounts
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getCurrentUser();
      if (!userData) {
        // No valid token, redirect to login
        router.replace('/LoginScreen');
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
      router.replace('/LoginScreen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminCardPress = async () => {
    try {
      const userIsAdmin = await isAdmin();
      
      if (userIsAdmin) {
        // ✅ User is admin - navigate to admin panel
        Alert.alert(
          "Admin Access", 
          "Navigating to Administrator Panel...",
          [
            {
              text: "OK",
              onPress: () => {
                // TODO: Navigate to admin screens
                console.log("Navigate to admin panel");
                // router.push('/admin'); // Will implement later
              }
            }
          ]
        );
      } else {
        // ❌ User is not admin - show no access message
        Alert.alert(
          "Access Denied", 
          "You don't have administrator privileges.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      Alert.alert("Error", "Unable to verify access permissions.");
    }
  };

  const handleSecurityCardPress = async () => {
    try {
      const user = await getCurrentUser();
      console.log('Current user data:', user); // Debug log
      console.log('User role:', user?.role); // Debug log
      
      const userIsSecurity = await isSecurityGuard();
      console.log('Is security guard check result:', userIsSecurity); // Debug log
      
      if (userIsSecurity) {
        // ✅ User is security guard - navigate to security functions
        Alert.alert(
          "Security Access", 
          "Navigating to Security Guard Panel...",
          [
            {
              text: "OK",
              onPress: () => {
                // Navigate to security dashboard
                router.push('/security/');
              }
            }
          ]
        );
      } else {
        // ❌ User is not security guard - show no access message
        Alert.alert(
          "Access Denied", 
          `You don't have security guard privileges. Your role: ${user?.role}`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error checking security access:', error);
      Alert.alert("Error", "Unable to verify access permissions.");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout Confirmation",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: performLogout
        }
      ]
    );
  };

  const performLogout = async () => {
    try {
      // Call backend logout (optional)
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API fails
    } finally {
      // Clear token and redirect to login
      await SecureStore.deleteItemAsync('access_token');
      router.replace('/LoginScreen');
    }
  };

  // Show loading while getting user data
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Logo */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/bisleri-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        
        {/* Welcome Message */}
        {user && (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome, {user.fullName}</Text>
            <Text style={styles.roleText}>Role: {user.role}</Text>
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Bisleri Gate Entry Management System</Text>

        <View style={styles.cardContainer}>
          {/* Administrator Card */}
          <TouchableOpacity 
            style={[styles.card, styles.adminCard]}
            onPress={handleAdminCardPress}
            activeOpacity={0.7}
          >
            <View style={styles.cardIconContainer}>
              <Image
                source={require("../../assets/images/admin.png")}
                style={styles.icon}
                tintColor="#2b6cb0"
              />
            </View>
            <Text style={styles.cardText}>Administrator</Text>
          </TouchableOpacity>

          {/* Security Guard Card */}
          <TouchableOpacity 
            style={[styles.card, styles.guardCard]}
            onPress={handleSecurityCardPress}
            activeOpacity={0.7}
          >
            <View style={styles.cardIconContainer}>
              <Image
                source={require("../../assets/images/guard.png")}
                style={styles.icon}
                tintColor="#2b6cb0"
              />
            </View>
            <Text style={styles.cardText}>Security Guard</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <Pressable
          style={({ pressed }) => [
            styles.logout,
            pressed && styles.logoutPressed,
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}