// app/security/manual-entry/ManualEntryForm.js - ENHANCED WITH MULTI-DOCUMENT SUPPORT
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { gateAPI, handleAPIError } from '../../../services/api';
import styles from './ManualEntryFormStyles';

const ManualEntryForm = ({ userData }) => {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get vehicle number and gate type from URL parameters
  const preFilledVehicleNo = searchParams.vehicle || '';
  const preFilledGateType = searchParams.gateType || 'Gate-In';
  
  // ✅ UPDATED: Form state with new no_of_documents field (simplified form)
  const [formData, setFormData] = useState({
    vehicleNo: preFilledVehicleNo.toUpperCase(),
    gateType: preFilledGateType,
    noOfDocuments: 1,  // NEW: Default to 1 document
    remarks: '',
  });

  // Update form when userData or parameters change
  useEffect(() => {
    if (preFilledVehicleNo) {
      setFormData(prev => ({
        ...prev,
        vehicleNo: preFilledVehicleNo.toUpperCase(),
        gateType: preFilledGateType
      }));
    }
  }, [preFilledVehicleNo, preFilledGateType]);

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ UPDATED: Validation - only vehicle number and no_of_documents required
  const validateForm = () => {
    if (!formData.vehicleNo?.trim()) {
      Alert.alert('Validation Error', 'Vehicle number is required');
      return false;
    }
    
    if (!formData.noOfDocuments || formData.noOfDocuments < 1 || formData.noOfDocuments > 20) {
      Alert.alert('Validation Error', 'Number of documents must be between 1 and 20');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // ✅ NEW: Enhanced confirmation dialog for multi-document entry
    Alert.alert(
      'Confirm Multi-Document Entry',
      `Create ${formData.noOfDocuments} manual entries for vehicle ${formData.vehicleNo}?\n\n• All entries will have the same Gate Entry Number\n• Documents will be "Pending Assignment"\n• You can assign actual documents later from the Insights tab`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Entries', onPress: performSubmit }
      ]
    );
  };

  const performSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // ✅ NEW: Multi-document entry API call
      const multiEntryData = {
        gate_type: formData.gateType,
        vehicle_no: formData.vehicleNo,
        no_of_documents: parseInt(formData.noOfDocuments),
        remarks: formData.remarks || null,
      };

      const response = await gateAPI.createMultiDocumentManualEntry(multiEntryData);
      
      Alert.alert(
        'Success', 
        `${response.entries_created} manual entries created successfully!\n\nGate Entry No: ${response.gate_entry_no}\nVehicle: ${response.vehicle_no}\n\nNext: Assign documents from Insights tab when available.`,
        [
          {
            text: 'Go to Insights',
            onPress: () => {
              router.push('/security/?tab=insights');
            }
          },
          {
            text: 'Create Another',
            onPress: () => {
              // Clear form for new entry
              setFormData({
                vehicleNo: '',
                gateType: 'Gate-In',
                noOfDocuments: 1,
                remarks: '',
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Multi-document manual entry failed:', error);
      
      const errorMessage = handleAPIError(error);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Form',
      'Are you sure you want to clear all fields?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setFormData({
              vehicleNo: preFilledVehicleNo.toUpperCase(),
              gateType: preFilledGateType,
              noOfDocuments: 1,
              remarks: '',
            });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Card Container */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Multi-Document Manual Entry</Text>
        
        {/* ✅ Vehicle Number - Pre-filled and Fixed */}
        <View style={styles.row}>
          <View style={styles.fieldFull}>
            <Text style={styles.label}>Vehicle Number * (From Gate Entry)</Text>
            <TextInput 
              style={[styles.input, styles.inputDisabled]} 
              value={formData.vehicleNo}
              editable={false}
              placeholder="Vehicle number from Gate Entry"
            />
            {!preFilledVehicleNo && (
              <Text style={styles.warningText}>
                ⚠️ Vehicle number should be provided from Gate Entry page
              </Text>
            )}
          </View>
        </View>

        {/* ✅ Gate Type - Pre-filled and Fixed */}
        <View style={styles.row}>
          <View style={styles.fieldFull}>
            <Text style={styles.label}>Gate Type (From Gate Entry)</Text>
            <TextInput 
              style={[styles.input, styles.inputDisabled]} 
              value={formData.gateType}
              editable={false}
              placeholder="Gate type from Gate Entry"
            />
          </View>
        </View>

        {/* ✅ NEW: Number of Documents Field - Key Enhancement */}
        <View style={styles.row}>
          <View style={styles.fieldFull}>
            <Text style={styles.label}>Number of Documents * (How many documents are with this vehicle?)</Text>
            <TextInput 
              style={[styles.input, styles.highlightInput]} 
              value={formData.noOfDocuments.toString()}
              onChangeText={(text) => {
                const num = parseInt(text.replace(/[^0-9]/g, '')) || 1;
                updateField('noOfDocuments', Math.min(Math.max(num, 1), 20));
              }}
              placeholder="Enter number of documents (1-20)"
              keyboardType="numeric"
              maxLength={2}
              editable={!isSubmitting}
            />
            <Text style={styles.hintText}>
              💡 This will create {formData.noOfDocuments} manual entries with the same Gate Entry Number. You can assign actual documents later from the Insights tab.
            </Text>
          </View>
        </View>

        {/* ✅ Document Count Visual Indicator */}
        {formData.noOfDocuments > 1 && (
          <View style={styles.documentCountContainer}>
            <Text style={styles.documentCountText}>
              📋 Creating {formData.noOfDocuments} identical manual entries for vehicle {formData.vehicleNo}
            </Text>
          </View>
        )}

        {/* ✅ Remarks - Optional */}
        <View style={styles.row}>
          <View style={styles.fieldFull}>
            <Text style={styles.label}>Remarks (Optional)</Text>
            <TextInput 
              style={[styles.input, styles.multilineInput]} 
              value={formData.remarks}
              onChangeText={(text) => updateField('remarks', text)}
              placeholder="Enter any remarks about this vehicle entry"
              multiline
              numberOfLines={3}
              maxLength={200}
              editable={!isSubmitting}
            />
            <Text style={styles.hintText}>
              Character count: {formData.remarks.length}/200
            </Text>
          </View>
        </View>

        {/* ✅ NEW: Information Box - Explains the process */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How Multi-Document Entry Works:</Text>
          <Text style={styles.infoText}>
            1. This creates {formData.noOfDocuments} identical manual entries
          </Text>
          <Text style={styles.infoText}>
            2. All entries get the same Gate Entry Number
          </Text>
          <Text style={styles.infoText}>
            3. Documents will be "Pending Assignment"
          </Text>
          <Text style={styles.infoText}>
            4. Go to Insights tab to assign actual documents when they sync
          </Text>
          <Text style={styles.infoText}>
            5. Each entry can then have operational data added separately
          </Text>
        </View>

        {/* ✅ Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[
              styles.button, 
              styles.submitButton, 
              styles.enhancedSubmitButton,
              isSubmitting && styles.buttonDisabled
            ]} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, styles.enhancedButtonText]}>
                Create {formData.noOfDocuments} {formData.noOfDocuments === 1 ? 'Entry' : 'Entries'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.clearButton]} 
            onPress={handleClear}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>Clear Form</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ Loading State Display */}
        {isSubmitting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>
              Creating {formData.noOfDocuments} manual entries...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default ManualEntryForm;