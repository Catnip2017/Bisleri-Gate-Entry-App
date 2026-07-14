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
import { MaterialIcons } from '@expo/vector-icons';
import KpiCard from '../../../components/ui/KpiCard';
import styles from '../styles/insightsStyles';
import { getCurrentUser } from '../../../utils/jwtUtils';
import { showAlert } from '../../../utils/customModal';
import { handleAPIError } from '../../../services/api';

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

  // ✅ Admin filters (merged from the retired Admin Insights screen)
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');

  const userRoles = userData?.roles || [];
  const isITAdmin = userRoles.includes('itadmin');
  const isAdminViewer = isITAdmin; // Security Admin removed 14 Jul 2026

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    gate_entry_no: '',
    vehicle_no: '',
    document_no: '',
    name_of_party: '',
    description_of_material: '',
    quantity: ''
  });

  // Load initial data — user first, so the first fetch is correctly scoped
  useEffect(() => {
    (async () => {
      const user = await loadUserData();
      loadRMEntries(user);
      loadStatistics();
    })();
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
            // boxSizing keeps padding+border INSIDE the 100% width — without
            // it the input overflows its filterItem (max 180px) and overlaps
            // the neighbouring filter. Same fix as the shared DateField.
            boxSizing: 'border-box',
            border: '1px solid #aaa',
            padding: 10,
            borderRadius: 4,
            backgroundColor: 'white',
            fontSize: 14,
            width: '100%',
            maxWidth: '100%',
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
      return user;
    } catch (error) {
      console.log('Error loading user data:', error);
      return null;
    }
  };

  const loadStatistics = async () => {
    try {
      const { rmAPI } = await import('../../../services/api');
      const stats = await rmAPI.getRMStatistics();
      setStatistics(stats);
    } catch (error) {
      console.log('Error loading RM statistics:', error);
    }
  };

  // ✅ FIXED: Enhanced loadRMEntries with better filtering
  const loadRMEntries = async (user = userData) => {
    setLoading(true);
    try {
      const { rmAPI } = await import('../../../services/api');

      const roles = user?.roles || [];
      const itadmin = roles.includes('itadmin');
      const filter = {
        from_date: formatDateForAPI(fromDate),
        to_date: formatDateForAPI(toDate),
        // IT Admin: optional free warehouse/site filters (empty = all).
        // Everyone else: own warehouse (backend enforces this regardless).
        // (Also fixes the old userData?.warehouse_code snake_case key that
        // never existed — the filter was silently null.)
        warehouse_code: itadmin
          ? (warehouseFilter.trim().toUpperCase() || null)
          : (user?.warehouseCode || null),
        site_code: itadmin ? (siteFilter.trim().toUpperCase() || null) : null,
        vehicle_no: vehicleFilter.trim() || null,
        movement_type: null
      };

      const response = await rmAPI.getFilteredRMEntries(filter);
      setRMEntries(response.results || []);
      setCurrentPage(1); // Reset to first page when data loads
      
    } catch (error) {
      console.log('Error loading RM entries:', error);
      showAlert('Error', handleAPIError(error), [
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

    const isEmptyVehicle = isEmptyVehicleEntry(editFormData.document_no);

    // document_no is auto-generated for empty vehicle — skip validation
    if (!isEmptyVehicle && !editFormData.document_no.trim()) {
      showAlert('Error', 'Document number is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }

    if (!isEmptyVehicle && !editFormData.name_of_party.trim()) {
      showAlert('Error', 'Name of Party is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }

    if (!isEmptyVehicle && !editFormData.description_of_material.trim()) {
      showAlert('Error', 'Description of Material is required', [
        { text: 'OK', onPress: () => {} }
      ]);
      return false;
    }

    if (!isEmptyVehicle && !editFormData.quantity.trim()) {
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
      console.log('Error updating RM entry:', error);
      const errorMessage = handleAPIError(error);
      showAlert('Update Failed', errorMessage, [
        { text: 'OK', onPress: () => {} }
      ]);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Helper: detect empty vehicle entries (document_no starts with "EMPTY-")
  const isEmptyVehicleEntry = (doc_no) =>
    typeof doc_no === 'string' && doc_no.toUpperCase().startsWith('EMPTY-');

  // Render edit button
  const renderEditButton = (record) => {
    // ✅ Admins are view-only on this dashboard
    if (isAdminViewer) {
      return (
        <Text style={{ fontSize: 11, color: '#9FB3A7', textAlign: 'center' }}>
          View only
        </Text>
      );
    }
    if (!record.can_edit) {
      return (
        <TouchableOpacity style={[styles.actionButton, styles.expiredButton]} disabled>
          <Text style={styles.actionButtonText}>Expired</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        style={[styles.actionButton, styles.editDetailsButton]}
        onPress={() => openEditModal(record)}
      >
        <Text style={styles.actionButtonText}>Edit</Text>
      </TouchableOpacity>
    );
  };

  // Calculate statistics
// Calculate statistics with date filtering
const stats = React.useMemo(() => {
  if (!rmEntries || rmEntries.length === 0) {
    return {
      totalEntries: 0,
      gateInCount: 0,
      gateOutCount: 0,
      uniqueVehicles: 0
    };
  }
  
  const gateInCount = rmEntries.filter(entry => entry.gate_type === 'Gate-In').length;
  const gateOutCount = rmEntries.filter(entry => entry.gate_type === 'Gate-Out').length;
  const uniqueVehicles = [...new Set(rmEntries.map(entry => entry.vehicle_no))].length;
  
  return {
    totalEntries: rmEntries.length,
    gateInCount,
    gateOutCount,
    uniqueVehicles
  };
}, [rmEntries]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Card Container */}
      <View style={styles.card}>
        
        {/* ✅ KPI cards (redesign) — same card system as FG Insights */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <KpiCard
            label="Total RM entries"
            value={stats.totalEntries}
            icon="inventory"
            tint="#F1EFE8"
            iconColor="#5F5E5A"
          />
          <KpiCard
            label="Gate in"
            value={stats.gateInCount}
            icon="arrow-downward"
            tint="#E1F5EE"
            iconColor="#0F6E56"
          />
          <KpiCard
            label="Gate out"
            value={stats.gateOutCount}
            icon="arrow-upward"
            tint="#E0F4F9"
            iconColor="#0A6E85"
          />
          <KpiCard
            label="Unique vehicles"
            value={stats.uniqueVehicles}
            icon="local-shipping"
            tint="#EEEDFE"
            iconColor="#534AB7"
          />
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

          {/* ✅ Admin filters — IT Admin: free; Security Admin: locked to own */}
          {isAdminViewer && (
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Warehouse Code</Text>
              <TextInput
                style={styles.input}
                placeholder={isITAdmin ? 'All warehouses' : ''}
                value={isITAdmin ? warehouseFilter : (userData?.warehouseCode || '')}
                onChangeText={setWarehouseFilter}
                autoCapitalize="characters"
                editable={isITAdmin}
              />
            </View>
          )}
          {isITAdmin && (
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Site Code</Text>
              <TextInput
                style={styles.input}
                placeholder="All sites"
                value={siteFilter}
                onChangeText={setSiteFilter}
                autoCapitalize="characters"
              />
            </View>
          )}

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
                  <ActivityIndicator size="large" color="#00A651" />
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
                      {/* Document No — show badge for empty vehicle entries */}
                      <View style={[styles.tableCell, styles.colDocumentNo, { justifyContent: 'center' }]}>
                        {isEmptyVehicleEntry(entry.document_no) ? (
                          <View style={{
                            backgroundColor: '#fff3cd',
                            borderRadius: 4,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderWidth: 1,
                            borderColor: '#ffc107',
                            alignSelf: 'flex-start'
                          }}>
                            <Text style={{ color: '#856404', fontSize: 11, fontWeight: 'bold' }}>
                              EMPTY VEHICLE
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 13 }}>{entry.document_no}</Text>
                        )}
                      </View>
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

        {/* ✅ Pagination Controls (MaterialIcons, matches FG Insights) */}
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
            onPress={goToFirstPage}
            disabled={currentPage === 1}
            accessibilityLabel="First page"
          >
            <MaterialIcons name="first-page" size={22} color={currentPage === 1 ? '#adb5bd' : '#333'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
            onPress={goToPreviousPage}
            disabled={currentPage === 1}
            accessibilityLabel="Previous page"
          >
            <MaterialIcons name="chevron-left" size={22} color={currentPage === 1 ? '#adb5bd' : '#333'} />
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
              accessibilityLabel="Page number"
            />
            <Text style={styles.pageInputLabel}>of {totalPages}</Text>
          </View>

          <TouchableOpacity
            style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
            onPress={goToNextPage}
            disabled={currentPage === totalPages}
            accessibilityLabel="Next page"
          >
            <MaterialIcons name="chevron-right" size={22} color={currentPage === totalPages ? '#adb5bd' : '#333'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
            onPress={goToLastPage}
            disabled={currentPage === totalPages}
            accessibilityLabel="Last page"
          >
            <MaterialIcons name="last-page" size={22} color={currentPage === totalPages ? '#adb5bd' : '#333'} />
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
                  Document Number {isEmptyVehicleEntry(editFormData.document_no) ? '' : '*'}
                </Text>
                {isEmptyVehicleEntry(editFormData.document_no) ? (
                  /* Empty vehicle: show read-only badge — document_no is system-generated */
                  <View style={{
                    borderWidth: 2,
                    borderColor: '#ffc107',
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: '#fff3cd',
                    minHeight: 48,
                    justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#856404', fontWeight: 'bold', fontSize: 15 }}>
                      EMPTY VEHICLE (auto-generated)
                    </Text>
                  </View>
                ) : (
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
                )}
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