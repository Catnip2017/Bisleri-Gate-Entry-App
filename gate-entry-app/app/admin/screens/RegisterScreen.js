import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
    role: 'Security Guard',
    warehouseCode: '',
    warehouseName: '',
    siteCode: '',
    email: '',
    phone_number: '',
  });

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
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
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleWarehouseCodeChange = (text) => {
    setSearchText(text);

    if (!text.trim()) {
      setFormData(prev => ({ ...prev, warehouseCode: '', warehouseName: '', siteCode: '' }));
      setFilteredWarehouses([]);
      setShowDropdown(false);
      return;
    }

    const searchTerm = text.toLowerCase();
    const filtered = warehouses.filter(w =>
      (w.warehouse_code?.toLowerCase() || '').includes(searchTerm) ||
      (w.warehouse_name?.toLowerCase() || '').includes(searchTerm)
    );

    setFilteredWarehouses(filtered);
    setShowDropdown(filtered.length > 0);

    setFormData(prev => ({ ...prev, warehouseCode: text, warehouseName: '', siteCode: '' }));
  };

  const selectWarehouse = (warehouse) => {
    setFormData(prev => ({
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

    const passwordMatchError = validatePasswordMatch(formData.password, formData.confirmPassword);
    if (passwordMatchError) errors.confirmPassword = passwordMatchError;

    // Email validation
    if (["Security Admin", "IT Admin"].includes(formData.role)) {
      if (!formData.email) errors.email = 'Email is required for this role';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Enter a valid email address';
    } else if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Enter a valid email address';
    }

    // Phone validation (optional but must be valid if entered)
    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number)) {
      errors.phone_number = 'Enter a valid 10-digit mobile number';
    }

    // Warehouse required for Guards/Admins
    if (["Security Guard", "Security Admin"].includes(formData.role)) {
      if (!formData.warehouseCode || !formData.warehouseName || !formData.siteCode) {
        errors.warehouse = 'Please enter a valid Warehouse Code';
      }
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
        role: formData.role,
        warehouse_code: formData.warehouseCode?.trim() || undefined,
        site_code: formData.siteCode?.trim() || undefined,
      };

      // add email & phone only if filled
      if (formData.email?.trim()) {
        userData.email = formData.email.trim();
      }
      if (formData.phone_number?.trim()) {
        userData.phone_number = formData.phone_number.trim();
      }

      console.log('Register Payload:', userData);

      const response = await adminAPI.registerUser(userData);

      showAlert('Success', response.message || 'User registered successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setFormData({
              username: '',
              password: '',
              confirmPassword: '',
              firstName: '',
              lastName: '',
              role: 'Security Guard',
              warehouseCode: '',
              warehouseName: '',
              siteCode: '',
              email: '',
              phone_number: '',
            });
            setSearchText('');
          },
        },
      ]);
    } catch (error) {
      console.error('Registration Error:', error);
      let errorMessage = "Registration failed";

      if (error.response?.status === 422) errorMessage = "Validation error. Check input.";
      else if (error.response?.status === 403) errorMessage = "Only IT Admins can register users";
      else if (error.response?.status === 400 && error.response.data?.detail) errorMessage = error.response.data.detail;

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
          {['Security Guard', 'Security Admin', 'IT Admin'].map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.roleButton, formData.role === role && styles.roleButtonActive]}
              onPress={() => handleInputChange('role', role)}
            >
              <Text style={[styles.roleButtonText, formData.role === role && styles.roleButtonTextActive]}>
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Warehouse fields for Security roles */}
        {["Security Guard", "Security Admin"].includes(formData.role) && (
          <>
            <Text style={styles.label}>Warehouse Code</Text>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type warehouse code or name..."
                value={searchText}
                onChangeText={handleWarehouseCodeChange}
                onFocus={() => { if (searchText && filteredWarehouses.length > 0) setShowDropdown(true); }}
                autoCapitalize="characters"
              />
              {showDropdown && (
                <View style={styles.dropdown}>
                  <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                    {filteredWarehouses.map(w => (
                      <TouchableOpacity key={w.warehouse_code} style={styles.dropdownItem} onPress={() => selectWarehouse(w)}>
                        <Text style={styles.dropdownItemCode}>{w.warehouse_code}</Text>
                        <Text style={styles.dropdownItemName}>{w.warehouse_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={styles.label}>Warehouse Name</Text>
            <TextInput style={[styles.input, styles.inputDisabled]} value={formData.warehouseName} editable={false} />
            <Text style={styles.label}>Site Code</Text>
            <TextInput style={[styles.input, styles.inputDisabled]} value={formData.siteCode} editable={false} />
          </>
        )}

        {/* User Info */}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>First Name</Text>
            <TextInput style={styles.input} placeholder="First Name" value={formData.firstName} onChangeText={v => handleInputChange('firstName', v)} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} placeholder="Username" value={formData.username} onChangeText={v => handleInputChange('username', v)} autoCapitalize="none" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput style={styles.input} placeholder="Last Name" value={formData.lastName} onChangeText={v => handleInputChange('lastName', v)} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} placeholder="Password" secureTextEntry value={formData.password} onChangeText={v => handleInputChange('password', v)} />
          </View>
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry value={formData.confirmPassword} onChangeText={v => handleInputChange('confirmPassword', v)} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} placeholder="Enter Email" value={formData.email} onChangeText={v => handleInputChange('email', v)} keyboardType="email-address" autoCapitalize="none" />

       <Text style={styles.label}>Mobile Number</Text>
<TextInput
  style={styles.input}
  placeholder="Enter Mobile Number"
  value={formData.phone_number}
  onChangeText={v => handleInputChange('phone_number', v.replace(/[^0-9]/g, ''))} // only digits
  keyboardType="number-pad"
  maxLength={10} // 🔹 limit to 10 digits
/>

        <TouchableOpacity style={[styles.registerButton, loading && styles.registerButtonDisabled]} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerText}>Register User</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default RegisterScreen;
 