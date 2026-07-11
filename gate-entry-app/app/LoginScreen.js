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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import styles from './LoginScreen_Styles';
import { useRouter } from 'expo-router';
import { storage } from '../utils/storage';
import { authAPI, handleAPIError } from '../services/api';
import { showAlert } from '../utils/customModal';
import { getCurrentUser, getRoleBasedRoute } from '../utils/jwtUtils';
import { colors } from '../utils/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);

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
    <View style={styles.container}>
      <Image
        source={require('../assets/images/bisleri-logo.png')}
        style={styles.topLogo}
        resizeMode="contain"
      />

      <View style={styles.loginBox}>
        <View style={styles.header}>
          <Text style={styles.title}>Gate Entry Portal</Text>
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.label}>Username:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="#555"
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

        <View style={styles.inputRow}>
          <Text style={styles.label}>Password:</Text>
          <View style={{ flex: 1, position: 'relative', justifyContent: 'center' }}>
            <TextInput
              ref={passwordInputRef}
              style={[styles.input, { paddingRight: 48 }]}
              placeholder="Enter password"
              placeholderTextColor="#555"
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
              style={{
                position: 'absolute',
                right: 0,
                height: '100%',
                width: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Login"
          style={({ pressed }) => ({
            backgroundColor: isLoading
              ? colors.disabled
              : pressed
                ? colors.info
                : colors.primary,
            paddingVertical: 14,
            minHeight: 48,
            justifyContent: 'center',
            borderRadius: 8,
            marginTop: 30,
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

        <Text
          style={{
            marginTop: 16,
            fontSize: 12,
            color: '#666',
            textAlign: 'center',
          }}
        >
          Forgot your password? Contact your IT Admin to reset it.
        </Text>
      </View>
    </View>
  );
}
