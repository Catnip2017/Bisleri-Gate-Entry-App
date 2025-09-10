

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
import styles from '../styles/RegisterScreenStyle';
import {
  validateUsername,
  validatePassword,
  validateName,
  validatePasswordMatch,
} from '../utils/validation';
import { showAlert } from '../../../utils/customModal';


const RegisterScreen = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'Security Guard',   // 👈 default role
    warehouseCode: '',
    warehouseName: '',
    siteCode: '',
  });

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Autocomplete states
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const warehouseData = await adminAPI.getWarehouses();
      setWarehouses(warehouseData);
    } catch (error) {
      console.error('Error loading warehouses:', error);
      showAlert('Error', 'Failed to load warehouse data');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Warehouse Code Filter & Auto-fill
  const handleWarehouseCodeChange = (text) => {
    setSearchText(text);

    if (!text.trim()) {
      setFormData((prev) => ({
        ...prev,
        warehouseCode: '',
        warehouseName: '',
        siteCode: '',
      }));
      setFilteredWarehouses([]);
      setShowDropdown(false);
      return;
    }

    const searchTerm = text.toLowerCase();
    const filtered = warehouses.filter((warehouse) => {
      const code = warehouse.warehouse_code?.toLowerCase() || '';
      const name = warehouse.warehouse_name?.toLowerCase() || '';
      return code.includes(searchTerm) || name.includes(searchTerm);
    });

    setFilteredWarehouses(filtered);
    setShowDropdown(filtered.length > 0);

    setFormData((prev) => ({
      ...prev,
      warehouseCode: text,
      warehouseName: '',
      siteCode: '',
    }));
  };

  const selectWarehouse = (warehouse) => {
    setFormData((prev) => ({
      ...prev,
      warehouseCode: warehouse.warehouse_code,
      warehouseName: warehouse.warehouse_name,
      siteCode: warehouse.site_code,
    }));
    setSearchText(warehouse.warehouse_code);
    setShowDropdown(false);
    setFilteredWarehouses([]);
  };

  const validateForm = () => {
    const errors = {};

    const usernameError = validateUsername(formData.username);
    if (usernameError) errors.username = usernameError;

    const firstNameError = validateName(formData.firstName, 'First name');
    if (firstNameError) errors.firstName = firstNameError;

    const lastNameError = validateName(formData.lastName, 'Last name');
    if (lastNameError) errors.lastName = lastNameError;

    const passwordError = validatePassword(formData.password);
    if (passwordError) errors.password = passwordError;

    const passwordMatchError = validatePasswordMatch(
      formData.password,
      formData.confirmPassword
    );
    if (passwordMatchError) errors.confirmPassword = passwordMatchError;

    // Only Security Guard & Security Admin require warehouse
    if (
      (formData.role === 'Security Guard' || formData.role === 'Security Admin') &&
      (!formData.warehouseCode || !formData.warehouseName || !formData.siteCode)
    ) {
      errors.warehouse = 'Please enter a valid Warehouse Code';
    }

    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      showAlert('Validation Error', errors[errorKeys[0]]);
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const userData = {
        username: formData.username.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        role: formData.role,  // 👈 stored as readable string
        warehouse_code: formData.role === "IT Admin" ? "" : formData.warehouseCode,
        site_code: formData.role === "IT Admin" ? "" : formData.siteCode,
      };

      console.log('=== REGISTRATION ATTEMPT ===');
      console.log('User Data:', JSON.stringify(userData, null, 2));
      console.log('Role:', formData.role);

      const response = await adminAPI.registerUser(userData);
      console.log("✅ Registration successful!", response);

      const successMsg = response.message || "User registered successfully!";

      showAlert("Success", successMsg, [
        {
          text: "OK",
          onPress: () => {
            setFormData({
              username: "",
              password: "",
              confirmPassword: "",
              firstName: "",
              lastName: "",
              role: "Security Guard",  // reset default role
              warehouseCode: "",
              warehouseName: "",
              siteCode: "",
            });
            setSearchText("");
            setShowDropdown(false);          // Add this line
            setFilteredWarehouses([]);
          },
        },
      ]);

    } catch (error) {
      console.log('=== REGISTRATION ERROR ===');
      console.error('Error details:', error.message);

      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Error data:', JSON.stringify(error.response.data, null, 2));
        console.error('Request URL:', error.response.config?.url);
      }

      let errorMessage = 'Registration failed';

      if (error.response?.status === 422) {
        errorMessage = 'Validation error: ' + (error.response?.data?.detail || 'Invalid data format');
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied: Only IT Admins can register users';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication required: Please login as IT Admin first';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      showAlert('Registration Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Register New User</Text>

        {/* Role Selection */}
        <Text style={styles.label}>Role</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              formData.role === 'Security Guard' && styles.roleButtonActive,
            ]}
            onPress={() => handleInputChange('role', 'Security Guard')}
          >
            <Text
              style={[
                styles.roleButtonText,
                formData.role === 'Security Guard' && styles.roleButtonTextActive,
              ]}
            >
              Security Guard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,
              formData.role === 'Security Admin' && styles.roleButtonActive,
            ]}
            onPress={() => handleInputChange('role', 'Security Admin')}
          >
            <Text
              style={[
                styles.roleButtonText,
                formData.role === 'Security Admin' && styles.roleButtonTextActive,
              ]}
            >
              Security Admin
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,
              formData.role === 'IT Admin' && styles.roleButtonActive,
            ]}
            onPress={() => handleInputChange('role', 'IT Admin')}
          >
            <Text
              style={[
                styles.roleButtonText,
                formData.role === 'IT Admin' && styles.roleButtonTextActive,
              ]}
            >
              IT Admin
            </Text>
          </TouchableOpacity>
        </View>

        {/* Show Warehouse fields only for Security Guard & Admin */}
        {(formData.role === 'Security Guard' || formData.role === 'Security Admin') && (
          <>
            <Text style={styles.label}>Warehouse Code</Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type warehouse code or name..."
                value={searchText}
                onChangeText={handleWarehouseCodeChange}
                onFocus={() => {
                  if (searchText && filteredWarehouses.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                autoCapitalize="characters"
              />

              {showDropdown && (
                <View style={styles.dropdown}>
                  <ScrollView
                    style={styles.dropdownScrollView}
                    nestedScrollEnabled={true}
                  >
                    {filteredWarehouses.map((warehouse) => (
                      <TouchableOpacity
                        key={warehouse.warehouse_code}
                        style={styles.dropdownItem}
                        onPress={() => selectWarehouse(warehouse)}
                      >
                        <Text style={styles.dropdownItemCode}>
                          {warehouse.warehouse_code}
                        </Text>
                        <Text style={styles.dropdownItemName}>
                          {warehouse.warehouse_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

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
          </>
        )}

        {/* User Info */}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={formData.firstName}
              onChangeText={(value) => handleInputChange('firstName', value)}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={formData.username}
              onChangeText={(value) => handleInputChange('username', value)}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={formData.lastName}
              onChangeText={(value) => handleInputChange('lastName', value)}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
            />
          </View>
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          value={formData.confirmPassword}
          onChangeText={(value) =>
            handleInputChange('confirmPassword', value)
          }
        />

        <TouchableOpacity
          style={[
            styles.registerButton,
            loading && styles.registerButtonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerText}>Register User</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default RegisterScreen;