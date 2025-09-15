// app/security/components/SecurityInsightsTab.js - ENHANCED WITH DOCUMENT ASSIGNMENT AND PAGINATION
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import styles from '../styles/insightsStyles';
import { 
  insightsAPI, 
  gateAPI, 
  handleAPIError, 
  editStatusUtils,
  documentAssignmentUtils,
  multiEntryHelpers
} from '../../../services/api';
import { getCurrentUser } from '../../../utils/jwtUtils';
import OperationalEditModal from './OperationalEditModal';
import { showAlert } from '@/utils/customModal';

const SecurityInsightsTab = ({ 
  insightsData, 
  onDataChange 
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState([]);
  const [userData, setUserData] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editStatistics, setEditStatistics] = useState(null);

  // NEW: Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // NEW: Document assignment states
  const [documentAssignmentModal, setDocumentAssignmentModal] = useState(false);
  const [assigningRecord, setAssigningRecord] = useState(null);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [assigningDocument, setAssigningDocument] = useState(false);

  // Date picker states
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  // Vehicle filter state
  const [vehicleFilter, setVehicleFilter] = useState('');

  // Load initial data
  useEffect(() => {
    loadUserData();
    loadMovements();
    loadEditStatistics();
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

  const loadEditStatistics = async () => {
    try {
      const stats = await insightsAPI.getEditStatistics();
      setEditStatistics(stats);
    } catch (error) {
      console.error('Error loading edit statistics:', error);
    }
  };

  // const loadMovements = async () => {
  //   setLoading(true);
  //   try {
  //     const filter = {
  //       from_date: formatDateForAPI(fromDate),
  //       to_date: formatDateForAPI(toDate),
  //       warehouse_code: userData?.warehouse_code || null,
  //       vehicle_no: vehicleFilter.trim() || null,
  //       movement_type: null
  //     };

  //     const response = await insightsAPI.getFilteredMovements(filter);
      
  //     // Sort by edit priority (Yellow -> Green -> Black)
  //     const sortedMovements = editStatusUtils.sortByEditPriority(response.results || []);
  //     setMovements(sortedMovements);
  //     setCurrentPage(1); // Reset to first page when data loads
      
  //   } catch (error) {
  //     console.error('Error loading movements:', error);
  //     const errorMessage = handleAPIError(error);
  //     showAlert('Error', `Failed to load movements: ${errorMessage}`);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const filter = {
        from_date: formatDateForAPI(fromDate),
        to_date: formatDateForAPI(toDate),
        warehouse_code: userData?.warehouse_code || null,
        vehicle_no: vehicleFilter.trim() || null,
        movement_type: null
      };

      console.log('Final filter sent to API:', filter); // Add this debug log

      const response = await insightsAPI.getFilteredMovements(filter);
      
      const sortedMovements = editStatusUtils.sortByEditPriority(response.results || []);
      setMovements(sortedMovements);
      setCurrentPage(1);
      
    } catch (error) {
      console.error('Error loading movements:', error);
      const errorMessage = handleAPIError(error);
      showAlert('Error', `Failed to load movements: ${errorMessage}`);
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

  // Apply filters and reload data
  // const handleApplyFilters = () => {
  //   loadMovements();
  //   loadEditStatistics();
  // };

  const handleApplyFilters = () => {
    console.log('Applying filters - Debug info:', {
      fromDate: fromDate,
      toDate: toDate,
      fromDateFormatted: formatDateForAPI(fromDate),
      toDateFormatted: formatDateForAPI(toDate),
      vehicleFilter: vehicleFilter,
      platform: Platform.OS
    });
    
    loadMovements();
    loadEditStatistics();
  };

  // NEW: Pagination calculations
  const totalItems = movements.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMovements = movements.slice(startIndex, endIndex);
  const startItem = totalItems > 0 ? startIndex + 1 : 0;
  const endItem = Math.min(endIndex, totalItems);

  // NEW: Pagination handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPage = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  // NEW: Open document assignment modal
  const openDocumentAssignment = async (record) => {
    setAssigningRecord(record);
    setSelectedDocument(null);
    setAvailableDocuments([]);
    setDocumentAssignmentModal(true);
    
    // Load available documents for this vehicle
    await loadAvailableDocuments(record.vehicle_no);
  };

  // NEW: Load available documents for assignment
  const loadAvailableDocuments = async (vehicleNo) => {
    setLoadingDocuments(true);
    try {
      const response = await gateAPI.getUnassignedDocuments(vehicleNo, 8); // 8 hour window
      setAvailableDocuments(response.documents || []);
      
      if (response.available_count === 0) {
        showAlert(
          'No Documents Found', 
          `No unassigned documents found for vehicle ${vehicleNo} in the last 8 hour.\n\nDocuments may not have synced yet. Please try again later or contact admin to trigger manual sync.`
        );
      }
    } catch (error) {
      console.error('Error loading available documents:', error);
      const errorMessage = handleAPIError(error);
      showAlert('Error', `Failed to load documents: ${errorMessage}`);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // NEW: Handle document assignment
  const handleDocumentAssignment = async () => {
    if (!selectedDocument || !assigningRecord) {
      showAlert('Error', 'Please select a document first');
      return;
    }

    showAlert(
      'Confirm Assignment',
      `Assign document ${selectedDocument.document_no} to this manual entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Assign', onPress: performDocumentAssignment }
      ]
    );
  };

  const performDocumentAssignment = async () => {
    setAssigningDocument(true);
    
    try {
      const assignmentData = {
        insights_id: assigningRecord.id,
        document_no: selectedDocument.document_no
      };

      const response = await gateAPI.assignDocumentToManualEntry(assignmentData);
      
      showAlert(
        'Success',
        `Document ${selectedDocument.document_no} assigned successfully!\n\nGate Entry: ${response.gate_entry_no}\nEdit Count: ${response.updated_insights.edit_count}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setDocumentAssignmentModal(false);
              loadMovements(); // Refresh the table
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error assigning document:', error);
      const errorMessage = handleAPIError(error);
      showAlert('Assignment Failed', errorMessage);
    } finally {
      setAssigningDocument(false);
    }
  };

  // Enhanced stats calculation
  // const stats = React.useMemo(() => {
  //   if (!movements || movements.length === 0) {
  //     return {
  //       totalMovements: 0,
  //       uniqueVehicles: 0,
  //       needsCompletion: 0,
  //       pendingAssignment: 0, // NEW: Count of pending document assignments
  //     };
  //   }
    
  //   const uniqueVehicles = [...new Set(movements.map(m => m.vehicle_no))].length;
  //   const needsCompletion = movements.filter(m => 
  //     editStatusUtils.getButtonConfig(m).action === 'complete_required'
  //   ).length;
  //   const pendingAssignment = movements.filter(m => 
  //     documentAssignmentUtils.needsDocumentAssignment(m)
  //   ).length;
    
  //   return {
  //     totalMovements: movements.length,
  //     uniqueVehicles,
  //     needsCompletion,
  //     pendingAssignment,
  //   };
  // }, [movements]);

        // Enhanced stats calculation with date filtering
    const stats = React.useMemo(() => {
      if (!movements || movements.length === 0) {
        return {
          gateInCount: 0,
          gateOutCount: 0,
          totalMovements: 0,
          uniqueVehicles: 0,
          needsCompletion: 0,
          pendingAssignment: 0,
          assigned: 0,
        };
      }
      
      const gateInCount = movements.filter(m => m.movement_type === 'Gate-In').length;
      const gateOutCount = movements.filter(m => m.movement_type === 'Gate-Out').length;
      const uniqueVehicles = [...new Set(movements.map(m => m.vehicle_no))].length;
      const needsCompletion = movements.filter(m => 
        editStatusUtils.getButtonConfig(m).action === 'complete_required'
      ).length;
      const pendingAssignment = movements.filter(m => 
        documentAssignmentUtils.needsDocumentAssignment(m)
      ).length;
      
      return {
        gateInCount,
        gateOutCount,
        totalMovements: movements.length,
        uniqueVehicles,
        needsCompletion,
        pendingAssignment,
        assigned: movements.length - pendingAssignment,
      };
    }, [movements]);

  // Open edit modal
  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditModalVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingRecord(null);
  };

  // Handle successful edit
  const handleEditSuccess = (response) => {
    setMovements(prevMovements => 
      prevMovements.map(movement => 
        movement.gate_entry_no === response.gate_entry_no 
          ? { ...movement, ...response.updated_data }
          : movement
      )
    );    
    loadEditStatistics();
    console.log('Edit successful:', response);
  };

  // Render 3-color edit button
  const renderEditButton = (record) => {
    const buttonConfig = editStatusUtils.getButtonConfig(record);
    
    const colorStyles = {
      yellow: styles.completeInfoButton,
      green: styles.editDetailsButton,
      black: styles.expiredButton,
      gray: styles.noAccessButton
    };
    
    const buttonStyle = colorStyles[buttonConfig.color] || styles.defaultButton;
    
    return (
      <TouchableOpacity 
        style={[styles.actionButton, buttonStyle]}
        onPress={() => buttonConfig.enabled ? openEditModal(record) : null}
        disabled={!buttonConfig.enabled}
      >
        <Text style={[
          styles.actionButtonText,
          !buttonConfig.enabled && styles.disabledButtonText
        ]}>
          {buttonConfig.text}
        </Text>
      </TouchableOpacity>
    );
  };

  // NEW: Render document assignment cell
  const renderDocumentAssignmentCell = (record) => {
    const needsAssignment = documentAssignmentUtils.needsDocumentAssignment(record);
    const canAssign = documentAssignmentUtils.canAssignDocument(record);
    
    if (!needsAssignment) {
      // Show assigned document number or document type
      const displayText = record.document_type === "Manual Entry - Pending Assignment" ? 
        "Not Assigned" : 
        (record.document_type || "Manual Entry");
      
      return (
        <Text style={[styles.tableCell, styles.assignedDocumentText]}>
          {displayText}
        </Text>
      );
    }
    
    if (!canAssign) {
      return (
        <Text style={[styles.tableCell, styles.expiredAssignmentText]}>
          Expired
        </Text>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.assignmentDropdownButton}
        onPress={() => openDocumentAssignment(record)}
      >
        <Text style={styles.assignmentDropdownText}>
          📄 Select Document
        </Text>
      </TouchableOpacity>
    );
  };

  // NEW: Render assignment action button
  const renderAssignmentActionButton = (record) => {
    const needsAssignment = documentAssignmentUtils.needsDocumentAssignment(record);
    const canAssign = documentAssignmentUtils.canAssignDocument(record);
    
    if (!needsAssignment) {
      return (
        <View style={[styles.tableCell, styles.colAssignmentActions]}>
          <Text style={styles.assignedStatusText}>✅ Assigned</Text>
        </View>
      );
    }
    
    if (!canAssign) {
      return (
        <View style={[styles.tableCell, styles.colAssignmentActions]}>
          <Text style={styles.expiredStatusText}>⚫ Expired</Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.tableCell, styles.colAssignmentActions]}>
        <TouchableOpacity 
          style={styles.assignmentActionButton}
          onPress={() => openDocumentAssignment(record)}
        >
          <Text style={styles.assignmentActionButtonText}>
            📎 Assign
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // NEW: Render document number cell
  const renderDocumentNoCell = (record) => {
    // If has document_no, show it directly (non-manual entry)
    if (record.document_no && record.document_no.trim()) {
      return (
        <Text style={[styles.tableCell, styles.assignedDocumentText]}>
          {record.document_no}
        </Text>
      );
    }
    
    // Otherwise, show assignment functionality (manual entry)
    return renderDocumentAssignmentCell(record);
  };

  // Render operational data cell
  const renderOperationalCell = (record, field) => {
    const value = record[field];
    const hasValue = value && value.trim();
    const buttonConfig = editStatusUtils.getButtonConfig(record);
    const isRequired = buttonConfig?.missing_fields?.includes(field.replace('_', ' '));
    
    return (
      <Text style={[
        styles.tableCell,
        hasValue ? styles.completeField : styles.incompleteField,
        isRequired && styles.requiredField
      ]}>
        {hasValue ? value : (isRequired ? '⚠️ Required' : '--')}
      </Text>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Card Container */}
      <View style={styles.card}>
        
        {/* UPDATED: 4x1 Stats Cards with document assignment tracking */}
       {/* UPDATED: 7 Stats Cards for FG Insights */}
    <View style={styles.statsCardsContainer}>
      <View style={styles.statsRowContainer}>
        <View style={[styles.statCard, { backgroundColor: '#28a745' }]}>
          <Text style={styles.statNumber}>{stats.gateInCount}</Text>
          <Text style={styles.statLabel}>Gate In</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dc3545' }]}>
          <Text style={styles.statNumber}>{stats.gateOutCount}</Text>
          <Text style={styles.statLabel}>Gate Out</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalMovements}</Text>
          <Text style={styles.statLabel}>Total Movements</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#17a2b8' }]}>
          <Text style={styles.statNumber}>{stats.uniqueVehicles}</Text>
          <Text style={styles.statLabel}>Unique Vehicles</Text>
        </View>
      </View>
      <View style={styles.statsRowContainer}>
        <View style={[styles.statCard, { backgroundColor: '#ffc107' }]}>
          <Text style={styles.statNumber}>{stats.needsCompletion}</Text>
          <Text style={styles.statLabel}>Need Completion</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#6f42c1' }]}>
          <Text style={styles.statNumber}>{stats.pendingAssignment}</Text>
          <Text style={styles.statLabel}>Pending Assignment</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#20c997' }]}>
          <Text style={styles.statNumber}>{stats.assigned}</Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
      </View>
    </View>
        
        {/* Enhanced Filters */}
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

        {/* NEW: Operational summary stats */}
        <View style={styles.operationalSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Completion Rate:</Text>
            <Text style={[styles.summaryValue, {color: '#28a745'}]}>
              {editStatistics ? `${editStatistics.completion_percentage}%` : '--'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg Edits:</Text>
            <Text style={styles.summaryValue}>
              {editStatistics?.avg_edits_per_record || 0}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Edited Today:</Text>
            <Text style={[styles.summaryValue, {color: '#007bff'}]}>
              {editStatistics?.edited_today || 0}
            </Text>
          </View>
        </View>

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Gate Movements & Document Assignment</Text>

        {/* NEW: Pagination Info */}
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            {startItem} to {endItem} of {totalItems}
          </Text>
          <Text style={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>

        {/* ENHANCED: Table with Document Assignment Columns and Pagination */}
        <ScrollView horizontal style={styles.tableScrollContainer} showsHorizontalScrollIndicator={true}>
          <View style={styles.tableContainer}>
            
            {/* Table Header - UPDATED with assignment columns */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colGateEntry]}>Gate Entry No</Text>
              <Text style={[styles.tableHeaderCell, styles.colVehicle]}>Vehicle No</Text>
              <Text style={[styles.tableHeaderCell, styles.colMovement]}>Movement</Text>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.colTime]}>Time</Text>
              <Text style={[styles.tableHeaderCell, styles.colDocumentType]}>Document Type</Text>
              <Text style={[styles.tableHeaderCell, styles.colDocumentNo]}>Document No</Text>
              
              {/* Operational Data Columns */}
              <Text style={[styles.tableHeaderCell, styles.colDriverName]}>Driver Name</Text>
              <Text style={[styles.tableHeaderCell, styles.colKMReading]}>KM Reading</Text>
              <Text style={[styles.tableHeaderCell, styles.colLoaderNames]}>Loader Names</Text>
              
              <Text style={[styles.tableHeaderCell, styles.colWarehouse]}>Warehouse</Text>
              <Text style={[styles.tableHeaderCell, styles.colSecurity]}>Security Guard</Text>
              <Text style={[styles.tableHeaderCell, styles.colEditCount]}>Edit Count</Text>
              <Text style={[styles.tableHeaderCell, styles.colTimeRemaining]}>Time Remaining</Text>
              
              {/* Action Columns */}
              <Text style={[styles.tableHeaderCell, styles.colOperationalActions]}>Operational Edit</Text>
              <Text style={[styles.tableHeaderCell, styles.colAssignmentActions]}>Document Action</Text>
            </View>

            {/* Table Rows - Using currentMovements for pagination */}
            <ScrollView style={[styles.tableDataContainer, { height: 500 }]} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007bff" />
                  <Text style={styles.loadingText}>Loading movements...</Text>
                </View>
              ) : currentMovements.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No movements found for the selected filters</Text>
                </View>
              ) : (
                currentMovements.map((movement, index) => {
                  const buttonConfig = editStatusUtils.getButtonConfig(movement);
                  const needsAssignment = documentAssignmentUtils.needsDocumentAssignment(movement);
                  const actualIndex = startIndex + index;
                  
                  return (
                    <View key={movement.id || actualIndex} style={[
                      styles.tableRow,
                      actualIndex % 2 === 0 ? styles.evenRow : styles.oddRow,
                      buttonConfig.priority === 'high' && styles.highPriorityRow,
                      needsAssignment && styles.pendingAssignmentRow
                    ]}>
                      <Text style={[styles.tableCell, styles.colGateEntry]}>{movement.gate_entry_no}</Text>
                      <Text style={[styles.tableCell, styles.colVehicle]}>{movement.vehicle_no || '--'}</Text>
                      <Text style={[styles.tableCell, styles.colMovement]}>{movement.movement_type}</Text>
                      <Text style={[styles.tableCell, styles.colDate]}>
                        {formatDateToDDMMYYYY(new Date(movement.date))}
                      </Text>
                      <Text style={[styles.tableCell, styles.colTime]}>{movement.time}</Text>

                      {/* NEW: Document Type Cell */}
                      <Text style={[styles.tableCell, styles.colDocumentType]}>
                        {movement.document_type || '--'}
                      </Text>

                      {/* UPDATED: Document No Cell */}
                      <View style={[styles.tableCell, styles.colDocumentNo]}>
                        {renderDocumentNoCell(movement)}
                      </View>
                      
                      {/* Operational Data Cells */}
                      <View style={[styles.tableCell, styles.colDriverName]}>
                        {renderOperationalCell(movement, 'driver_name')}
                      </View>
                      <View style={[styles.tableCell, styles.colKMReading]}>
                        {renderOperationalCell(movement, 'km_reading')}
                      </View>
                      <View style={[styles.tableCell, styles.colLoaderNames]}>
                        {renderOperationalCell(movement, 'loader_names')}
                      </View>
                      
                      <Text style={[styles.tableCell, styles.colWarehouse]}>{movement.warehouse_name}</Text>
                      <Text style={[styles.tableCell, styles.colSecurity]}>{movement.security_name}</Text>
                      
                      {/* Edit count */}
                      <Text style={[
                        styles.tableCell, 
                        styles.colEditCount,
                        movement.edit_count > 0 ? { color: '#28a745', fontWeight: 'bold' } : { color: '#6c757d' }
                      ]}>
                        {movement.edit_count || 0}
                      </Text>
                      
                      {/* Time remaining */}
                      <Text style={[
                        styles.tableCell, 
                        styles.colTimeRemaining,
                        buttonConfig.priority === 'high' ? { color: '#dc3545', fontWeight: 'bold' } :
                        buttonConfig.priority === 'medium' ? { color: '#ffc107', fontWeight: 'bold' } :
                        { color: '#6c757d' }
                      ]}>
                        {movement.time_remaining || 'Expired'}
                      </Text>
                      
                      {/* Operational Edit Button */}
                      <View style={[styles.tableCell, styles.colOperationalActions]}>
                        {renderEditButton(movement)}
                      </View>
                      
                      {/* NEW: Document Assignment Action Button */}
                      {renderAssignmentActionButton(movement)}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </ScrollView>

        {/* NEW: Pagination Controls */}
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

      {/* Operational Edit Modal */}
      <OperationalEditModal
        visible={editModalVisible}
        record={editingRecord}
        onClose={closeEditModal}
        onSuccess={handleEditSuccess}
      />

      {/* NEW: Document Assignment Modal */}
      <Modal
        visible={documentAssignmentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDocumentAssignmentModal(false)}
      >
        <View style={styles.assignmentModalOverlay}>
          <View style={styles.assignmentModalContainer}>
            
            {/* Header */}
            <Text style={styles.assignmentModalTitle}>
              📄 Assign Document to Manual Entry
            </Text>
            
            {/* Record Info */}
            <View style={styles.assignmentRecordInfo}>
              <Text style={styles.assignmentInfoText}>
                Gate Entry: {assigningRecord?.gate_entry_no}
              </Text>
              <Text style={styles.assignmentInfoText}>
                Vehicle: {assigningRecord?.vehicle_no}
              </Text>
              <Text style={styles.assignmentInfoText}>
                Movement: {assigningRecord?.movement_type}
              </Text>
            </View>
            
            {/* Document Selection */}
            <Text style={styles.assignmentSectionTitle}>
              Available Documents (Last 8 Hour):
            </Text>
            
            {loadingDocuments ? (
              <View style={styles.assignmentLoadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text>Loading available documents...</Text>
              </View>
            ) : availableDocuments.length === 0 ? (
              <View style={styles.noDocumentsContainer}>
                <Text style={styles.noDocumentsText}>
                  No unassigned documents found for this vehicle in the last hour.
                </Text>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={() => loadAvailableDocuments(assigningRecord?.vehicle_no)}
                >
                  <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.documentsList} nestedScrollEnabled={true}>
                {availableDocuments.map((doc, index) => (
                  <TouchableOpacity
                    key={doc.document_no}
                    style={[
                      styles.documentOption,
                      selectedDocument?.document_no === doc.document_no && styles.selectedDocumentOption
                    ]}
                    onPress={() => setSelectedDocument(doc)}
                  >
                    <Text style={styles.documentOptionTitle}>
                      📄 {doc.document_no}
                    </Text>
                    <Text style={styles.documentOptionDetails}>
                      Type: {doc.document_type} | Date: {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : 'N/A'}
                    </Text>
                    <Text style={styles.documentOptionDetails}>
                      Customer: {doc.customer_name || 'N/A'} | Qty: {doc.total_quantity || 'N/A'}
                    </Text>
                    {doc.age_hours && (
                      <Text style={styles.documentOptionAge}>
                        🕒 {Math.round(doc.age_hours * 10) / 10} hours ago
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {/* Action Buttons */}
            <View style={styles.assignmentModalButtonRow}>
              <TouchableOpacity 
                style={[styles.assignmentModalButton, styles.assignmentCancelButton]}
                onPress={() => setDocumentAssignmentModal(false)}
                disabled={assigningDocument}
              >
                <Text style={styles.assignmentModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.assignmentModalButton, 
                  styles.assignmentSubmitButton,
                  (!selectedDocument || assigningDocument) && styles.assignmentButtonDisabled
                ]}
                onPress={handleDocumentAssignment}
                disabled={!selectedDocument || assigningDocument}
              >
                {assigningDocument ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.assignmentModalButtonText}>
                    Assign Document
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

export default SecurityInsightsTab;