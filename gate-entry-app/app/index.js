// app/index.js - FIXED
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const token = await storage.getItem('access_token'); // CHANGED
      
      if (token) {
        try {
          const { getCurrentUser } = await import('../utils/jwtUtils');
          const userData = await getCurrentUser();
          
          if (userData && userData.username) {
            router.replace('/landing/');
          } else {
            await storage.removeItem('access_token'); // CHANGED
            router.replace('/LoginScreen');
          }
        } catch (tokenValidationError) {
          console.error('Token validation failed:', tokenValidationError);
          await storage.removeItem('access_token'); // CHANGED
          router.replace('/LoginScreen');
        }
      } else {
        router.replace('/LoginScreen');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      await storage.removeItem('access_token'); // CHANGED
      router.replace('/LoginScreen');
    }
  };

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