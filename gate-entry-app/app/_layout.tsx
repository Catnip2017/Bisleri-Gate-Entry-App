// // app/_layout.tsx - FIXED: Complete with Security Routes
// import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// import { useFonts } from 'expo-font';
// import { Stack } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import React, { useEffect, useState } from 'react';
// import { useColorScheme } from '@/hooks/useColorScheme';
// import * as SecureStore from 'expo-secure-store';
// import { CustomAlertProvider } from '../utils/customModal';


// export default function RootLayout() {
//   const colorScheme = useColorScheme();
//   const [loaded] = useFonts({
//     SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
//   });

//   if (!loaded) {
//     return null;
//   }

//   return (
//     <CustomAlertProvider>  {/* ADD THIS WRAPPER */}
//       <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//         <Stack screenOptions={{ headerShown: false }}>
//           <Stack.Screen name="LoginScreen" />
//           <Stack.Screen name="landing/index" />
//           <Stack.Screen name="(tabs)" />
//           <Stack.Screen name="+not-found" />
//         </Stack>
//         <StatusBar style="auto" />
//       </ThemeProvider>
//     </CustomAlertProvider>  
//   );
// }
// app/_layout.tsx - MERGED with Admin Routes
  
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as SecureStore from 'expo-secure-store';
import { CustomAlertProvider } from '../utils/customModal';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <CustomAlertProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
        <StatusBar style="auto" />
      </ThemeProvider>
    </CustomAlertProvider>  
  );
}