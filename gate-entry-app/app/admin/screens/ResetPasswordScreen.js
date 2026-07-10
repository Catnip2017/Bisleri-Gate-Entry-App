import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { adminAPI, handleAPIError } from '../../../services/api';
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

  const handleSearchUser = async (query) => {
    setSearchQuery(query);
    setUserFound(null);
    setMatchingUsers([]);
    resetPasswordFields();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const results = await adminAPI.searchUsers(query.trim());
      setMatchingUsers(results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    setSearchQuery(user.username);
    setUserFound(user);
    setMatchingUsers([]);
    resetPasswordFields();
  };

  const resetPasswordFields = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordStrength('');
  };

  const handlePasswordChange = (password) => {
    setNewPassword(password);
    if (!password) { setPasswordStrength(''); return; }
    if (password.length < 6) setPasswordStrength('weak');
    else if (password.length < 8) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  };

  const getStrengthStyle = () => {
    if (passwordStrength === 'weak') return styles.strengthWeak;
    if (passwordStrength === 'medium') return styles.strengthMedium;
    if (passwordStrength === 'strong') return styles.strengthStrong;
    return null;
  };

  const handleResetPassword = () => {
    if (!userFound) { showAlert('Error', 'Please select a user first'); return; }
    if (!newPassword.trim()) { showAlert('Error', 'New password is required'); return; }
    if (newPassword.length < 6) { showAlert('Error', 'Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return; }

    showAlert(
      'Confirm Password Reset',
      `Reset password for "${userFound.username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: performReset },
      ]
    );
  };

  const performReset = async () => {
    setLoading(true);
    try {
      await adminAPI.resetPassword({
        username: userFound.username,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      showAlert('Success', `Password for "${userFound.username}" has been reset!`, [
        { text: 'OK', onPress: () => { setSearchQuery(''); setUserFound(null); resetPasswordFields(); } },
      ]);
    } catch (error) {
      showAlert('Error', handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  const isAdUser = userFound && userFound.auth_type === 'ad';
  const isLocalUser = userFound && userFound.auth_type !== 'ad';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.panels}>

          {/* ── LEFT PANEL: Search + User Info ── */}
          <View style={styles.leftPanel}>
            <Text style={styles.label}>Search User</Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type username, email or name..."
                value={searchQuery}
                onChangeText={handleSearchUser}
                autoCapitalize="none"
              />
              {searching && (
                <ActivityIndicator style={{ position: 'absolute', right: 10, top: 14 }} size="small" />
              )}
              {matchingUsers.length > 0 && (
                <View style={styles.dropdown}>
                  <ScrollView nestedScrollEnabled>
                    {matchingUsers.map(user => (
                      <TouchableOpacity
                        key={user.username}
                        style={styles.dropdownItem}
                        onPress={() => handleSelectUser(user)}
                      >
                        <Text style={styles.dropdownUsername}>{user.username}</Text>
                        <Text style={styles.dropdownRole}>{user.role}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* User info card */}
            {userFound && (
              <View style={styles.userInfoCard}>
                <Text style={styles.userInfoName}>
                  {userFound.first_name} {userFound.last_name}
                </Text>
                <View style={styles.userInfoRow}>
                  <Text style={styles.userInfoLabel}>Username</Text>
                  <Text style={styles.userInfoValue}>{userFound.username}</Text>
                </View>
                {userFound.email ? (
                  <View style={styles.userInfoRow}>
                    <Text style={styles.userInfoLabel}>Email</Text>
                    <Text style={styles.userInfoValue}>{userFound.email}</Text>
                  </View>
                ) : null}
                {userFound.warehouse_name ? (
                  <View style={styles.userInfoRow}>
                    <Text style={styles.userInfoLabel}>Warehouse</Text>
                    <Text style={styles.userInfoValue}>{userFound.warehouse_name}</Text>
                  </View>
                ) : null}
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{userFound.role}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.panelDivider} />

          {/* ── RIGHT PANEL: Password Reset ── */}
          <View style={styles.rightPanel}>
            {!userFound && (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.4, paddingTop: 60 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>🔐</Text>
                <Text style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>
                  Search and select a user{'\n'}to reset their password
                </Text>
              </View>
            )}

            {/* AD user block */}
            {isAdUser && (
              <View style={{
                backgroundColor: '#e3f2fd',
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: '#90caf9',
                padding: 20,
                marginTop: 8,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1565c0', marginBottom: 8 }}>
                  🏢 AD Account
                </Text>
                <Text style={{ fontSize: 13, color: '#1976d2', lineHeight: 20 }}>
                  This user signs in via Active Directory. Passwords are managed by your IT department —
                  not through this app. Contact your AD administrator to reset this user's password.
                </Text>
              </View>
            )}

            {/* Password form for local users */}
            {isLocalUser && (
              <>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={handlePasswordChange}
                />
                {passwordStrength ? (
                  <View style={[styles.strengthIndicator, getStrengthStyle()]} />
                ) : null}

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
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.resetText}>Reset Password</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

        </View>
      </View>
    </ScrollView>
  );
};

export default ResetPasswordScreen;
