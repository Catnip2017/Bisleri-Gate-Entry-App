// app/security/components/RMEntryTab.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import styles from '../styles/gateEntryStyles';
import { showAlert } from '../../../utils/customModal';

const RMEntryTab = ({ userData }) => {
  // Form state
  const [formData, setFormData] = useState({
    gateType: 'Gate-In',
    vehicleNo: '',
    documentNo: '',
    nameOfParty: '',
    descriptionOfMaterial: '',
    quantity: ''
  });

  // Entry type: 'with_document' or 'empty_vehicle'
  const [entryType, setEntryType] = useState('with_document');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEmptyVehicle = entryType === 'empty_vehicle';

  const updateField = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleEntryTypeChange = (type) => {
    setEntryType(type);
    // Clear only the document number when switching to empty vehicle
    if (type === 'empty_vehicle') {
      setFormData(prev => ({ ...prev, documentNo: '' }));
    }
  };

  const validateForm = () => {
    if (!formData.vehicleNo.trim()) {
      showAlert('Error', 'Vehicle number is required');
      return false;
    }

    if (formData.vehicleNo.trim().length < 8) {
      showAlert('Error', 'Vehicle number must be at least 8 characters');
      return false;
    }

    // Document number only required when not Empty Vehicle
    if (!isEmptyVehicle && !formData.documentNo.trim()) {
      showAlert('Error', 'Document number is required');
      return false;
    }

    if (!formData.nameOfParty.trim()) {
      showAlert('Error', 'Name of Party is required');
      return false;
    }

    if (!formData.descriptionOfMaterial.trim()) {
      showAlert('Error', 'Description of Material is required');
      return false;
    }

    if (!formData.quantity.trim()) {
      showAlert('Error', 'Quantity is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    showAlert(
      'Confirm Submission',
      `Create ${formData.gateType} entry for vehicle ${formData.vehicleNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: performSubmit }
      ]
    );
  };

  const resetForm = () => {
    setEntryType('with_document');
    setFormData({
      gateType: 'Gate-In',
      vehicleNo: '',
      documentNo: '',
      nameOfParty: '',
      descriptionOfMaterial: '',
      quantity: ''
    });
  };

  const performSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { rmAPI } = await import('../../../services/api');

      const entryData = {
        gate_type: formData.gateType,
        vehicle_no: formData.vehicleNo.trim(),
        entry_type: entryType,
        document_no: isEmptyVehicle ? '' : formData.documentNo.trim(),
        name_of_party: formData.nameOfParty.trim(),
        description_of_material: formData.descriptionOfMaterial.trim(),
        quantity: formData.quantity.trim()
      };

      const response = await rmAPI.createRMEntry(entryData);

      showAlert(
        'Success',
        `Raw Materials ${formData.gateType} created successfully!\n\nGate Entry No: ${response.gate_entry_no}\nVehicle: ${response.vehicle_no}\nDateTime: ${new Date(response.date_time).toLocaleString()}`,
        [{ text: 'OK', onPress: resetForm }]
      );

    } catch (error) {
      console.log('RM entry submission failed:', error);

      let errorMessage = 'Failed to create raw materials entry';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    showAlert(
      'Clear All',
      'Are you sure you want to clear all fields?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: resetForm }
      ]
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.cardContainer}
    >
      <Text style={styles.sectionTitle}>Raw Materials Entry</Text>

      {/* Row 1 - Gate Type */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Gate Type:</Text>
          <View style={styles.radioRow}>
            {['Gate-In', 'Gate-Out'].map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.radioButton}
                onPress={() => updateField('gateType', type)}
                disabled={isSubmitting}
              >
                <View style={styles.radioCircle}>
                  {formData.gateType === type && <View style={styles.selectedDot} />}
                </View>
                <Text>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Row 2 - Vehicle Number */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Vehicle Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Vehicle Number"
            value={formData.vehicleNo}
            onChangeText={(text) => updateField('vehicleNo', text.toUpperCase())}
            autoCapitalize="characters"
            editable={!isSubmitting}
          />
        </View>
      </View>

      {/* Row 3 - Document Number (with built-in Empty Vehicle toggle) */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Document Number *</Text>

          {/* Inline dropdown-style toggle: Enter Doc No | Empty Vehicle */}
          <View style={{
            flexDirection: 'row',
            borderWidth: 1,
            borderColor: '#ced4da',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 8,
          }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                backgroundColor: !isEmptyVehicle ? '#007bff' : '#f8f9fa',
              }}
              onPress={() => handleEntryTypeChange('with_document')}
              disabled={isSubmitting}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: !isEmptyVehicle ? '#fff' : '#555',
              }}>
                Enter Doc No
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                backgroundColor: isEmptyVehicle ? '#ffc107' : '#f8f9fa',
              }}
              onPress={() => handleEntryTypeChange('empty_vehicle')}
              disabled={isSubmitting}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: isEmptyVehicle ? '#5a3e00' : '#555',
              }}>
                Empty Vehicle
              </Text>
            </TouchableOpacity>
          </View>

          {/* Show text input or Empty Vehicle badge depending on selection */}
          {!isEmptyVehicle ? (
            <TextInput
              style={styles.input}
              placeholder="Enter Document Number"
              value={formData.documentNo}
              onChangeText={(text) => updateField('documentNo', text)}
              editable={!isSubmitting}
            />
          ) : (
            <View style={{
              borderWidth: 1,
              borderColor: '#ffc107',
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: '#fff3cd',
            }}>
              <Text style={{ color: '#856404', fontWeight: 'bold', fontSize: 14 }}>
                EMPTY VEHICLE — No document required
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Row 4 - Name of Party */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Name of Party *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Name of Party"
            value={formData.nameOfParty}
            onChangeText={(text) => updateField('nameOfParty', text)}
            editable={!isSubmitting}
          />
        </View>
      </View>

      {/* Row 5 - Description of Material */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Description of Material *</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Enter Description of Material"
            value={formData.descriptionOfMaterial}
            onChangeText={(text) => updateField('descriptionOfMaterial', text)}
            multiline
            numberOfLines={3}
            editable={!isSubmitting}
          />
        </View>
      </View>

      {/* Row 6 - Quantity */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Quantity"
            value={formData.quantity}
            onChangeText={(text) => updateField('quantity', text)}
            editable={!isSubmitting}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[
            styles.button, 
            styles.submitButton,
            isSubmitting && styles.buttonDisabled
          ]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Submit RM Entry</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button,
            styles.clearButton,
            isSubmitting && styles.buttonDisabled
          ]} 
          onPress={handleClear}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {isSubmitting && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Creating raw materials entry...</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default RMEntryTab;