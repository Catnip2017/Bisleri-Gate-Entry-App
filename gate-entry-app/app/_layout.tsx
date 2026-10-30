// app/_layout.tsx - MERGED with Admin Routes
//
// 30 Oct 2026: the native navigator theme (React Navigation's own
// DarkTheme/DefaultTheme) and the status bar style used to follow the
// device's OS-level colour scheme (useColorScheme()) — a completely
// different signal from the app's own in-app dark-mode toggle in
// contexts/ThemeContext.js. The two could disagree (e.g. phone set to
// light, user manually switches the app to dark) and leave the navigator
// background / status bar icons mismatched with the rest of the app.
// Now both follow the app's own `isDark` from useTheme() instead, so
// there is exactly one dark-mode signal in the app.
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { CustomAlertProvider } from '../utils/customModal';
import { ThemeProvider as AppThemeProvider, useTheme } from '../contexts/ThemeContext';
import { LogBox } from 'react-native';

// Suppress all LogBox popups — errors are handled via custom Alert popups only
LogBox.ignoreAllLogs();

// Must live INSIDE AppThemeProvider so useTheme() has a provider to read
// from — this is what drives the native navigator theme and the status
// bar off the app's own dark-mode state instead of the OS setting.
function AppNavigator() {
  const { isDark } = useTheme();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Authentication Flow */}
        <Stack.Screen name="index" />
        <Stack.Screen name="LoginScreen" />

        {/* Landing Screen */}
        <Stack.Screen name="landing/index" />

        {/* ✅ MERGED: Complete Admin Routes */}
        <Stack.Screen
          name="admin/index"
          options={{
            title: 'Admin Dashboard',
            headerShown: false,
          }}
        />

        {/* ✅ MERGED: Security Routes */}
        <Stack.Screen
          name="security/index"
          options={{
            title: 'Security Dashboard',
            headerShown: false,
          }}
        />

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
      {/* "light" = light-coloured icons for a dark background, "dark" =
          dark-coloured icons for a light background — explicit, tied to
          the app's own toggle, not "auto" (which read the OS setting). */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <CustomAlertProvider>
        <AppNavigator />
      </CustomAlertProvider>
    </AppThemeProvider>
  );
}
