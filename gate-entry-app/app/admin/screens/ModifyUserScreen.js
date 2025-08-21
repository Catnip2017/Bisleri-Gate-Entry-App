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
import { Picker } from '@react-native-picker/picker';
import { adminAPI } from '../../../services/api';
import styles from '../styles/ModifyUserScreenStyle';

const ModifyUserScreen = () => {
  const [searchUsername, setSearchUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [userFound, setUserFound] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [roles, setRoles] = useState([]); // Only manage roles
  const [newRole, setNewRole] = useState('');

  const availableRoles = ['admin', 'security', 'itadmin'];

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const warehouseData = await adminAPI.getWarehouses();
      setWarehouses(warehouseData);
    } catch (error) {
      console.error('Error loading warehouses:', error);
      Alert.alert('Error', 'Failed to load warehouse data');
    }
  };

  const handleSearchUser = async () => {
    if (!searchUsername.trim()) {
      Alert.alert('Error', 'Please enter a username to search');
      return;
    }

    setSearching(true);
    try {
      const userData = await adminAPI.getUserDetails(searchUsername.trim());
      setUserFound(userData);

      // Extract roles safely
      const userRoles = Array.isArray(userData.roles)
        ? userData.roles
        : typeof userData.role === 'string'
        ? [userData.role]
        : [];

      setRoles(userRoles);
      setNewRole('');

      Alert.alert('Success', `User "${userData.username}" found successfully!`);
    } catch (error) {
      console.error('Error searching user:', error);
      const errorMessage = error.response?.data?.detail || 'User not found';
      Alert.alert('Error', errorMessage);
      setUserFound(null);
      setRoles([]);
      setNewRole('');
    } finally {
      setSearching(false);
    }
  };

  const addRole = () => {
    if (!newRole) return;
    if (roles.includes(newRole)) {
      Alert.alert('Info', `Role "${newRole}" is already assigned.`);
      return;
    }
    setRoles([...roles, newRole]);
    setNewRole('');
  };

  const handleModifyUser = async () => {
    if (!userFound) {
      Alert.alert('Error', 'Please search for a user first');
      return;
    }

    if (roles.length === 0) {
      Alert.alert('Error', 'Please assign at least one role');
      return;
    }

    setLoading(true);
    try {
      // 🔴 ONLY send roles — warehouse is ignored completely
      await adminAPI.modifyUser(userFound.username, {
        roles: roles,
      });

      Alert.alert(
        'Success',
        `User "${userFound.username}" has been updated successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSearchUsername('');
              setUserFound(null);
              setRoles([]);
              setNewRole('');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error modifying user:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to update user';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Modify User Roles</Text>

        {/* Search User */}
        <Text style={styles.label}>Search Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username"
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

        {/* User Info */}
        {userFound && (
          <View style={styles.userInfo}>
            <Text style={styles.userInfoTitle}>User Found:</Text>
            <Text style={styles.userInfoText}>Username: {userFound.username}</Text>
            <Text style={styles.userInfoText}>
              Name: {userFound.first_name} {userFound.last_name}
            </Text>
            <Text style={styles.userInfoText}>
              Current Roles: {roles.length > 0 ? roles.join(', ') : 'None'}
            </Text>
          </View>
        )}

        {/* Role Management */}
        {userFound && (
          <>
            <Text style={styles.label}>Current Roles</Text>
            {roles.length > 0 ? (
              <View style={styles.roleList}>
                {roles.map((role) => (
                  <View key={role} style={styles.rolePill}>
                    <Text style={styles.roleText}>{role}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noRoleText}>No roles assigned</Text>
            )}

            {/* Add Role */}
            <Text style={styles.label}>Add Role</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newRole}
                onValueChange={setNewRole}
                style={styles.picker}
              >
                <Picker.Item label="Select Role to Add..." value="" />
                {availableRoles
                  .filter((role) => !roles.includes(role))
                  .map((role) => (
                    <Picker.Item key={role} label={role} value={role} />
                  ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.addButton, !newRole && styles.addButtonDisabled]}
              onPress={addRole}
              disabled={!newRole}
            >
              <Text style={styles.addButtonText}>Add Role</Text>
            </TouchableOpacity>

            {/* Modify Button */}
            <TouchableOpacity
              style={[styles.modifyButton, loading && styles.modifyButtonDisabled]}
              onPress={handleModifyUser}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modifyText}>Update Roles Only</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ModifyUserScreen;