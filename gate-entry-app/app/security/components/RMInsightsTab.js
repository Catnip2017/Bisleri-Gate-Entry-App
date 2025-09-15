// app/security/components/RMInsightsTab.js - UPDATED WITH PAGINATION AND SCROLLING
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import styles from '../styles/insightsStyles';
import { getCurrentUser } from '../../../utils/jwtUtils';
import { showAlert } from '../../../utils/customModal';

const RMInsightsTab = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [rmEntries, setRMEntries] = useState([]);
  const [userData, setUserData] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // ✅ NEW: Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Date picker states
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  // Vehicle filter state
  const [vehicleFilter, setVehicleFilter] = useState('');

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    gate_entry_no: '',
    vehicle_no: '',
    document_no: '',
    name_of_party: '',
    description_of_material: '',
    quantity: ''
  });

  // Load initial data
  useEffect(() => {
    loadUserData();
    loadRMEntries();
    loadStatistics();
  }, []);

  // Helper function to format date as YYYY-MM-DD for API
  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to format date as DD-MM-YYYY for display
  const formatDateToDDMMYYYY = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Add this new function after formatDateToDDMMYYYY
  const renderDatePicker = (value, onChange, show, setShow, label) => {
    if (Platform.OS === 'web') {
      // Web: Use HTML5 date input
      return (
        <input
          type="date"
          value={value.toISOString().split('T')[0]} // Convert to YYYY-MM-DD format
          onChange={(e) => {
            const newDate = new Date(e.target.value);
            onChange(null, newDate);
          }}
          style={{
            borderWidth: 1,
            borderColor: '#aaa',
            padding: 10,
            borderRadius: 4,
            backgroundColor: 'white',
            fontSize: 14,
            width: '100%',
            minHeight: 40,
          }}
        />
      );
    }
    
    // Mobile: Use existing DateTimePicker
    return (
      <>
        <TouchableOpacity 
          style={styles.datePickerButton}
          onPress={() => setShow(true)}
        >
          <Text style={styles.datePickerText}>
            {formatDateToDDMMYYYY(value)}
          </Text>
        </TouchableOpacity>
        
        {show && (
          <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShow(Platform.OS === 'ios');
              if (selectedDate) {
                onChange(event, selectedDate);
              }
            }}
          />
        )}
      </>
    );
  };

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const { rmAPI } = await import('../../../services/api');
      const stats = await rmAPI.getRMStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading RM statistics:', error);
    }
  };

  // ✅ FIXED: Enhanced loadRMEntries with better filtering
  const loadRMEntries = async () => {
    setLoading(true);
    try {
      const { rmAPI } = await import('../../../services/api');
      
      // ✅ DEBUG: Log filter values
      console.log('RM Filter Debug:', {
        vehicleFilter: vehicleFilter,
        vehicleFilterTrimmed: vehicleFilter.trim(),
        fromDate: formatDateForAPI(fromDate),
        toDate: formatDateForAPI(toDate)
      });
      
      const filter = {
        from_date: formatDateForAPI(fromDate),
        to_date: formatDateForAPI(toDate),
        warehouse_code: userData?.warehouse_code || null,
        vehicle_no: vehicleFilter.trim() || null,
        movement_type: null
      };

      console.log('Final filter sent to API:', filter);

      const response = await rmAPI.getFilteredRMEntries(filter);
      setRMEntries(response.results || []);
      setCurrentPage(1); // Reset to first page when data loads
      
    } catch (error) {
      console.error('Error loading RM entries:', error);
      const { handleAPIError } = await import('../../../services/api');
      const errorMessage = handleAPIError(error);
      showAlert('Error', `Failed to load entries: ${errorMessage}`, [
        { text: 'OK', onPress: () => {} }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Date picker handlers
  const onFromDateChange = (event, selectedDate) => {
    setShowFromDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFromDate(selectedDate);
    }
  };

  const onToDateChange = (event, selectedDate) => {
    setShowToDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setToDate(selectedDate);
    }
  };

  // ✅ ENHANCED: Apply filters with debug logging
  const handleApplyFilters = () => {
    console.log('Applying RM filters - Vehicle Filter:', vehicleFilter);
    loadRMEntries();
    loadStatistics();
  };

  // ✅ NEW: Pagination calculations
  const totalItems = rmEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRMEntries = rmEntries.slice(startIndex, endIndex);
  const startItem = totalItems > 0 ? startIndex + 1 : 0;
  const endItem = Math.min(endIndex, totalItems);

  // ✅ NEW: Pagination handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  // Open edit modal
  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditFormData({
      gate_entry_no: record.gate_entry_no,
      vehicle_no: record.vehicle_no,
      document_no: record.document_no,
      name_of_party: record.name_of_party,
      description_of_material: record.description_of_material,
      quantity: record.quantity
    });
    setEditModalVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingRecord(null);
    setEditFormData({
      gate_entry_no: '',
      vehicle_no: '',
      document_no: '',
      name_of_party: '',
      description_of_material: '',
      quantity: ''
    });
  };

  // Validate edit form
  const validateEditForm = () => {
    if (!editFormData.vehicle_no.trim()) {
      showAlert('Error', 'Vehicle number is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }
    
    if (editFormData.vehicle_no.trim().length < 8) {
      showAlert('Error', 'Vehicle number must be at least 8 characters', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }
    
    if (!editFormData.document_no.trim()) {
      showAlert('Error', 'Document number is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }
    
    if (!editFormData.name_of_party.trim()) {
      showAlert('Error', 'Name of Party is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }
    
    if (!editFormData.description_of_material.trim()) {
      showAlert('Error', 'Description of Material is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }
    
    if (!editFormData.quantity.trim()) {
      showAlert('Error', 'Quantity is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }

    return true;
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    if (!validateEditForm()) return;

    setIsSubmittingEdit(true);
    
    try {
      const { rmAPI } = await import('../../../services/api');
      
      const response = await rmAPI.updateRMEntry(editFormData);
      
      showAlert(
        'Success', 
        'Raw materials entry updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              closeEditModal();
              loadRMEntries();
              loadStatistics();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error updating RM entry:', error);
      const { handleAPIError } = await import('../../../services/api');
      const errorMessage = handleAPIError(error);
      showAlert('Update Failed', errorMessage, [
        { text: 'OK', onPress: () => {} }
      ]);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Render edit button
  const renderEditButton = (record) => {
    if (!record.can_edit) {
      return (
        <TouchableOpacity style={[styles.actionButton, styles.expiredButton]} disabled>
          <Text style={styles.actionButtonText}>⚫ Expired</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        style={[styles.actionButton, styles.editDetailsButton]}
        onPress={() => openEditModal(record)}
      >
        <Text style={styles.actionButtonText}>✏️ Edit</Text>
      </TouchableOpacity>
    );
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!statistics) {
      return {
        totalEntries: 0,
        gateInCount: 0,
        gateOutCount: 0,
        uniqueVehicles: 0
      };
    }
    
    return {
      totalEntries: statistics.total_entries,
      gateInCount: statistics.gate_in_count,
      gateOutCount: statistics.gate_out_count,
      uniqueVehicles: statistics.unique_vehicles
    };
  }, [statistics]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Card Container */}
      <View style={styles.card}>
        
        {/* Stats Cards */}
        <View style={styles.statsCardsContainer}>
          <View style={styles.statsRowContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalEntries}</Text>
              <Text style={styles.statLabel}>Total RM Entries</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#28a745' }]}>
              <Text style={styles.statNumber}>{stats.gateInCount}</Text>
              <Text style={styles.statLabel}>Gate In</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#dc3545' }]}>
              <Text style={styles.statNumber}>{stats.gateOutCount}</Text>
              <Text style={styles.statLabel}>Gate Out</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#ffc107' }]}>
              <Text style={styles.statNumber}>{stats.uniqueVehicles}</Text>
              <Text style={styles.statLabel}>Unique Vehicles</Text>
            </View>
          </View>
        </View>
        
        {/* Filters */}
        <View style={styles.filters}>
          {/* From Date */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>From Date</Text>
            {renderDatePicker(
              fromDate, 
              onFromDateChange, 
              showFromDatePicker, 
              setShowFromDatePicker,
              'From Date'
            )}
          </View>
                    
          {/* To Date */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>To Date</Text>
            {renderDatePicker(
              toDate, 
              onToDateChange, 
              showToDatePicker, 
              setShowToDatePicker,
              'To Date'
            )}
          </View>

          {/* Vehicle Number Filter */}
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Vehicle Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter vehicle no"
              value={vehicleFilter}
              onChangeText={setVehicleFilter}
              autoCapitalize="characters"
            />
          </View>

          {/* Search Button */}
          <View style={styles.filterItem}>
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={handleApplyFilters}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Raw Materials Movements</Text>

        {/* ✅ NEW: Pagination Info */}
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            {startItem} to {endItem} of {totalItems}
          </Text>
          <Text style={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>

        {/* ✅ UPDATED: Table with Proper Scrolling Structure */}
        <ScrollView horizontal style={styles.tableScrollContainer} showsHorizontalScrollIndicator={true}>
          <View style={styles.tableContainer}>
            
            {/* Table Header - Using RM Red Color */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colGateEntry]}>Gate Entry No</Text>
              <Text style={[styles.tableHeaderCell, styles.colMovement]}>Gate Type</Text>
              <Text style={[styles.tableHeaderCell, styles.colVehicle]}>Vehicle No</Text>
              <Text style={[styles.tableHeaderCell, styles.colDocumentNo]}>Document No</Text>
              <Text style={[styles.tableHeaderCell, styles.colWarehouse]}>Name of Party</Text>
              <Text style={[styles.tableHeaderCell, styles.colWarehouse]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.colDocumentNo]}>Quantity</Text>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.colTime]}>Time</Text>
              <Text style={[styles.tableHeaderCell, styles.colSecurity]}>Security Guard</Text>
              <Text style={[styles.tableHeaderCell, styles.colEditCount]}>Edit Count</Text>
              <Text style={[styles.tableHeaderCell, styles.colTimeRemaining]}>Time Remaining</Text>
              <Text style={[styles.tableHeaderCell, styles.colOperationalActions]}>Actions</Text>
            </View>

            {/* ✅ NEW: Proper Scrollable Table Data Container */}
            <ScrollView 
              style={[styles.tableDataContainer, { height: 500 }]} 
              showsVerticalScrollIndicator={true} 
              nestedScrollEnabled={true}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007bff" />
                  <Text style={styles.loadingText}>Loading RM entries...</Text>
                </View>
              ) : currentRMEntries.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No RM entries found for the selected filters</Text>
                </View>
              ) : (
                currentRMEntries.map((entry, index) => {
                  const actualIndex = startIndex + index;
                  return (
                    <View key={entry.id || actualIndex} style={[
                      styles.tableRow,
                      actualIndex % 2 === 0 ? styles.evenRow : styles.oddRow
                    ]}>
                      <Text style={[styles.tableCell, styles.colGateEntry]}>{entry.gate_entry_no}</Text>
                      <Text style={[styles.tableCell, styles.colMovement]}>{entry.gate_type}</Text>
                      <Text style={[styles.tableCell, styles.colVehicle]}>{entry.vehicle_no}</Text>
                      <Text style={[styles.tableCell, styles.colDocumentNo]}>{entry.document_no}</Text>
                      <Text style={[styles.tableCell, styles.colWarehouse]}>{entry.name_of_party}</Text>
                      <Text style={[styles.tableCell, styles.colWarehouse]} numberOfLines={2}>{entry.description_of_material}</Text>
                      <Text style={[styles.tableCell, styles.colDocumentNo]}>{entry.quantity}</Text>
                      <Text style={[styles.tableCell, styles.colDate]}>
                        {new Date(entry.date_time).toLocaleDateString()}
                      </Text>
                      <Text style={[styles.tableCell, styles.colTime]}>
                        {new Date(entry.date_time).toLocaleTimeString()}
                      </Text>
                      <Text style={[styles.tableCell, styles.colSecurity]}>{entry.security_name}</Text>
                      <Text style={[styles.tableCell, styles.colEditCount]}>{entry.edit_count || 0}</Text>
                      <Text style={[
                        styles.tableCell, 
                        styles.colTimeRemaining,
                        entry.can_edit ? { color: '#ffc107', fontWeight: 'bold' } : { color: '#6c757d' }
                      ]}>
                        {entry.time_remaining || 'Expired'}
                      </Text>
                      <View style={[styles.tableCell, styles.colOperationalActions]}>
                        {renderEditButton(entry)}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </ScrollView>

        {/* ✅ NEW: Pagination Controls */}
        <View style={styles.paginationControls}>
          <TouchableOpacity 
            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
            onPress={goToFirstPage}
            disabled={currentPage === 1}
          >
            <Text style={styles.paginationButtonText}>⏮️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
            onPress={goToPreviousPage}
            disabled={currentPage === 1}
          >
            <Text style={styles.paginationButtonText}>⬅️</Text>
          </TouchableOpacity>

          <View style={styles.pageInputContainer}>
            <TextInput
              style={styles.pageInput}
              value={currentPage.toString()}
              onChangeText={(text) => {
                const page = parseInt(text) || 1;
                goToPage(page);
              }}
              keyboardType="numeric"
              maxLength={3}
            />
            <Text style={styles.pageInputLabel}>of {totalPages}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
            onPress={goToNextPage}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.paginationButtonText}>➡️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
            onPress={goToLastPage}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.paginationButtonText}>⏭️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeEditModal}
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
              Edit Raw Materials Entry
            </Text>
            
            {/* Form Fields Container */}
            <ScrollView style={{ maxHeight: 400 }}>
              
              {/* Gate Entry Info */}
              <View style={{
                backgroundColor: '#f8f9fa',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Entry Information:</Text>
                <Text>Gate Entry: {editingRecord?.gate_entry_no}</Text>
                <Text>Gate Type: {editingRecord?.gate_type}</Text>
                <Text>Created: {editingRecord ? new Date(editingRecord.date_time).toLocaleString() : ''}</Text>
                <Text>Edit Count: {editingRecord?.edit_count || 0}</Text>
                {editingRecord?.time_remaining && (
                  <Text style={{ color: '#ffc107', fontWeight: 'bold' }}>
                    Time Remaining: {editingRecord.time_remaining}
                  </Text>
                )}
              </View>

              {/* Vehicle Number Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                  Vehicle Number *
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
                  value={editFormData.vehicle_no}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, vehicle_no: text.toUpperCase() }))}
                  autoCapitalize="characters"
                  placeholder="Enter Vehicle Number"
                />
              </View>

              {/* Document Number Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                  Document Number *
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
                  value={editFormData.document_no}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, document_no: text }))}
                  placeholder="Enter Document Number"
                />
              </View>

              {/* Name of Party Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                  Name of Party *
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
                  value={editFormData.name_of_party}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, name_of_party: text }))}
                  placeholder="Enter Name of Party"
                />
              </View>

              {/* Description Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                  Description of Material *
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
                  value={editFormData.description_of_material}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, description_of_material: text }))}
                  multiline
                  numberOfLines={3}
                  placeholder="Enter Description of Material"
                />
              </View>

              {/* Quantity Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                  Quantity *
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
                  value={editFormData.quantity}
                  onChangeText={(text) => setEditFormData(prev => ({ ...prev, quantity: text }))}
                  placeholder="Enter Quantity"
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
                onPress={closeEditModal}
                disabled={isSubmittingEdit}
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
                  backgroundColor: '#28a745',
                  paddingVertical: 16,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: isSubmittingEdit ? 0.7 : 1,
                }}
                onPress={handleEditSubmit}
                disabled={isSubmittingEdit}
              >
                {isSubmittingEdit ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 16,
                  }}>
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default RMInsightsTab;