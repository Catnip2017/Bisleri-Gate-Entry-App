// app/index.js - Updated with cross-platform storage
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '../utils/storage';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Small delay to prevent flash
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if storage is available
      if (!storage.isAvailable()) {
        console.warn('Storage not available, redirecting to login');
        router.replace('/LoginScreen');
        return;
      }
      
      const token = await storage.getItem('access_token');
      
      if (token) {
        console.log('Token found, redirecting to landing page');
        // User has token, go to landing screen
        router.replace('/landing/');
      } else {
        console.log('No token found, redirecting to login');
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