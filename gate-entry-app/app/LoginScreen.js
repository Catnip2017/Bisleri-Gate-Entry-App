// app/LoginScreen.js - MERGED with Custom Alert
// UI enhancements (July 2026):
//  - Enter/Next keyboard chain: username -> password -> submit
//  - Show/hide password toggle (48dp target)
//  - Button color from theme tokens (was hardcoded cyan)
//  - "Contact your IT Admin" hint for locked-out users
//  - Password managers allowed (autoComplete "current-password")
//  - Removed console.log of roles/route on successful login
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import styles from './LoginScreen_Styles';
import { useRouter } from 'expo-router';
import { storage } from '../utils/storage';
import { authAPI, handleAPIError } from '../services/api';
import { showAlert } from '../utils/customModal';
import { getCurrentUser, getRoleBasedRoute } from '../utils/jwtUtils';
import { colors } from '../utils/theme';
import { brand } from '../contexts/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);
  // 25 Nov 2026 UI overhaul: two-column layout on wide screens (bottle panel +
  // sign-in form), single column on phones. Logic below is unchanged.
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  // Check if user was redirected here due to session expiry
  useEffect(() => {
    const checkSessionExpiry = async () => {
      try {
        const expired = await storage.getItem('session_expired');
        if (expired === 'true') {
          await storage.removeItem('session_expired');
          showAlert(
            'Session Expired',
            'Your session has expired. Please login again to continue.'
          );
        }
      } catch (e) {
        // Ignore storage errors on this check
      }
    };
    checkSessionExpiry();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showAlert('Error', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.login({
        username: username.trim(),
        password: password,
      });

      const { access_token } = response;

      if (!access_token) {
        throw new Error('No access token received');
      }

      // Store the token securely using cross-platform storage
      await storage.setItem('access_token', access_token);

      // Decode role from the new token and route accordingly
      const userData = await getCurrentUser();

      // Block login entirely if no role has been assigned
      if (!userData?.roles || userData.roles.length === 0) {
        await storage.removeItem('access_token');
        showAlert(
          'Access Not Assigned',
          'Your account has not been given any access yet. Contact your IT Admin to assign you a role before you can use this application.'
        );
        return;
      }

      const route = getRoleBasedRoute(userData.roles);
      router.replace(route);

    } catch (error) {
      console.error('Login failed', error);
      const errorMessage = handleAPIError(error);
      showAlert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      {/* Brand band — same teal gradient + water splash as the app header */}
      <View style={[styles.band, wide ? styles.bandWide : styles.bandNarrow,
        Platform.OS === 'web' ? { backgroundImage: brand.headerGradient } : null]}>
        {wide ? (
          <Image
            source={require('../assets/images/header-water.png')}
            style={styles.bandWater}
            resizeMode="cover"
            pointerEvents="none"
          />
        ) : null}
        {wide && Platform.OS === 'web' ? (
          <>
            <View pointerEvents="none" style={[styles.bandFade, { right: 400, backgroundImage: 'linear-gradient(90deg, rgba(0,183,156,1) 0%, rgba(0,183,156,0) 100%)' }]} />
            <View pointerEvents="none" style={[styles.bandFade, { right: 40, backgroundImage: 'linear-gradient(90deg, rgba(0,193,165,0) 0%, rgba(0,196,167,1) 100%)' }]} />
          </>
        ) : null}
        <View style={styles.bandBrand}>
          <Image
            source={require('../assets/images/bisleri-logo-white.png')}
            style={wide ? styles.bandLogoWide : styles.bandLogoNarrow}
            resizeMode="contain"
            accessibilityLabel="Bisleri"
          />
          <Text style={styles.bandSub}>OPS HUB</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, wide && styles.cardWide]}>
          {/* Left: product visual (wide screens only) */}
          {wide ? (
            <View style={styles.visualPane}>
              <Image
                source={require('../assets/images/bisleri-bottle.jpg')}
                style={styles.bottle}
                resizeMode="contain"
                accessibilityLabel="Bisleri bottle"
              />
            </View>
          ) : null}

          {/* Right: sign-in form */}
          <View style={[styles.formPane, wide && styles.formPaneWide]}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to Bisleri Ops Hub</Text>

            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="person-outline" size={20} color="#5B6B75" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter username"
                placeholderTextColor="#8B99A3"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                editable={!isLoading}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock-outline" size={20} color="#5B6B75" style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="Enter password"
                placeholderTextColor="#8B99A3"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
                textContentType="password"
                editable={!isLoading}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eye}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={22}
                  color="#5B6B75"
                />
              </TouchableOpacity>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Login"
              style={({ pressed, hovered }) => ({
                backgroundColor: isLoading
                  ? colors.disabled
                  : pressed
                    ? brand.maroonDark
                    : hovered
                      ? '#127A50'
                      : colors.primary,
                paddingVertical: 14,
                minHeight: 50,
                justifyContent: 'center',
                borderRadius: 10,
                marginTop: 26,
                ...styles.buttonShadow,
                opacity: isLoading ? 0.7 : 1,
              })}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </Pressable>

            <View style={styles.hintRow}>
              <MaterialIcons name="info-outline" size={15} color="#5B6B75" />
              <Text style={styles.hint}>
                Forgot your password? Contact your IT Admin to reset it.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
