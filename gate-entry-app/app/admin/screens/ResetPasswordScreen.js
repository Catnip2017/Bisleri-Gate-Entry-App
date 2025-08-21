import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { adminAPI } from '../../../services/api';
import styles from '../styles/ResetPasswordScreenStyle';

const ResetPasswordScreen = () => {
  const [searchUsername, setSearchUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [userFound, setUserFound] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState('');

  const handleSearchUser = async () => {
    if (!searchUsername.trim()) {
      Alert.alert('Error', 'Please enter a username to search');
      return;
    }

    setSearching(true);
    try {
      const userData = await adminAPI.getUserDetails(searchUsername.trim());
      if (userData) {
        setUserFound(userData);
        Alert.alert('Success', `User "${userData.username}" found successfully!`);
      } else {
        setUserFound(null);
        Alert.alert('Error', 'User not found');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      Alert.alert('Error', 'User not found');
      setUserFound(null);
    } finally {
      setSearching(false);
    }
  };

  const validatePassword = (password) => {
    if (password.length < 6) {
      setPasswordStrength('weak');
      return false;
    } else if (password.length < 8) {
      setPasswordStrength('medium');
      return true;
    } else {
      setPasswordStrength('strong');
      return true;
    }
  };

  const handlePasswordChange = (password) => {
    setNewPassword(password);
    validatePassword(password);
  };

  const validateForm = () => {
    if (!userFound) {
      Alert.alert('Error', 'Please search for a user first');
      return false;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'New password is required');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    Alert.alert(
      'Confirm Password Reset',
      `Are you sure you want to reset password for user "${userFound.username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: performPasswordReset
        }
      ]
    );
  };

  const performPasswordReset = async () => {
    setLoading(true);
    try {
      await adminAPI.resetPassword({
        username: userFound.username,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      Alert.alert(
        'Success',
        `Password for user "${userFound.username}" has been reset successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSearchUsername('');
              setNewPassword('');
              setConfirmPassword('');
              setUserFound(null);
              setPasswordStrength('');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to reset password';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return styles.strengthWeak;
      case 'medium': return styles.strengthMedium;
      case 'strong': return styles.strengthStrong;
      default: return styles.strengthWeak;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset User Password</Text>

        {/* Search Section */}
        <Text style={styles.label}>Search User</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username to search"
          value={searchUsername}
          onChangeText={setSearchUsername}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchUser}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Search User</Text>
          )}
        </TouchableOpacity>

        {/* User Found Info */}
        {userFound && (
          <View style={styles.userFoundInfo}>
            <Text style={styles.userFoundText}>
              âœ“ User Found: {userFound.username} ({userFound.first_name} {userFound.last_name})
            </Text>
          </View>
        )}

        {/* Password Reset Form */}
        {userFound && (
          <>
            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementText}>â€¢ Password must be at least 6 characters</Text>
              <Text style={styles.requirementText}>â€¢ Use a combination of letters and numbers</Text>
              <Text style={styles.requirementText}>â€¢ Avoid using common passwords</Text>
            </View>

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={handlePasswordChange}
            />

            {newPassword.length > 0 && (
              <View style={[styles.strengthIndicator, getStrengthColor()]} />
            )}

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={[
                styles.resetButton,
                loading && styles.resetButtonDisabled
              ]}
              onPress={handleResetPassword}
              disabled={loading}
            > 
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.resetText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ResetPasswordScreen;