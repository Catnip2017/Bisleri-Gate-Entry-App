// app/security/components/OperationalEditModal.js - SIMPLIFIED FOR VISIBILITY
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { insightsAPI, handleAPIError } from '../../../services/api';
import { showAlert, confirmAction } from '../../../utils/customModal';
import { validateOperationalData } from '../../../utils/validators';

const OperationalEditModal = ({ 
  visible, 
  record, 
  onClose, 
  onSuccess 
}) => {
  // Form state
  const [formData, setFormData] = useState({
    driver_name: '',
    km_reading: '',
    loader_names: '',
    loader_count: '',   // ✅ ADD
    interlayer_sheet_count: '0',   // compulsory, defaults to 0
    remarks: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when record changes
  useEffect(() => {
    if (record && visible) {
      setFormData({
        driver_name: record.driver_name || '',
        km_reading: record.km_reading || '',
        loader_count: record.loader_count != null ? String(record.loader_count) : '',
        loader_names: record.loader_names || '',
        interlayer_sheet_count:
          record.interlayer_sheet_count != null
            ? String(record.interlayer_sheet_count)
            : '0',
        remarks: record.remarks || ''
      });
    }
  }, [record, visible]);

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    // ✅ FIX: shared validators — identical rules to the create form
    // (GateEntryTab). Previously this modal accepted values the create form
    // would reject (e.g. a 1-digit KM reading).
    const validation = validateOperationalData(formData);
    if (!validation.isValid) {
      showAlert('Validation Error', validation.firstError);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const updateData = {
        gate_entry_no: record.gate_entry_no,
        driver_name: formData.driver_name.trim(),
        km_reading: formData.km_reading.trim(),
        loader_count: formData.loader_count ? parseInt(formData.loader_count) : null,  // ✅ ADD
        loader_names: formData.loader_names.trim(),
        interlayer_sheet_count: formData.interlayer_sheet_count
          ? parseInt(formData.interlayer_sheet_count, 10)
          : 0,
        remarks: formData.remarks.trim() || null
      };

      const response = await insightsAPI.updateOperationalData(updateData);
      
      showAlert(
        'Success', 
        'Operational data updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess(response);
              onClose();
            }
          }
        ]
      );
      
    } catch (error) {
      console.log('Error updating operational data:', error);
      const errorMessage = handleAPIError(error);
      showAlert('Update Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unsaved-changes guard: warn before discarding edits (Cancel or
  // Android back button). Compares against the record's original values.
  const isDirty = record ? (
    formData.driver_name !== (record.driver_name || '') ||
    formData.km_reading !== (record.km_reading || '') ||
    formData.loader_count !== (record.loader_count != null ? String(record.loader_count) : '') ||
    formData.loader_names !== (record.loader_names || '') ||
    formData.interlayer_sheet_count !==
      (record.interlayer_sheet_count != null
        ? String(record.interlayer_sheet_count)
        : '0') ||
    formData.remarks !== (record.remarks || '')
  ) : false;

  const handleCancel = () => {
    if (isSubmitting) return;
    if (isDirty) {
      confirmAction({
        title: 'Discard changes?',
        message: 'You have unsaved changes. Close without saving?',
        confirmText: 'Discard',
        destructive: true,
        onConfirm: onClose,
      });
    } else {
      onClose();
    }
  };

  if (!record) {
    return null;
  }

  const isCompletionRequired = record?.edit_button_config?.action === 'complete_required';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 20,
          width: '90%',
          maxHeight: '80%',
        }}>
          
          {/* Header */}
          <Text style={{
            fontSize: 20,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 16,
            color: '#333',
          }}>
            {isCompletionRequired ? 'Complete Operational Info' : 'Edit Operational Details'}
          </Text>
          
          {/* Status Message */}
          <View style={{
            backgroundColor: '#fff3cd',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}>
            <Text style={{
              color: '#856404',
              textAlign: 'center',
              fontSize: 14,
            }}>
              {record?.edit_button_config?.message || 'Complete the missing operational information'}
            </Text>
          </View>

          {/* Form Fields Container */}
          <ScrollView style={{ maxHeight: 300 }}>
            
            {/* Record Info */}
            <View style={{
              backgroundColor: '#f8f9fa',
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Record Information:</Text>
              <Text>Gate Entry: {record.gate_entry_no}</Text>
              <Text>Vehicle: {record.vehicle_no}</Text>
              <Text>Movement: {record.movement_type}</Text>
            </View>

            {/* Driver Name Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
                color: '#333',
              }}>
                Driver Name *
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: '#ced4da',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 48,
                }}
                placeholder="Enter driver's full name"
                value={formData.driver_name}
                onChangeText={(text) => updateField('driver_name', text)}
                maxLength={50}
                autoCapitalize="words"
              />
            </View>

            {/* KM Reading Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
                color: '#333',
              }}>
                {record.movement_type === 'Gate-Out' ? 'KM OUT Reading' : 'KM IN Reading'} *
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: '#ced4da',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 48,
                }}
                placeholder="Enter KM reading (e.g., 12345)"
                value={formData.km_reading}
                onChangeText={(text) => updateField('km_reading', text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            {/* Loader Names Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
                color: '#333',
              }}>
                Loader Names *
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: '#ced4da',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                placeholder="Enter loader names (comma-separated)&#10;Example: John Doe, Mike Smith"
                value={formData.loader_names}
                onChangeText={(text) => updateField('loader_names', text)}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
              <Text style={{
                fontSize: 12,
                color: '#6c757d',
                marginTop: 4,
              }}>
                Separate multiple names with commas
              </Text>
            </View>

            {/* Loader Count Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
                color: '#333',
              }}>
                Loader Count *
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: '#ced4da',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 48,
                }}
                placeholder="Enter number of loaders"
                value={formData.loader_count}
                onChangeText={(text) => updateField('loader_count', text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>

            {/* Interlayer Sheet Count Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
                color: '#333',
              }}>
                Interlayer Sheet Count *
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: '#ced4da',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 48,
                }}
                placeholder="Enter interlayer sheet count"
                value={formData.interlayer_sheet_count}
                onChangeText={(text) => updateField('interlayer_sheet_count', text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            {/* Remarks Field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                marginBottom: 8,
                color: '#333',
              }}>
                Remarks (Optional)
              </Text>
              <TextInput
                style={{
                  borderWidth: 2,
                  borderColor: '#ced4da',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#fff',
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                placeholder="Enter any additional remarks"
                value={formData.remarks}
                onChangeText={(text) => updateField('remarks', text)}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

          </ScrollView>

          {/* Action Buttons */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 20,
            gap: 12,
          }}>
            <TouchableOpacity 
              style={{
                flex: 1,
                backgroundColor: '#6c757d',
                paddingVertical: 16,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={handleCancel}
              disabled={isSubmitting}
            >
              <Text style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: 16,
              }}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{
                flex: 1,
                backgroundColor: isCompletionRequired ? '#ffc107' : '#28a745',
                paddingVertical: 16,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={{
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>
                  {isCompletionRequired ? 'Complete Info' : 'Save Changes'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

export default OperationalEditModal;