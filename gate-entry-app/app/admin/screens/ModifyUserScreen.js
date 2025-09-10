
import React, { useState } from 'react';
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
import styles from '../styles/ModifyUserScreenStyle';
import { showAlert } from '../../../utils/customModal';


const ModifyUserScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [userFound, setUserFound] = useState(null);
  const [roles, setRoles] = useState([]);

  // ✅ Use formatted roles for DB
  const availableRoles = ['Security Admin', 'Security Guard', 'IT Admin'];

  // Fetch users for autocomplete
  const handleSearchUser = async (query) => {
    setSearchQuery(query);
    setUserFound(null);
    setRoles([]);
    setMatchingUsers([]);
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

    // ✅ Split roles from DB (comma separated)
    const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
    setRoles(userRoles);

    setMatchingUsers([]);
  };

  // ✅ Toggle multiple roles
  const toggleRole = (role) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Modify user
  const handleModifyUser = async () => {
    if (!userFound) {
      showAlert('Error', 'Please select a user first');
      return;
    }
    if (!roles.length) {
      showAlert('Error', 'Please assign at least one role');
      return;
    }

    setLoading(true);
    try {
      // ✅ Send roles as comma-separated string
      await adminAPI.modifyUser(userFound.username, { role: roles.join(', ') });

      showAlert('Success', `User "${userFound.username}" roles updated successfully!`, [
        { text: 'OK', onPress: () => resetForm() },
      ]);
    } catch (error) {
      console.error('Error modifying user:', error);
      const msg = error.response?.data?.detail || 'Failed to update user';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = () => {
    if (!userFound) return;

    showAlert(
      'Confirm Delete',
      `Are you sure you want to delete user "${userFound.username}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await adminAPI.deleteUser(userFound.username);
              showAlert('Deleted', `User "${userFound.username}" deleted successfully!`);
              resetForm();
            } catch (error) {
              console.error('Error deleting user:', error);
              const msg = error.response?.data?.detail || 'Failed to delete user';
              showAlert('Error', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSearchQuery('');
    setUserFound(null);
    setRoles([]);
    setMatchingUsers([]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Modify User Role</Text>

        {/* Search Input */}
        <Text style={styles.label}>Search Username</Text>
        <View style={{ position: 'relative', width: '100%' }}>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
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

        {/* User Info */}
        {userFound && (
          <View style={styles.userInfo}>
            <Text style={styles.userInfoTitle}>User Found:</Text>
            <Text style={styles.userInfoText}>Username: {userFound.username}</Text>
            <Text style={styles.userInfoText}>
              Name: {userFound.first_name} {userFound.last_name}
            </Text>
            <Text style={styles.userInfoText}>
              Current Roles: {roles.join(', ')}
            </Text>
          </View>
        )}

        {/* Roles */}
        {userFound && (
          <View style={styles.rolesContainer}>
            {availableRoles.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton,
                  roles.includes(role) && styles.roleButtonSelected,
                ]}
                onPress={() => toggleRole(role)}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    roles.includes(role) && styles.roleButtonTextSelected,
                  ]}
                >
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {userFound && (
          <>
            <TouchableOpacity
              style={[styles.modifyButton, loading && styles.modifyButtonDisabled]}
              onPress={handleModifyUser}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modifyText}>Update Roles</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.modifyButtonDisabled]}
              onPress={handleDeleteUser}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>Delete User</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ModifyUserScreen;
