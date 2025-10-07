// app/security/manual-entry/ManualEntryForm.js - ENHANCED WITH EMPTY VEHICLE SUPPORT
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { gateAPI, handleAPIError } from '../../../services/api';
import styles from './ManualEntryFormStyles';
import { showAlert } from '../../../utils/customModal';


const ManualEntryForm = ({ userData }) => {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get vehicle number and gate type from URL parameters
  const preFilledVehicleNo = searchParams.vehicle || '';
  const preFilledGateType = searchParams.gateType || 'Gate-In';
  // ✅ ADD THESE LINES to get the new params:
  const preFilledDriverName = searchParams.driverName || '';
  const preFilledKMReading = searchParams.kmReading || '';
  const preFilledLoaderNames = searchParams.loaderNames || '';
  
  // ✅ UPDATED: Form state with new no_of_documents field (default 0 for empty vehicle)
  const [formData, setFormData] = useState({
    vehicleNo: preFilledVehicleNo.toUpperCase(),
    gateType: preFilledGateType,
    noOfDocuments: 0,  // ✅ CHANGED: Default to 0 for empty vehicle scenario
    remarks: '',
    driverName: preFilledDriverName,      // ✅ ADD
    kmReading: preFilledKMReading,        // ✅ ADD
    loaderNames: preFilledLoaderNames,
    });

  // Update form when userData or parameters change
  useEffect(() => {
    if (preFilledVehicleNo) {
      setFormData(prev => ({
        ...prev,
        vehicleNo: preFilledVehicleNo.toUpperCase(),
        gateType: preFilledGateType,
        driverName: preFilledDriverName,      // ✅ ADD
        kmReading: preFilledKMReading,        // ✅ ADD
        loaderNames: preFilledLoaderNames,
      }));
    }
  }, [preFilledVehicleNo, preFilledGateType, searchParams]);

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ✅ UPDATED: Validation - allow 0-20 range for empty vehicle support
  const validateForm = () => {
    if (!formData.vehicleNo?.trim()) {
      showAlert('Validation Error', 'Vehicle number is required');
      return false;
    }
    
    // // ✅ ADD THESE 3 VALIDATIONS:
    // if (!formData.driverName?.trim()) {
    //   showAlert('Validation Error', 'Driver name is required');
    //   return false;
    // }
    
    // if (formData.driverName.trim().length < 2) {
    //   showAlert('Validation Error', 'Driver name must be at least 2 characters');
    //   return false;
    // }
    
    // if (!formData.kmReading?.trim()) {
    //   showAlert('Validation Error', 'KM reading is required');
    //   return false;
    // }
    
    // if (formData.kmReading.trim().length < 3 || formData.kmReading.trim().length > 6) {
    //   showAlert('Validation Error', 'KM reading must be 3-6 digits');
    //   return false;
    // }
    
    // if (!formData.loaderNames?.trim()) {
    //   showAlert('Validation Error', 'Loader names are required');
    //   return false;
    // }
    
    if (formData.noOfDocuments < 0 || formData.noOfDocuments > 20) {
      showAlert('Validation Error', 'Number of documents must be between 0 and 20');
      return false;
    }
    
    return true;
  };

  // ✅ UPDATED: Enhanced confirmation dialog for empty vehicle scenario
  const handleSubmit = async () => {
    if (!validateForm()) return;

    const isEmptyVehicle = formData.noOfDocuments === 0;
    const entryType = isEmptyVehicle ? 'Empty Vehicle' : 'Multi-Document';
    const entriesText = isEmptyVehicle ? '1 empty vehicle entry' : `${formData.noOfDocuments} manual entries`;

    showAlert(
      `Confirm ${entryType} Entry`,
      `Create ${entriesText} for vehicle ${formData.vehicleNo}?\n\n${
        isEmptyVehicle 
          ? '• This will create 1 "EMPTY VEHICLE" entry\n• No documents need to be assigned later'
          : `• All ${formData.noOfDocuments} entries will have the same Gate Entry Number\n• Documents will be "Pending Assignment"\n• You can assign actual documents later from the Insights tab`
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create Entry', onPress: performSubmit }
      ]
    );
  };

  const performSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // ✅ UPDATED: Multi-document entry API call with empty vehicle support
      const multiEntryData = {
        gate_type: formData.gateType,
        vehicle_no: formData.vehicleNo,
        no_of_documents: parseInt(formData.noOfDocuments),
        remarks: formData.remarks || null,
        driver_name: formData.driverName || null,
        km_reading: formData.kmReading || null,
        loader_names: formData.loaderNames || null,
      };

      const response = await gateAPI.createMultiDocumentManualEntry(multiEntryData);
      
      const isEmptyVehicle = formData.noOfDocuments === 0;
      
      showAlert(
        'Success', 
        `${response.entries_created} ${isEmptyVehicle ? 'empty vehicle' : 'manual'} entr${response.entries_created === 1 ? 'y' : 'ies'} created successfully!\n\nGate Entry No: ${response.gate_entry_no}\nVehicle: ${response.vehicle_no}\n\n${
          isEmptyVehicle 
            ? 'Empty vehicle recorded - no further action needed.'
            : 'Next: Assign documents from Insights tab when available.'
        }`,
        [
          {
            text: 'Go Back',
            onPress: () => {
              router.push('/security/?tab=insights');
            }
          },
          {
            text: 'Create Another',
            onPress: () => {
              // Clear form for new entry
              router.push('/security/?tab=fgentry'); 
            }
          }
        ]
      );
    } catch (error) {
      console.error('Multi-document manual entry failed:', error);
      
      const errorMessage = handleAPIError(error);
      showAlert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    showAlert(
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
              noOfDocuments: 0,  // ✅ Reset to 0
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
      <Text style={styles.sectionTitle}>Manual Entry - Support Empty Vehicles</Text>
      
      {/* ✅ Vehicle Number - Pre-filled and Fixed */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Vehicle Number *</Text>
          <TextInput  
            style={[styles.input, styles.inputDisabled]} 
            value={formData.vehicleNo}
            editable={false}
            placeholder="Vehicle number from Gate Entry"
          />
          {preFilledVehicleNo ? (
            <Text style={styles.hintText}>
              ✓ Pre-filled from Gate Entry
            </Text>
          ) : (
            <Text style={styles.warningText}>
              ⚠️ Vehicle number should be provided from Gate Entry page
            </Text>
          )}
        </View>
      </View>

      {/* ✅ Gate Type - Pre-filled and Fixed */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Gate Type</Text>
          <TextInput 
            style={[styles.input, styles.inputDisabled]} 
            value={formData.gateType}
            editable={false}
            placeholder="Gate type from Gate Entry"
          />
            {preFilledGateType && (
        <Text style={styles.hintText}>
          ✓ Pre-filled from Gate Entry
        </Text>
      )}
        </View>
      </View>
      {/* ✅ Number of Documents Field */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Number of Documents * (0 for empty vehicle, 1+ for vehicles with documents)</Text>
          <TextInput 
            style={[styles.input, styles.highlightInput]} 
            value={formData.noOfDocuments.toString()}
            onChangeText={(text) => {
              if (text === '') {
                updateField('noOfDocuments', 0);
              } else {
                const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                updateField('noOfDocuments', Math.min(Math.max(num, 0), 20));
              }
            }}
            placeholder="Enter 0 for empty vehicle, 1-20 for manual entries"
            keyboardType="numeric"
            maxLength={2}
            editable={!isSubmitting}
            selectTextOnFocus={true}
          />
          <Text style={styles.hintText}>
            {formData.noOfDocuments === 0 
              ? '🚛 Empty Vehicle: This will create 1 "EMPTY VEHICLE" entry to record the vehicle passage.'
              : `📋 Manual Entries: This will create ${formData.noOfDocuments} manual entries with the same Gate Entry Number. You can assign actual documents later from the Insights tab.`
            }
          </Text>
        </View>
      </View>

      {/* Driver Name Field */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Driver Name *</Text>
          <TextInput 
            style={[
              styles.input, 
              searchParams.driverName ? styles.inputDisabled : null
            ]} 
            value={formData.driverName}
            onChangeText={(text) => updateField('driverName', text)}
            placeholder="Enter driver's name"
            editable={!isSubmitting && !preFilledDriverName}
            autoCapitalize="words"
          />
          {searchParams.driverName && (
            <Text style={styles.hintText}>
              ✓ Pre-filled from Gate Entry
            </Text>
          )}
        </View>
      </View>

      {/* KM Reading Field */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>
            {formData.gateType === 'Gate-Out' ? 'KM OUT *' : 'KM IN *'}
          </Text>
          <TextInput 
            style={[
              styles.input,
              searchParams.kmReading ? styles.inputDisabled : null
            ]} 
            value={formData.kmReading}
            onChangeText={(text) => updateField('kmReading', text.replace(/[^0-9]/g, ''))}
            placeholder="Enter KM reading"
            keyboardType="numeric"
            maxLength={6}
            editable={!isSubmitting && !preFilledKMReading}
          />
          {searchParams.kmReading && (
            <Text style={styles.hintText}>
              ✓ Pre-filled from Gate Entry
            </Text>
          )}
        </View>
      </View>

      {/* Loader Names Field */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Loader Names *</Text>
          <TextInput 
            style={[
              styles.input, 
              styles.multilineInput,
              searchParams.loaderNames ? styles.inputDisabled : null
            ]} 
            value={formData.loaderNames}
            onChangeText={(text) => updateField('loaderNames', text)}
            placeholder="Enter loader names (comma-separated)"
            multiline
            numberOfLines={2}
            maxLength={200}
            editable={!isSubmitting && !preFilledLoaderNames}
          />
          <Text style={styles.hintText}>
            {searchParams.loaderNames 
              ? '✓ Pre-filled from Gate Entry'
              : 'Separate multiple names with commas'
            }
          </Text>
        </View>
      </View>

      

      {/* ✅ Dynamic visual indicator based on entry type */}
      <View style={styles.documentCountContainer}>
        <Text style={styles.documentCountText}>
          {formData.noOfDocuments === 0 
            ? `🚛 Recording empty vehicle ${formData.vehicleNo} passage`
            : `📋 Creating ${formData.noOfDocuments} identical manual entries for vehicle ${formData.vehicleNo}`
          }
        </Text>
      </View>

      {/* ✅ Remarks - Optional */}
      <View style={styles.row}>
        <View style={styles.fieldFull}>
          <Text style={styles.label}>Remarks (Optional)</Text>
          <TextInput 
            style={[styles.input, styles.multilineInput]} 
            value={formData.remarks}
            onChangeText={(text) => updateField('remarks', text)}
            placeholder={
              formData.noOfDocuments === 0 
                ? "Enter any remarks about this empty vehicle"
                : "Enter any remarks about this vehicle entry"
            }
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

      {/* Rest of the form - info box, buttons, etc. */}
        {/* ✅ UPDATED: Dynamic information box based on entry type */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            {formData.noOfDocuments === 0 ? 'ℹ️ Empty Vehicle Entry:' : 'ℹ️ How Multi-Document Entry Works:'}
          </Text>
          {formData.noOfDocuments === 0 ? (
            <>
              <Text style={styles.infoText}>
                1. Creates 1 entry with document type "EMPTY VEHICLE"
              </Text>
              <Text style={styles.infoText}>
                2. Records vehicle passage for audit purposes
              </Text>
              <Text style={styles.infoText}>
                3. No document assignment needed
              </Text>
              <Text style={styles.infoText}>
                4. Entry is complete and ready for reporting
              </Text>
            </>
          ) : (
            <>
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
            </>
          )}
        </View>

        {/* ✅ UPDATED: Dynamic action button */}
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[
              styles.button, 
              styles.submitButton, 
              formData.noOfDocuments === 0 ? styles.emptyVehicleButton : styles.enhancedSubmitButton,
              isSubmitting && styles.buttonDisabled
            ]} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, styles.enhancedButtonText]}>
                {formData.noOfDocuments === 0 
                  ? '🚛 Record Empty Vehicle'
                  : `📋 Create ${formData.noOfDocuments} ${formData.noOfDocuments === 1 ? 'Entry' : 'Entries'}`
                }
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

        {/* ✅ UPDATED: Dynamic loading state display */}
        {isSubmitting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>
              {formData.noOfDocuments === 0 
                ? 'Recording empty vehicle entry...'
                : `Creating ${formData.noOfDocuments} manual entries...`
              }
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default ManualEntryForm;