import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
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
  const [formData, setFormData] = useState({
    warehouseCode: '',
    warehouseName: '',
    siteCode: ''
  });

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
      
      // Pre-fill form with current user data
      setFormData({
        warehouseCode: userData.warehouse_code || '',
        warehouseName: userData.warehouse_name || '',
        siteCode: userData.site_code || ''
      });

      Alert.alert('Success', `User "${userData.username}" found successfully!`);
    } catch (error) {
      console.error('Error searching user:', error);
      const errorMessage = error.response?.data?.detail || 'User not found';
      Alert.alert('Error', errorMessage);
      setUserFound(null);
      setFormData({
        warehouseCode: '',
        warehouseName: '',
        siteCode: ''
      });
    } finally {
      setSearching(false);
    }
  };

  const handleWarehouseChange = (warehouseCode) => {
    const selectedWarehouse = warehouses.find(wh => wh.warehouse_code === warehouseCode);
    if (selectedWarehouse) {
      setFormData({
        warehouseCode: selectedWarehouse.warehouse_code,
        warehouseName: selectedWarehouse.warehouse_name,
        siteCode: selectedWarehouse.site_code
      });
    }
  };

  const handleModifyUser = async () => {
    if (!userFound) {
      Alert.alert('Error', 'Please search for a user first');
      return;
    }

    if (!formData.warehouseCode) {
      Alert.alert('Error', 'Please select a warehouse');
      return;
    }

    setLoading(true);
    try {
      await adminAPI.modifyUser(userFound.username, {
        warehouse_code: formData.warehouseCode,
        warehouse_name: formData.warehouseName,
        site_code: formData.siteCode
      });

      Alert.alert(
        'Success',
        `User "${userFound.username}" has been updated successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSearchUsername('');
              setUserFound(null);
              setFormData({
                warehouseCode: '',
                warehouseName: '',
                siteCode: ''
              });
            }
          }
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
        <Text style={styles.title}>Modify User Details</Text>

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
          <View style={styles.userInfo}>
            <Text style={styles.userInfoTitle}>User Found:</Text>
            <Text style={styles.userInfoText}>Username: {userFound.username}</Text>
            <Text style={styles.userInfoText}>Name: {userFound.first_name} {userFound.last_name}</Text>
            <Text style={styles.userInfoText}>Role: {userFound.role}</Text>
            <Text style={styles.userInfoText}>Current Warehouse: {userFound.warehouse_code}</Text>
            <Text style={styles.userInfoText}>Current Site: {userFound.site_code}</Text>
          </View>
        )}

        {/* Modification Form */}
        {userFound && (
          <>
            <Text style={styles.label}>New Warehouse</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.warehouseCode}
                onValueChange={handleWarehouseChange}
                style={styles.picker}
              >
                <Picker.Item label="Select Warehouse..." value="" />
                {warehouses.map((warehouse) => (
                  <Picker.Item
                    key={warehouse.warehouse_code}
                    label={`${warehouse.warehouse_code} - ${warehouse.warehouse_name}`}
                    value={warehouse.warehouse_code}
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Warehouse Code</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.warehouseCode}
              editable={false}
            />

            <Text style={styles.label}>Warehouse Name</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.warehouseName}
              editable={false}
            />

            <Text style={styles.label}>Site Code</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.siteCode}
              editable={false}
            />

            <TouchableOpacity
              style={[
                styles.modifyButton,
                loading && styles.modifyButtonDisabled
              ]}
              onPress={handleModifyUser}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modifyText}>Update User</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ModifyUserScreen;