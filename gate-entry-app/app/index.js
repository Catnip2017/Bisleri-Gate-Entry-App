// app/index.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Small delay to prevent flash
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const token = await SecureStore.getItemAsync('access_token');
      
      if (token) {
        // User has token, go to landing screen
        router.replace('/landing/');
      } else {
        // No token, go to login screen
        router.replace('/LoginScreen');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      // On error, go to login
      router.replace('/LoginScreen');
    }
  };

  // Show loading screen while checking auth
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#E0F7FA' 
    }}>
      <ActivityIndicator size="large" color="#007bff" />
    </View>
  );
}