// app/_layout.tsx - FIXED: Complete with Security Routes
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as SecureStore from 'expo-secure-store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Authentication Flow */}
        <Stack.Screen name="index" />
        <Stack.Screen name="LoginScreen" />
        
        {/* Landing Screen */}
        <Stack.Screen name="landing/index" />
        
        {/* ✅ FIXED: Security Routes - This was missing! */}
        <Stack.Screen 
          name="security/index" 
          options={{
            title: 'Security Dashboard',
            headerShown: false,
          }}
        />
        
        {/* ✅ FIXED: Security Manual Entry Route */}
        <Stack.Screen 
          name="security/manual-entry/index" 
          options={{
            title: 'Manual Entry',
            headerShown: false,
          }}
        />
        
        {/* Tabs (for future use) */}
        <Stack.Screen name="(tabs)" />
        
        {/* 404 Screen */}
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}