// app/security/components/SecurityInsightsTab.js - ENHANCED WITH DOCUMENT ASSIGNMENT AND PAGINATION
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateField from '../../../components/ui/DateField';
import KpiCard from '../../../components/ui/KpiCard';
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

const SecurityInsightsTab = () => {
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

  // Date filter states (pickers handled by the shared DateField component)
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());

  // Page-number input draft (committed on submit/blur — typing "12" must not
  // jump to page 1 first)
  const [pageInputValue, setPageInputValue] = useState('1');

  // Vehicle filter state
  const [vehicleFilter, setVehicleFilter] = useState('');

  // ✅ Admin filters (merged from the retired Admin Insights screen).
  // IT Admin: free warehouse + site filters. Security Admin: locked to own
  // warehouse (server enforces this too). Guards: no filters (implicit).
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');

  const userRoles = userData?.roles || [];
  const isITAdmin = userRoles.includes('itadmin');
  const isAdminViewer = isITAdmin; // Security Admin removed 14 Jul 2026

  // Load initial data.
  // ✅ FIX: user data must load BEFORE the first movements fetch — previously
  // both ran in parallel, so the first request always went out with
  // warehouse_code: null and showed unfiltered data.
  useEffect(() => {
    (async () => {
      const user = await loadUserData();
      loadMovements(user);
      loadEditStatistics();
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

  const loadEditStatistics = async () => {
    try {
      const stats = await insightsAPI.getEditStatistics();
      setEditStatistics(stats);
    } catch (error) {
      console.log('Error loading edit statistics:', error);
    }
  };

  const loadMovements = async (user = userData) => {
    setLoading(true);
    try {
      const roles = user?.roles || [];
      const itadmin = roles.includes('itadmin');
      const filter = {
        from_date: formatDateForAPI(fromDate),
        to_date: formatDateForAPI(toDate),
        // IT Admin: optional free warehouse filter (empty = all warehouses).
        // Everyone else: own warehouse (backend enforces this regardless).
        warehouse_code: itadmin
          ? (warehouseFilter.trim().toUpperCase() || null)
          : (user?.warehouseCode || null),
        site_code: itadmin ? (siteFilter.trim().toUpperCase() || null) : null,
        vehicle_no: vehicleFilter.trim() || null,
        movement_type: null
      };

      const response = await insightsAPI.getFilteredMovements(filter);

      const sortedMovements = editStatusUtils.sortByEditPriority(response.results || []);
      setMovements(sortedMovements);
      setCurrentPage(1);
      setPageInputValue('1');

    } catch (error) {
      console.log('Error loading movements:', error);
      showAlert('Error', handleAPIError(error));
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and reload data
  const handleApplyFilters = () => {
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
  const setPage = (page) => {
    const clamped = Math.max(1, Math.min(page, Math.max(totalPages, 1)));
    setCurrentPage(clamped);
    setPageInputValue(String(clamped));
  };
  const goToFirstPage = () => setPage(1);
  const goToPreviousPage = () => setPage(currentPage - 1);
  const goToNextPage = () => setPage(currentPage + 1);
  const goToLastPage = () => setPage(totalPages);
  const commitPageInput = () => {
    const page = parseInt(pageInputValue, 10);
    setPage(Number.isNaN(page) ? currentPage : page);
  };

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
      const response = await gateAPI.getUnassignedDocuments(vehicleNo, 48); // 48 hour window
      setAvailableDocuments(response.documents || []);
      // ✅ FIX: no popup on top of the just-opened modal — the modal's own
      // empty state now explains the zero-documents case.
    } catch (error) {
      console.log('Error loading available documents:', error);
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
        `Document ${selectedDocument.document_no} assigned successfully!\n\nGate Entry: ${response.gate_entry_no}`,
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
      console.log('Error assigning document:', error);
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
      
      // const gateInCount = movements.filter(m => m.movement_type === 'Gate-In').length;
      // const gateOutCount = movements.filter(m => m.movement_type === 'Gate-Out').length;
      const uniqueGateInEntries = new Set();
      const uniqueGateOutEntries = new Set();

      for (const m of movements) {
        if (m.movement_type === 'Gate-In') {
          uniqueGateInEntries.add(m.gate_entry_no);
        } else if (m.movement_type === 'Gate-Out') {
          uniqueGateOutEntries.add(m.gate_entry_no);
        }
      }

      const gateInCount = uniqueGateInEntries.size;
      const gateOutCount = uniqueGateOutEntries.size;

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

  // ✅ CSV export (admins only, web) — replaces the retired Admin Insights
  // download. Exports the CURRENT filtered movement list.
  const handleDownloadCSV = () => {
    if (Platform.OS !== 'web') {
      showAlert('Download', 'CSV export is available on the web version.');
      return;
    }
    const header = ['Gate Entry No', 'Vehicle No', 'Movement', 'Date', 'Time',
      'Document Type', 'Document No', 'Driver Name', 'KM Reading',
      'Loader Count', 'Loader Names', 'Warehouse', 'Site', 'Security Guard',
      'Edit Count', 'Remarks'];
    const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = movements.map((m) => [
      m.gate_entry_no, m.vehicle_no, m.movement_type, m.date, m.time,
      m.document_type, m.document_no, m.driver_name, m.km_reading,
      m.loader_count, m.loader_names, m.to_warehouse_code, m.site_code,
      m.security_name, m.edit_count || 0, m.remarks,
    ].map(escapeCell).join(','));
    const csv = [header.map(escapeCell).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fg_movements_${formatDateForAPI(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
  };

  // Render 3-color edit button
  const renderEditButton = (record) => {
    // ✅ Admins are view-only on this dashboard — no operational edits
    if (isAdminViewer) {
      return (
        <Text style={{ fontSize: 11, color: '#9FB3A7', textAlign: 'center' }}>
          View only
        </Text>
      );
    }
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

    // ✅ Admins are view-only — show status text instead of the picker
    if (isAdminViewer) {
      return (
        <Text style={[styles.tableCell, styles.expiredAssignmentText]}>
          Not assigned
        </Text>
      );
    }

    return (
      <TouchableOpacity
        style={styles.assignmentDropdownButton}
        onPress={() => openDocumentAssignment(record)}
      >
        <Text style={styles.assignmentDropdownText}>
          Select Document
        </Text>
      </TouchableOpacity>
    );
  };

  // NEW: Render assignment action button
  const renderAssignmentActionButton = (record) => {
    // ✅ Admins are view-only — no document assignment
    if (isAdminViewer) {
      return (
        <View style={[styles.tableCell, styles.colAssignmentActions]}>
          <Text style={{ fontSize: 11, color: '#9FB3A7', textAlign: 'center' }}>
            View only
          </Text>
        </View>
      );
    }
    const needsAssignment = documentAssignmentUtils.needsDocumentAssignment(record);
    const canAssign = documentAssignmentUtils.canAssignDocument(record);
    
    if (!needsAssignment) {
      return (
        <View style={[styles.tableCell, styles.colAssignmentActions]}>
          <Text style={styles.assignedStatusText}>Assigned</Text>
        </View>
      );
    }
    
    if (!canAssign) {
      return (
        <View style={[styles.tableCell, styles.colAssignmentActions]}>
          <Text style={styles.expiredStatusText}>Expired</Text>
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
            Assign
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
    <ScrollView contentContainerStyle={styles.container}  nestedScrollEnabled={true}>
      {/* Card Container */}
      <View style={styles.card}>
        
        {/* ✅ KPI cards (redesign): 4 cards instead of 7. White surfaces with
            tinted icon chips; the ONLY colored card is "Need completion"
            when its count demands action. Total Movements (= in + out) and
            Assigned (= total - pending) were derivable noise — removed. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
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
            label="Need completion"
            value={stats.needsCompletion}
            icon="warning"
            emphasized={stats.needsCompletion > 0}
            tint="#F1EFE8"
            iconColor="#5F5E5A"
          />
          <KpiCard
            label="Pending assignment"
            value={stats.pendingAssignment}
            icon="assignment"
            tint="#EEEDFE"
            iconColor="#534AB7"
          />
        </View>
        
        {/* Enhanced Filters */}
        <View style={styles.filters}>
          {/* From Date — shared DateField component */}
          <View style={styles.filterItem}>
            <DateField
              label="From Date"
              value={fromDate}
              onChange={setFromDate}
            />
          </View>

          {/* To Date — shared DateField component */}
          <View style={styles.filterItem}>
            <DateField
              label="To Date"
              value={toDate}
              onChange={setToDate}
            />
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
            <Text style={[styles.summaryValue, {color: '#00A651'}]}>
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
        <ScrollView horizontal style={styles.tableScrollContainer} showsHorizontalScrollIndicator={true} nestedScrollEnabled={false}>
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
              <Text style={[styles.tableHeaderCell, styles.colLoaderCount]}>Loader Count</Text>  {/* ✅ ADD */}
              <Text style={[styles.tableHeaderCell, styles.colLoaderNames]}>Loader Names</Text>
              
              <Text style={[styles.tableHeaderCell, styles.colWarehouse]}>To Warehouse</Text>              <Text style={[styles.tableHeaderCell, styles.colSecurity]}>Security Guard</Text>
              <Text style={[styles.tableHeaderCell, styles.colEditCount]}>Edit Count</Text>
              <Text style={[styles.tableHeaderCell, styles.colTimeRemaining]}>Time Remaining</Text>
              
              {/* Action Columns */}
              <Text style={[styles.tableHeaderCell, styles.colOperationalActions]}>Operational Edit</Text>
              <Text style={[styles.tableHeaderCell, styles.colAssignmentActions]}>Document Action</Text>
            </View>

            {/* Table Rows - Using currentMovements for pagination */}
            <ScrollView style={[styles.tableDataContainer, { height: 500 }]} showsVerticalScrollIndicator={true} nestedScrollEnabled={true} scrollEnabled={true} removeClippedSubviews={false} contentContainerStyle={{ flexGrow: 1 }}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#00A651" />
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
                                            {/* ✅ ADD: Loader Count Cell */}
                      <View style={[styles.tableCell, styles.colLoaderCount]}>
                        <Text style={styles.tableCell}>
                          {movement.loader_count ?? '--'}
                        </Text>
                      </View>
                      
                      <View style={[styles.tableCell, styles.colLoaderNames]}>
                        {renderOperationalCell(movement, 'loader_names')}
                      </View>
                      
                      <Text style={[styles.tableCell, styles.colWarehouse]}>{movement.to_warehouse_code || movement.warehouse_code || '--'}</Text>
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

        {/* NEW: Pagination Controls (MaterialIcons, 48dp targets, draft page input) */}
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
              value={pageInputValue}
              onChangeText={setPageInputValue}
              onBlur={commitPageInput}
              onSubmitEditing={commitPageInput}
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

        {/* ✅ Admin-only CSV export of the current filtered list */}
        {isAdminViewer && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
            <TouchableOpacity
              onPress={handleDownloadCSV}
              disabled={movements.length === 0}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: movements.length === 0 ? '#ccc' : '#00A651',
                minHeight: 48, paddingHorizontal: 20, borderRadius: 8,
              }}
              accessibilityRole="button"
              accessibilityLabel="Download CSV"
            >
              <MaterialIcons name="download" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                Download CSV
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
              Assign Document to Manual Entry
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
              Available Documents (Last 48 Hours):
            </Text>
            
            {loadingDocuments ? (
              <View style={styles.assignmentLoadingContainer}>
                <ActivityIndicator size="large" color="#00A651" />
                <Text>Loading available documents...</Text>
              </View>
            ) : availableDocuments.length === 0 ? (
              <View style={styles.noDocumentsContainer}>
                <Text style={styles.noDocumentsText}>
                  No unassigned documents found for this vehicle in the last
                  48 hours. Documents may not have synced yet — try Refresh,
                  or contact your admin to trigger a manual sync.
                </Text>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={() => loadAvailableDocuments(assigningRecord?.vehicle_no)}
                >
                  <Text style={styles.refreshButtonText}>Refresh</Text>
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
                      {doc.document_no}
                    </Text>
                    <Text style={styles.documentOptionDetails}>
                      Type: {doc.document_type} | Date: {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : 'N/A'}
                    </Text>
                    <Text style={styles.documentOptionDetails}>
                      Customer: {doc.customer_name || 'N/A'} | Qty: {doc.total_quantity || 'N/A'}
                    </Text>
                    {doc.age_hours && (
                      <Text style={styles.documentOptionAge}>
                        {Math.round(doc.age_hours * 10) / 10} hours ago
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