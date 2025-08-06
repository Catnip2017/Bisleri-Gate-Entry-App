// app/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import styles from './LoginScreen_Styles';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api'; // Fixed path

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both username and password");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await authAPI.login({
        username: username.trim(),
        password: password,
      });

      const { access_token, token_type } = response;

      if (!access_token) {
        throw new Error("No access token received");
      }

      // Store the token securely
      await SecureStore.setItemAsync("access_token", access_token);

      // Direct redirect to landing page without popup
      router.replace('/landing/');
      
    } catch (error) {
      console.error("Login failed", error);
      
      let errorMessage = "An error occurred during login";
      
      if (error.response) {
        // Server responded with error
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = "Invalid username or password";
        } else if (status === 422) {
          errorMessage = "Please check your input format";
        } else if (status === 404) {
          errorMessage = "Login service not found. Please check server connection.";
        } else if (data?.detail) {
          errorMessage = data.detail;
        } else {
          errorMessage = `Server error (${status})`;
        }
      } else if (error.request) {
        // Network error
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/bisleri-logo.png')}
        style={styles.topLogo}
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
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputRow}>
          <Text style={styles.label}>Password:</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#555"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />
        </View>

        <Pressable 
          onPress={handleLogin} 
          disabled={isLoading}
          style={({ pressed }) => ({
            backgroundColor: isLoading 
              ? '#ccc' 
              : pressed 
                ? '#1b89ff' 
                : '#00BCD4',
            paddingVertical: 14,
            borderRadius: 6,
            marginTop: 30,
            boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
            opacity: isLoading ? 0.7 : 1,
          })}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}