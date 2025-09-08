// // app/landing/LandingScreen.js - Updated with cross-platform storage and universal navigation
// import React, { useState, useEffect } from "react";
// import {
//   View,
//   Text,
//   Image,
//   TouchableOpacity,
//   Pressable,
//   SafeAreaView,
//   ActivityIndicator,
//   Platform
// } from "react-native";
// import { useRouter } from 'expo-router';
// import { storage } from "../../utils/storage";
// import styles from "./LandingScreenStyles";
// import { getCurrentUser, isAdmin, isSecurityGuard } from "../../utils/jwtUtils";
// import { authAPI } from "../../services/api";
// import { showAlert } from '../../utils/customModal';


// export default function LandingScreen() {
//   const router = useRouter();
//   const [user, setUser] = useState(null);
//   const [isLoading, setIsLoading] = useState(true);

//   // Load user data when component mounts
//   useEffect(() => {
//     loadUserData();
//   }, []);

//   const loadUserData = async () => {
//     try {
//       const userData = await getCurrentUser();
//       if (!userData) {
//         router.replace('/LoginScreen');
//         return;
//       }
//       setUser(userData);
//     } catch (error) {
//       console.error('Error loading user data:', error);
//       router.replace('/LoginScreen');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleAdminCardPress = async () => {
//     try {
//       const userIsAdmin = await isAdmin();
//       if (userIsAdmin) {
//         if (Platform.OS === 'web') {
//           // Navigate directly on web
//           router.push('/admin');
//         } else {
//           // Use alert on native
//           showAlert(
//             "Admin Access",
//             "Navigating to Administrator Panel...",
//             [
//               { text: "OK", onPress: () => router.push('/admin') },
//               { text: "Cancel", style: "cancel" }
//             ]
//           );
//         }
//       } else {
//         showAlert(
//           "Access Denied",
//           "You don't have administrator privileges.",
//           [{ text: "OK" }]
//         );
//       }
//     } catch (error) {
//       console.error('Error checking admin access:', error);
//       showAlert("Error", "Unable to verify access permissions.");
//     }
//   };

//   const handleSecurityCardPress = async () => {
//     try {
//       const current = await getCurrentUser();
//       console.log('Current user data:', current);
//       console.log('User role:', current?.role);

//       const userIsSecurity = await isSecurityGuard();
//       console.log('Is security guard check result:', userIsSecurity);

//       if (userIsSecurity) {
//         if (Platform.OS === 'web') {
//           // On web, navigate immediately
//           router.push('/security');
//         } else {
//           // On native, confirm before navigating
//           showAlert(
//             "Security Access",
//             "Navigating to Security Guard Panel...",
//             [
//               { text: "OK", onPress: () => router.push('/security') },
//               { text: "Cancel", style: "cancel" }
//             ]
//           );
//         }
//       } else {
//         showAlert(
//           "Access Denied",
//           `You don't have security guard privileges. Your role: ${current?.role}`,
//           [{ text: "OK" }]
//         );
//       }
//     } catch (error) {
//       console.error('Error checking security access:', error);
//       showAlert("Error", "Unable to verify access permissions.");
//     }
//   };

//  // CHANGE handleLogout:
// const handleLogout = () => {
//   showAlert( // CHANGED
//     "Logout Confirmation",
//     "Are you sure you want to logout?",
//     [
//       {
//         text: "Cancel",
//         style: "cancel"
//       },
//       {
//         text: "Logout",
//         style: "destructive",
//         onPress: performLogout
//       }
//     ]
//   );
// };



// const performLogout = async () => {
//   try {
//     // Call backend logout (optional)
//     await authAPI.logout();
//   } catch (error) {
//     console.error('Logout API error:', error);
//   } finally {
//     // ✅ ENHANCED: Clear all stored data
//     try {
//       await SecureStore.deleteItemAsync('access_token');
      
//       // ✅ ADDED: Clear any cached user data
//       setUser(null);
      
//       // ✅ ADDED: Force immediate redirect
//       router.replace('/LoginScreen');
      
//     } catch (clearError) {
//       console.error('Error clearing data:', clearError);
//       // Force redirect anyway
//       router.replace('/LoginScreen');
//     }
//   }
// };
//   if (isLoading) {
//     return (
//       <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
//         <ActivityIndicator size="large" color="#007bff" />
//         <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>Loading...</Text>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       {/* Header */}
//       <View style={styles.header}>
//         <Image
//           source={require("../../assets/images/bisleri-logo.png")}
//           style={styles.logo}
//           resizeMode="contain"
//         />
//         {user && (
//           <View style={styles.welcomeContainer}>
//             <Text style={styles.welcomeText}>Welcome, {user.fullName || `${user.firstName} ${user.lastName}`}</Text>
//             <Text style={styles.roleText}>Role: {user.role}</Text>
//           </View>
//         )}
//       </View>

//       {/* Main Content */}
//       <View style={styles.content}>
//         <Text style={styles.heading}>Bisleri Gate Entry Management System</Text>

//         <View style={styles.cardContainer}>
//           {/* Admin */}
//           <TouchableOpacity
//             style={[styles.card, styles.adminCard]}
//             onPress={handleAdminCardPress}
//             activeOpacity={0.7}
//           >
//             <View style={styles.cardIconContainer}>
//               <Image
//                 source={require("../../assets/images/admin.png")}
//                 style={styles.icon}
//                 tintColor="#2b6cb0"
//               />
//             </View>
//             <Text style={styles.cardText}>Administrator</Text>
//           </TouchableOpacity>

//           {/* Security */}
//           <TouchableOpacity
//             style={[styles.card, styles.guardCard]}
//             onPress={handleSecurityCardPress}
//             activeOpacity={0.7}
//           >
//             <View style={styles.cardIconContainer}>
//               <Image
//                 source={require("../../assets/images/guard.png")}
//                 style={styles.icon}
//                 tintColor="#2b6cb0"
//               />
//             </View>
//             <Text style={styles.cardText}>Security Guard</Text>
//           </TouchableOpacity>
//         </View>

//         {/* Logout */}
//         <Pressable
//           style={({ pressed }) => [
//             styles.logout,
//             pressed && styles.logoutPressed,
//           ]}
//           onPress={handleLogout}
//         >
//           <Text style={styles.logoutText}>Logout</Text>
//         </Pressable>
//       </View>
//     </SafeAreaView>
//   );
// }

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
