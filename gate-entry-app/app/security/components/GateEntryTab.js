// app/security/components/GateEntryTab.js - MERGED with FG/RM Toggle
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import Checkbox from 'expo-checkbox';
import styles from '../styles/gateEntryStyles';
import { useRouter } from 'expo-router';
import { gateAPI, rmAPI, handleAPIError, validationAPI, gateHelpers } from '../../../services/api';
import { showAlert } from '../../../utils/customModal';

const GateEntryTab = ({ 
  gateEntryData, 
  onDataChange, 
  onSubmit, 
  onAddManualEntry, 
  onClearAll,
  userData 
}) => {
  const router = useRouter();
  
  // ✅ MERGED: Entry type toggle (FG or RM)
  const [entryType, setEntryType] = useState('FG');
  
// ✅ MERGED: State management for FG Entry
const [isSearching, setIsSearching] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [searchResults, setSearchResults] = useState(null);
const [selectedDocuments, setSelectedDocuments] = useState([]);
const [vehicleStatus, setVehicleStatus] = useState(null);

// ✅ NEW: Operational data validation state
const [operationalData, setOperationalData] = useState({
  driver_name: '',
  km_reading: '',
  loader_names: ''
});

const [validationErrors, setValidationErrors] = useState({
  driver_name: '',
  km_reading: '',
  loader_names: ''
});

const [fieldValidation, setFieldValidation] = useState({
  driver_name: { isValid: false, touched: false },
  km_reading: { isValid: false, touched: false },
  loader_names: { isValid: false, touched: false }
});

  // ✅ MERGED: State management for RM Entry
  const [rmFormData, setRMFormData] = useState({
    gateType: 'Gate-In',
    vehicleNo: '',
    documentNo: '',
    nameOfParty: '',
    descriptionOfMaterial: '',
    quantity: ''
  });

  // ✅ MERGED: RM form handlers
  const updateRMField = (field, value) => {
    setRMFormData({
      ...rmFormData,
      [field]: value
    });
  };

  const validateRMForm = () => {
    if (!rmFormData.vehicleNo.trim()) {
      showAlert('Error', 'Vehicle number is required');
      return false;
    }
    
    if (rmFormData.vehicleNo.trim().length < 8) {
      showAlert('Error', 'Vehicle number must be at least 8 characters');
      return false;
    }
    
    if (!rmFormData.documentNo.trim()) {
      showAlert('Error', 'Document number is required');
      return false;
    }
    
    if (!rmFormData.nameOfParty.trim()) {
      showAlert('Error', 'Name of Party is required');
      return false;
    }
    
    if (!rmFormData.descriptionOfMaterial.trim()) {
      showAlert('Error', 'Description of Material is required');
      return false;
    }
    
    if (!rmFormData.quantity.trim()) {
      showAlert('Error', 'Quantity is required');
      return false;
    }

    return true;
  };

  const handleRMSubmit = async () => {
    if (!validateRMForm()) return;

    showAlert(
      'Confirm Submission',
      `Create ${rmFormData.gateType} entry for vehicle ${rmFormData.vehicleNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: performRMSubmit }
      ]
    );
  };

  const performRMSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const entryData = {
        gate_type: rmFormData.gateType,
        vehicle_no: rmFormData.vehicleNo.trim(),
        document_no: rmFormData.documentNo.trim(),
        name_of_party: rmFormData.nameOfParty.trim(),
        description_of_material: rmFormData.descriptionOfMaterial.trim(),
        quantity: rmFormData.quantity.trim()
      };

      const response = await rmAPI.createRMEntry(entryData);
      
      showAlert(
        'Success', 
        `Raw Materials ${rmFormData.gateType} created successfully!\n\nGate Entry No: ${response.gate_entry_no}\nVehicle: ${response.vehicle_no}\nDateTime: ${new Date(response.date_time).toLocaleString()}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setRMFormData({
                gateType: 'Gate-In',
                vehicleNo: '',
                documentNo: '',
                nameOfParty: '',
                descriptionOfMaterial: '',
                quantity: ''
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('RM entry submission failed:', error);
      
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

  const handleRMClear = () => {
    showAlert(
      'Clear All',
      'Are you sure you want to clear all fields?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setRMFormData({
              gateType: 'Gate-In',
              vehicleNo: '',
              documentNo: '',
              nameOfParty: '',
              descriptionOfMaterial: '',
              quantity: ''
            });
          }
        }
      ]
    );
  };

  // ✅ MERGED: FG Entry handlers (existing logic)
  const updateField = (field, value) => {
    onDataChange({
      ...gateEntryData,
      [field]: value
    });
  };

  const handleDocumentSelection = (documentNo, isSelected) => {
    if (isSelected) {
      setSelectedDocuments(prev => [...prev, documentNo]);
    } else {
      setSelectedDocuments(prev => prev.filter(doc => doc !== documentNo));
    }
  };

  const handleVehicleSearch = async () => {
    const vehicleNo = gateEntryData.vehicleNo?.trim();
    
    if (!vehicleNo) {
      showAlert('Error', 'Please enter vehicle number');
      return;
    }

    if (isSearching) {
      return;
    }

    setIsSearching(true);
    setSearchResults(null);
    setSelectedDocuments([]);
    setVehicleStatus(null);

    try {
      const status = await gateAPI.getVehicleStatus(vehicleNo);
      setVehicleStatus(status);
      
      const selectedGateType = gateEntryData.gateType;
      const sequenceError = validationAPI.getGateSequenceError(status, selectedGateType);
      
      if (sequenceError) {
        showAlert('Error', sequenceError);
        setIsSearching(false);
        return;
      }
      
      try {
        const results = await gateAPI.searchRecentDocuments(vehicleNo);
        setSearchResults(results);
        
      } catch (searchError) {
        if (searchError.response?.status === 404) {
          setSearchResults({ count: 0, documents: [] });
        } else {
          throw searchError;
        }
      }
      
    } catch (error) {
      console.error('Vehicle search error:', error);
      
      if (error.response?.status === 400 && error.response.data.detail.includes('already has Gate')) {
        showAlert('Gate Sequence Error', error.response.data.detail);
      } else {
        const errorMessage = handleAPIError(error);
        showAlert('Search Error', errorMessage);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnhancedSubmit = async () => {
    const vehicleNo = gateEntryData.vehicleNo?.trim();
    
    if (isSubmitting) {
      return;
    }
    
    if (!vehicleNo) {
      showAlert('Error', 'Please enter vehicle number');
      return;
    }

    if (!searchResults) {
      showAlert('Error', 'Please search for documents first');
      return;
    }

    if (gateHelpers.isEmptyVehicle(searchResults)) {
      showAlert(
        'Empty Vehicle Detected',
        'This vehicle has no documents. Would you like to create a manual entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Manual Entry', 
            onPress: () => {
              router.push(`/security/manual-entry?vehicle=${encodeURIComponent(vehicleNo)}&gateType=${gateEntryData.gateType}`);
            }
          }
        ]
      );
      return;
    }

    if (selectedDocuments.length === 0) {
      showAlert('Error', 'Please select at least one document');
      return;
    }

    showAlert(
      'Confirm Submission',
      `Submit ${gateEntryData.gateType} for ${selectedDocuments.length} document(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Submit', 
          onPress: async () => {
            await performSubmission();
          }
        }
      ]
    );
  };

  const performSubmission = async () => {
    setIsSubmitting(true);
    
    try {
      const batchData = {
        gate_type: gateEntryData.gateType,
        vehicle_no: gateEntryData.vehicleNo?.trim(),
        document_nos: selectedDocuments,
        remarks: gateEntryData.remarks || null
      };
      
      const result = await gateAPI.createBatchGateEntry(batchData);
      
      const successMessage = gateHelpers.formatSuccessMessage(result, false);
      
      showAlert('Success', successMessage);
      
      setSearchResults(null);
      setSelectedDocuments([]);
      setVehicleStatus(null);
      
      onDataChange({
        gateType: 'Gate-In',
        vehicleNo: '',
        transporterName: '',
        driverName: '',
        kmIn: '',
        kmOut: '',
        loaderNames: '',
        remarks: '',
        gateEntryNo: '',
        dateTime: ''
      });
      
    } catch (error) {
      console.error('Batch gate entry submission failed:', error);
      
      if (error.response?.status === 400 && error.response.data.detail.includes('already has Gate')) {
        showAlert('Gate Sequence Error', error.response.data.detail);
      } else {
        const errorMessage = handleAPIError(error);
        showAlert('Submission Error', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearButtonPress = () => {
    if (entryType === 'RM') {
      handleRMClear();
    } else {
      showAlert(
        'Clear All',
        'Are you sure you want to clear all fields?',
        [
          { text: 'CANCEL', style: 'cancel' },
          {
            text: 'CLEAR',
            style: 'destructive',
            onPress: () => {
              setSearchResults(null);
              setSelectedDocuments([]);
              setVehicleStatus(null);
              
              onDataChange({
                gateType: 'Gate-In',
                vehicleNo: '',
                transporterName: '',
                driverName: '',
                kmIn: '',
                kmOut: '',
                loaderNames: '',
                remarks: '',
                gateEntryNo: '',
                dateTime: ''
              });
            }
          }
        ]
      );
    }
  };

  // ✅ MERGED: Table rendering logic
  const tableColumns = useMemo(() => [
    { key: 'gate_entry_no', title: 'Gate Entry No.', width: 130 },
    { key: 'select', title: 'Select', width: 70 },
    { key: 'document_no', title: 'Document No.', width: 110 },
    { key: 'document_type', title: 'Doc Type', width: 90 },
    { key: 'sub_document_type', title: 'Sub Doc Type', width: 100 },
    { key: 'document_date', title: 'Doc Date', width: 90 },
    { key: 'vehicle_no', title: 'Vehicle No.', width: 100 },
    { key: 'warehouse_name', title: 'Warehouse Name', width: 160 },
    { key: 'customer_name', title: 'Customer Name', width: 140 },
    { key: 'site', title: 'Site', width: 70 },
    { key: 'route_code', title: 'Route Code', width: 90 },
    { key: 'transporter_name', title: 'Transporter', width: 130 },
    { key: 'direct_dispatch', title: 'Direct Dispatch', width: 110 },
    { key: 'total_quantity', title: 'Total Qty.', width: 80 }
  ], []);

  const totalTableWidth = useMemo(() => {
    return tableColumns.reduce((sum, col) => sum + col.width, 0);
  }, [tableColumns]);

  const renderCell = (column, doc) => {
    const cellStyle = [styles.tableCell, { width: column.width }];
    
    switch (column.key) {
      case 'gate_entry_no':
        return (
          <View style={cellStyle}>
            <Text style={[
              styles.cellText, 
              { 
                color: doc.gate_entry_no ? '#28a745' : '#dc3545', 
                fontWeight: 'bold' 
              }
            ]}>
              {doc.gate_entry_no || '--'}
            </Text>
          </View>
        );
      
      case 'select':
        return (
          <View style={[cellStyle, { alignItems: 'center', justifyContent: 'center' }]}>
            <Checkbox
              value={selectedDocuments.includes(doc.document_no)}
              onValueChange={(selected) => handleDocumentSelection(doc.document_no, selected)}
            />
          </View>
        );
      
      case 'document_date':
        return (
          <View style={cellStyle}>
            <Text style={styles.cellText}>
              {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : '--'}
            </Text>
          </View>
        );
      
      case 'transporter_name':
        return (
          <View style={cellStyle}>
            <Text style={[styles.cellText, { color: '#007bff', fontWeight: 'bold' }]}>
              {doc.transporter_name || 'FROM DATABASE'}
            </Text>
          </View>
        );
      
      default:
        return (
          <View style={cellStyle}>
            <Text style={styles.cellText}>
              {doc[column.key] || '--'}
            </Text>
          </View>
        );
    }
  };

  const renderDocumentTable = () => {
    if (!searchResults) return null;

    if (searchResults.count === 0) {
      return (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>
            🚛 Empty Vehicle Detected
          </Text>
          <Text style={styles.noResultsSubtext}>
            No documents found for this vehicle within the last 48 hours.
            This appears to be an empty vehicle.
          </Text>
          <TouchableOpacity 
            style={styles.manualEntryButton}
            onPress={() => router.push(`/security/manual-entry?vehicle=${encodeURIComponent(gateEntryData.vehicleNo)}&gateType=${gateEntryData.gateType}`)}
          >
            <Text style={styles.manualEntryButtonText}>Create Manual Entry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cleanTableContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          style={styles.tableScrollView}
        >
          <View style={[styles.tableWrapper, { width: totalTableWidth }]}>
            <View style={styles.tableHeaderRow}>
              {tableColumns.map((column) => (
                <View 
                  key={`header-${column.key}`} 
                  style={[styles.tableHeaderCell, { width: column.width }]}
                >
                  <Text style={styles.tableHeaderText}>{column.title}</Text>
                </View>
              ))}
            </View>

            <ScrollView 
              style={styles.tableDataContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {searchResults.documents.map((doc, index) => (
                <View 
                  key={`row-${doc.document_no}-${index}`} 
                  style={[
                    styles.tableDataRow,
                    index % 2 === 0 ? styles.evenRow : styles.oddRow
                  ]}
                >
                  {tableColumns.map((column) => (
                    <View key={`cell-${doc.document_no}-${column.key}`}>
                      {renderCell(column, doc)}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
        
        <View style={styles.scrollHintContainer}>
          <Text style={styles.scrollHintText}>
            💡 Scroll horizontally and vertically to see all data
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.cardContainer}
    >
      {/* ✅ MERGED: Entry Type Toggle (FG/RM) */}
      <View style={styles.entryTypeContainer}>
        <Text style={styles.entryTypeLabel}>Entry Type:</Text>
        <View style={styles.entryTypeRow}>
          {['FG', 'RM'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.entryTypeButton,
                entryType === type && styles.entryTypeButtonActive
              ]}
              onPress={() => setEntryType(type)}
              disabled={isSubmitting || isSearching}
            >
              <Text style={[
                styles.entryTypeButtonText,
                entryType === type && styles.entryTypeButtonTextActive
              ]}>
                {type} Entry
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ✅ MERGED: Conditional Form Rendering */}
      {entryType === 'FG' ? (
        // FG Entry Form (existing logic)
        <>
          <Text style={styles.sectionTitle}>FG Vehicle Entry Details</Text>

          <View style={styles.row}>
            <View style={styles.field33}>
              <Text style={styles.label}>Gate Type:</Text>
              <View style={styles.radioRow}>
                {['Gate-In', 'Gate-Out'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.radioButton}
                    onPress={() => updateField('gateType', type)}
                    disabled={isSubmitting || isSearching}
                  >
                    <View style={styles.radioCircle}>
                      {gateEntryData.gateType === type && <View style={styles.selectedDot} />}
                    </View>
                    <Text>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field33}>
              <Text style={styles.label}>Gate Entry No</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Auto-generated" 
                value={gateEntryData.gateEntryNo || ''} 
                editable={false} 
              />
            </View>

            <View style={styles.field33}>
              <Text style={styles.label}>Date & Time</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Auto-filled" 
                value={gateEntryData.dateTime || ''} 
                editable={false} 
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field40}>
              <Text style={styles.label}>Vehicle No *</Text>
              <View style={styles.vehicleInputRow}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8 }]} 
                  placeholder="Enter Vehicle No" 
                  value={gateEntryData.vehicleNo || ''} 
                  onChangeText={(text) => updateField('vehicleNo', text.toUpperCase())}
                  autoCapitalize="characters"
                  editable={!isSubmitting && !isSearching}
                />
                <TouchableOpacity 
                  style={[
                    styles.searchButton,
                    (isSearching || isSubmitting) && styles.buttonDisabled
                  ]}
                  onPress={handleVehicleSearch}
                  disabled={isSearching || isSubmitting}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field35}>
              <Text style={styles.label}>Driver Name</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Driver Name" 
                value={gateEntryData.driverName || ''} 
                onChangeText={(text) => updateField('driverName', text)}
                editable={!isSubmitting && !isSearching}
              />
            </View>

            <View style={styles.field10}>
              <Text style={styles.label}>KM IN</Text>
              <TextInput 
                style={styles.input} 
                placeholder="0" 
                keyboardType="numeric" 
                value={gateEntryData.kmIn || ''} 
                onChangeText={(text) => updateField('kmIn', text)}
                editable={!isSubmitting && !isSearching}
              />
            </View>

            <View style={styles.field10}>
              <Text style={styles.label}>KM OUT</Text>
              <TextInput 
                style={styles.input} 
                placeholder="0" 
                keyboardType="numeric" 
                value={gateEntryData.kmOut || ''} 
                onChangeText={(text) => updateField('kmOut', text)}
                editable={!isSubmitting && !isSearching}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field75}>
              <Text style={styles.label}>Remarks</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Optional" 
                value={gateEntryData.remarks || ''} 
                onChangeText={(text) => updateField('remarks', text)}
                editable={!isSubmitting && !isSearching}
              />
            </View>

            <View style={styles.field25}>
              <Text style={styles.label}>Loader Names</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Loader Name" 
                value={gateEntryData.loaderNames || ''} 
                onChangeText={(text) => updateField('loaderNames', text)}
                editable={!isSubmitting && !isSearching}
              />
            </View>
          </View>

          {vehicleStatus && vehicleStatus.status === "active" && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusTitle}>Vehicle Status:</Text>
              <Text style={styles.statusText}>
                Last Movement: {vehicleStatus.last_movement.type} on {new Date(vehicleStatus.last_movement.date).toLocaleDateString()}
              </Text>
            </View>
          )}

          {searchResults && (
            <View style={styles.searchResultsContainer}>
              <Text style={styles.searchResultsTitle}>
                Search Results for {gateEntryData.vehicleNo} ({searchResults.count} documents found)
              </Text>
              {selectedDocuments.length > 0 && (
                <Text style={styles.selectedCountText}>
                  {selectedDocuments.length} document(s) selected for submission
                </Text>
              )}
            </View>
          )}
          
          {renderDocumentTable()}

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[
                styles.button, 
                styles.submitButton,
                (isSubmitting || !searchResults || (searchResults.count > 0 && selectedDocuments.length === 0)) && styles.buttonDisabled
              ]} 
              onPress={handleEnhancedSubmit}
              disabled={isSubmitting || !searchResults || (searchResults.count > 0 && selectedDocuments.length === 0)}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.buttonText}>
                  {searchResults && searchResults.count === 0 ? 'Manual Entry' : `Submit (${selectedDocuments.length} selected)`}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.button,
                styles.manualButton,
                (isSubmitting || isSearching) && styles.buttonDisabled
              ]} 
              onPress={() => router.push(`/security/manual-entry?vehicle=${encodeURIComponent(gateEntryData.vehicleNo || '')}&gateType=${gateEntryData.gateType}`)}
              disabled={isSubmitting || isSearching}
            >
              <Text style={styles.buttonText}>Manual Entry</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.button,
                styles.clearButton,
                (isSubmitting || isSearching) && styles.buttonDisabled
              ]} 
              onPress={handleClearButtonPress}
              disabled={isSubmitting || isSearching}
            >
              <Text style={styles.buttonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        // ✅ MERGED: RM Entry Form
        <>
          <Text style={styles.sectionTitle}>Raw Materials Entry</Text>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Gate Type:</Text>
              <View style={styles.radioRow}>
                {['Gate-In', 'Gate-Out'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.radioButton}
                    onPress={() => updateRMField('gateType', type)}
                    disabled={isSubmitting}
                  >
                    <View style={styles.radioCircle}>
                      {rmFormData.gateType === type && <View style={styles.selectedDot} />}
                    </View>
                    <Text>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Vehicle Number *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Vehicle Number" 
                value={rmFormData.vehicleNo} 
                onChangeText={(text) => updateRMField('vehicleNo', text.toUpperCase())}
                autoCapitalize="characters"
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Document Number *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Document Number" 
                value={rmFormData.documentNo} 
                onChangeText={(text) => updateRMField('documentNo', text)}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Name of Party *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Name of Party" 
                value={rmFormData.nameOfParty} 
                onChangeText={(text) => updateRMField('nameOfParty', text)}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Description of Material *</Text>
              <TextInput 
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                placeholder="Enter Description of Material" 
                value={rmFormData.descriptionOfMaterial} 
                onChangeText={(text) => updateRMField('descriptionOfMaterial', text)}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldFull}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter Quantity" 
                value={rmFormData.quantity} 
                onChangeText={(text) => updateRMField('quantity', text)}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[
                styles.button, 
                styles.submitButton,
                isSubmitting && styles.buttonDisabled
              ]} 
              onPress={handleRMSubmit}
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
              onPress={handleClearButtonPress}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {(isSearching || isSubmitting) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>
            {isSearching ? 'Searching documents...' : isSubmitting ? (entryType === 'RM' ? 'Creating RM entry...' : 'Submitting gate entries...') : ''}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default GateEntryTab;