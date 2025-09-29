import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { adminAPI } from '../../../services/api';
import styles from '../styles/ResetPasswordScreenStyle';
import { showAlert } from '../../../utils/customModal';


const ResetPasswordScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [userFound, setUserFound] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Autocomplete search
  const handleSearchUser = async (query) => {
    setSearchQuery(query);
    setUserFound(null);
    setMatchingUsers([]);
    setPasswordStrength('');
    setNewPassword('');
    setConfirmPassword('');

    if (!query.trim()) return;

    setSearching(true);
    try {
      const results = await adminAPI.searchUsers(query.trim());
      setMatchingUsers(results || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setMatchingUsers([]);
    } finally {
      setSearching(false);
    }
  };

  // Select user from dropdown
  const handleSelectUser = (user) => {
    setSearchQuery(user.username);
    setUserFound(user);
    setMatchingUsers([]);
  };

  // Password validation
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

  // Form validation
  const validateForm = () => {
    if (!userFound) {
      showAlert('Error', 'Please select a user first');
      return false;
    }
    if (!newPassword.trim()) {
      showAlert('Error', 'New password is required');
      return false;
    }
    if (newPassword.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  // Confirm reset
  const handleResetPassword = () => {
    if (!validateForm()) return;

    showAlert(
      'Confirm Password Reset',
      `Are you sure you want to reset password for "${userFound.username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: performPasswordReset },
      ]
    );
  };

  // Perform reset
  const performPasswordReset = async () => {
    setLoading(true);
    try {
      await adminAPI.resetPassword({
        username: userFound.username,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      showAlert(
        'Success',
        `Password for "${userFound.username}" has been reset!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSearchQuery('');
              setUserFound(null);
              setMatchingUsers([]);
              setNewPassword('');
              setConfirmPassword('');
              setPasswordStrength('');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to reset password';
      showAlert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak':
        return styles.strengthWeak;
      case 'medium':
        return styles.strengthMedium;
      case 'strong':
        return styles.strengthStrong;
      default:
        return styles.strengthWeak;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset User Password</Text>

        {/* Search Input */}
        <Text style={styles.label}>Search Username</Text>
        <View style={{ position: 'relative', width: '100%' }}>
          <TextInput
            style={styles.input}
            placeholder="Enter Username"
            value={searchQuery}
            onChangeText={handleSearchUser}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator style={{ position: 'absolute', right: 10, top: 15 }} />}

          {/* Dropdown */}
{matchingUsers.length > 0 && (
  <View style={styles.dropdown}>
    <ScrollView>
      {matchingUsers.map((user) => (
        <TouchableOpacity
          key={user.username}
          onPress={() => handleSelectUser(user)}
          style={styles.dropdownItem}
        >
          <Text>{user.username}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
)}
 
        </View>

        

        {/* Password Reset Form */}
        {userFound && (
          <>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={handlePasswordChange}
            />
            {newPassword.length > 0 && <View style={[styles.strengthIndicator, getStrengthColor()]} />}

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={[styles.resetButton, loading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.resetText}>Reset Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ResetPasswordScreen;