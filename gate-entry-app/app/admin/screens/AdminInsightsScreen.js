import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { adminAPI, rmAPI, insightsAPI } from '../../../services/api';
import styles from '../styles/AdminInsightsStyle';
import { getCurrentUser } from '../../../utils/jwtUtils';
import { showAlert } from '../../../utils/customModal';

const formatDateForAPI = (date) => {
  if (!date) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const AdminInsightsScreen = () => {
  const [insightType, setInsightType] = useState('FG');
  
  const getDefaultDateRange = () => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    return {
      fromDate: lastWeek,
      toDate: today
    };
  };

  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.fromDate);
  const [toDate, setToDate] = useState(defaultDates.toDate);
  
  const [siteCode, setSiteCode] = useState('');
  const [whCode, setWhCode] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseSearchText, setWarehouseSearchText] = useState('');
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);

  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  const clearWarehouseSelection = () => {
    setWhCode('');
    setSiteCode('');
    setWarehouseSearchText('');
    setShowWarehouseDropdown(false);
    setFilteredWarehouses([]);
  };

  const selectWarehouse = (warehouse) => {
    setWhCode(warehouse.warehouse_code);
    setSiteCode(warehouse.site_code);
    setWarehouseSearchText(warehouse.warehouse_code);
    setShowWarehouseDropdown(false);
    setFilteredWarehouses([]);
    console.log("Selected warehouse:", warehouse);
    console.log("Set whCode to:", warehouse.warehouse_code);
    console.log("Set siteCode to:", warehouse.site_code);
  };

 useEffect(() => {
  const fetchUser = async () => {
    const u = await getCurrentUser();
    if (!u) {
      showAlert("Error", "User not logged in");
      return;
    }
    u.role = u.role?.toLowerCase().replace(/\s+/g, "");
    console.log("Current user loaded:", u);
    setUser(u);
    
    // Auto-fill for Security Admin
    const roleNormalized = u.role?.toLowerCase().replace(/\s+/g, "");
    if (roleNormalized.includes("securityadmin") && !roleNormalized.includes("itadmin")) {
      // Pre-fill warehouse and site for Security Admin
      if (u.warehouse_code) {
        setWhCode(u.warehouse_code);
        setWarehouseSearchText(u.warehouse_code);
      }
      if (u.site_code) {
        setSiteCode(u.site_code);
      }
    }
  };
  fetchUser();
  loadWarehouses();
}, []);

// Also load data automatically after user and dates are set
useEffect(() => {
  if (user && fromDate && toDate) {
    loadDashboardStats();
    // Auto-load data on first load
    handleShowResults();
  }
}, [user, fromDate, toDate]);

  const loadWarehouses = async () => {
    try {
      const warehouseData = await adminAPI.getWarehouses();
      setWarehouses(warehouseData);
      console.log("Warehouses loaded:", warehouseData.length);
    } catch (error) {
      console.error('Error loading warehouses:', error);
      showAlert('Error', 'Failed to load warehouse data');
    }
  };

  const handleWarehouseCodeChange = (text) => {
    console.log("🔍 handleWarehouseCodeChange called with:", text);
    
    setWarehouseSearchText(text);
    
    if (!text.trim()) {
      console.log("➡️ Empty text, clearing everything");
      setWhCode('');  // Clear whCode when text is empty
      setSiteCode('');
      setFilteredWarehouses([]);
      setShowWarehouseDropdown(false);
      return;
    }

    // Don't set whCode here - only set it when a warehouse is actually selected
    const searchTerm = text.toLowerCase();
    console.log("🔎 Search term:", searchTerm);
    
    const filtered = warehouses.filter((warehouse) => {
      const code = warehouse.warehouse_code?.toLowerCase() || '';
      const name = warehouse.warehouse_name?.toLowerCase() || '';
      return code.includes(searchTerm) || name.includes(searchTerm);
    });

    console.log("✅ Filtered results count:", filtered.length);
    if (filtered.length > 0) {
      console.log("📋 First 3 filtered warehouses:", filtered.slice(0, 3));
    }
    
    setFilteredWarehouses(filtered);
    setShowWarehouseDropdown(filtered.length > 0);
  };

  const loadDashboardStats = async () => {
    try {
      if (insightType === 'FG') {
        const filters = {
          site_code: siteCode || null,
          warehouse_code: whCode || null,
          from_date: formatDateForAPI(fromDate),
          to_date: formatDateForAPI(toDate)
        };
        const statsData = await adminAPI.getAdminDashboardStats(filters);
        setStats(statsData);
      } else {
        const filters = {
          site_code: siteCode || null,
          warehouse_code: whCode || null,
          from_date: formatDateForAPI(fromDate),
          to_date: formatDateForAPI(toDate)
        };
        const rmStats = await adminAPI.getAdminRMStatistics(filters);
        setStats(rmStats);
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const handleShowResults = async () => {
    if (!fromDate || !toDate) {
      showAlert('Error', 'Please select both from and to dates');
      return;
    }

    // Clear previous results first
    setInsights(null);  // Add this line to clear old data

    // Log the current filter values
    console.log('=== FILTER VALUES BEFORE API CALL ===');
    console.log('whCode:', whCode);
    console.log('siteCode:', siteCode);
    console.log('warehouseSearchText:', warehouseSearchText);
    console.log('fromDate:', formatDateForAPI(fromDate));
    console.log('toDate:', formatDateForAPI(toDate));

    setLoading(true);
    try {
      if (insightType === 'FG') {
        const filters = {
          from_date: formatDateForAPI(fromDate),
          to_date: formatDateForAPI(toDate),
          warehouse_code: whCode && whCode.trim() !== '' ? whCode : null,
          site_code: siteCode && siteCode.trim() !== '' ? siteCode : null,
          vehicle_no: null,
          movement_type: null
        };
        
        console.log('✅ FG Filters being sent to API:', JSON.stringify(filters, null, 2));
        
        const data = await insightsAPI.getFilteredMovements(filters);
        console.log('✅ Full API response:', data);
        console.log('✅ First record warehouse_code:', data.results[0]?.warehouse_code || data.results[0]?.to_warehouse_code);
        console.log('✅ Results received:', data.count, 'records');
        setInsights(data);

        await loadDashboardStats();

      } else {
        const filters = {
          from_date: formatDateForAPI(fromDate),
          to_date: formatDateForAPI(toDate),
          warehouse_code: whCode && whCode.trim() !== '' ? whCode : null,
          site_code: siteCode && siteCode.trim() !== '' ? siteCode : null,
          vehicle_no: null,
          movement_type: null
        };
        
        console.log('✅ RM Filters being sent to API:', JSON.stringify(filters, null, 2));
        const data = await rmAPI.getFilteredRMEntries(filters);
        console.log('✅ Results received:', data.count, 'records');
        setInsights(data);
        await loadDashboardStats();

      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      showAlert('Error', `Failed to load insights data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInsightTypeChange = (type) => {
    setInsightType(type);
    setInsights(null);
    setTimeout(() => {
      loadDashboardStats();
    }, 100);
  };

  const renderDatePicker = (value, onChange, show, setShow, label) => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="date"
          value={value.toISOString().split('T')[0]}
          onChange={(e) => {
            const newDate = new Date(e.target.value);
            onChange(null, newDate);
          }}
          style={{
            borderWidth: 1,
            borderColor: '#aaa',
            padding: 5,
            borderRadius: 4,
            backgroundColor: 'white',
            fontSize: 14,
            width: '90%',
            minHeight: 15,
          }}
        />
      );
    }
    
    return (
      <>
        <TouchableOpacity 
          style={styles.datePickerButton}
          onPress={() => setShow(true)}
        >
          <Text style={styles.datePickerText}>
            {formatDateForAPI(value)}
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

  if (user) {
    const roleNormalized = user.role?.toLowerCase().replace(/\s+/g, "");
    if (!roleNormalized.includes("securityadmin") && !roleNormalized.includes("itadmin")) {
      return (
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "red" }}>
            Access Denied - You don't have permission to view Admin Insights
          </Text>
        </View>
      );
    }
  }

  const renderStats = () => {
    if (!stats) return null;

    if (insightType === 'FG') {
      return (
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{(stats.today?.gate_in || 0) + (stats.today?.gate_out || 0)}</Text>
            <Text>Today's Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.unique_vehicles || 0}</Text>
            <Text>Unique Vehicles</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.today?.gate_in || stats.gate_in || 0}</Text>
            <Text>Gate-In</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.today?.gate_out || stats.gate_out || 0}</Text>
            <Text>Gate-Out</Text>
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.total_entries || 0}</Text>
            <Text>Total RM Entries</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.gate_in_count || 0}</Text>
            <Text>RM Gate-In</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.gate_out_count || 0}</Text>
            <Text>RM Gate-Out</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.unique_vehicles || 0}</Text>
            <Text>Unique Vehicles</Text>
          </View>
        </View>
      );
    }
  };

  const renderInsightTable = () => {
    if (!insights) return null;

    if (insightType === 'FG') {
      return renderFGTable();
    } else {
      return renderRMTable();
    }
  };

  const renderFGTable = () => (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>FG Vehicle Movement Records ({insights.count})</Text>
      
      <ScrollView horizontal>
        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.headerCell}>Date</Text>
            <Text style={styles.headerCell}>Time</Text>
            <Text style={styles.headerCell}>Gate Entry No</Text>
            <Text style={styles.headerCell}>Vehicle No</Text>
            <Text style={styles.headerCell}>Document Type</Text>
            <Text style={styles.headerCell}>Movement Type</Text>
            <Text style={styles.headerCell}>Warehouse</Text>
            <Text style={styles.headerCell}>Security Guard</Text>
            <Text style={styles.headerCell}>Remarks</Text>
            <Text style={styles.headerCell}>Document Date</Text>
            <Text style={styles.headerCell}>Document Age</Text>
            <Text style={styles.headerCell}>Driver Name</Text>
            <Text style={styles.headerCell}>KM Reading</Text>
            <Text style={styles.headerCell}>Loader Names</Text>
          </View>

          {insights.results.map((movement, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.cell}>{movement.date}</Text>
              <Text style={styles.cell}>{movement.time}</Text>
              <Text style={styles.cell}>{movement.gate_entry_no}</Text>
              <Text style={styles.cell}>{movement.vehicle_no}</Text>
              <Text style={styles.cell}>{movement.document_type}</Text>
              <Text style={styles.cell}>{movement.movement_type}</Text>
              <Text style={styles.cell}> {movement.warehouse_name  || movement.warehouse_code 
              || movement.to_warehouse_code || movement.from_warehouse_code || '--'}</Text>
              
              <Text style={styles.cell}>{movement.security_name}</Text>
              <Text style={styles.cell}>{movement.remarks}</Text>
              <Text style={styles.cell}>
                {movement.document_date 
                  ? new Date(movement.document_date).toLocaleDateString()
                  : '--'
                }
              </Text>
              <Text style={styles.cell}>{movement.document_age_time || '--'}</Text>
              <Text style={styles.cell}>{movement.driver_name || '--'}</Text>
              <Text style={styles.cell}>{movement.km_reading || '--'}</Text>
              <Text style={styles.cell}>{movement.loader_names || '--'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderRMTable = () => (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>RM Movement Records ({insights.count})</Text>
      
      <ScrollView horizontal>
        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.headerCell}>Gate Entry No</Text>
            <Text style={styles.headerCell}>Gate Type</Text>
            <Text style={styles.headerCell}>Vehicle No</Text>
            <Text style={styles.headerCell}>Document No</Text>
            <Text style={styles.headerCell}>Name of Party</Text>
            <Text style={styles.headerCell}>Description</Text>
            <Text style={styles.headerCell}>Quantity</Text>
            <Text style={styles.headerCell}>Date</Text>
            <Text style={styles.headerCell}>Time</Text>
            <Text style={styles.headerCell}>Security Guard</Text>
            <Text style={styles.headerCell}>Edit Count</Text>
            <Text style={styles.headerCell}>Time Remaining</Text>
          </View>

          {insights.results.map((entry, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.cell}>{entry.gate_entry_no}</Text>
              <Text style={styles.cell}>{entry.gate_type}</Text>
              <Text style={styles.cell}>{entry.vehicle_no}</Text>
              <Text style={styles.cell}>{entry.document_no}</Text>
              <Text style={styles.cell}>{entry.name_of_party}</Text>
              <Text style={styles.cell} numberOfLines={2}>{entry.description_of_material}</Text>
              <Text style={styles.cell}>{entry.quantity}</Text>
              <Text style={styles.cell}>
                {new Date(entry.date_time).toLocaleDateString()}
              </Text>
              <Text style={styles.cell}>
                {new Date(entry.date_time).toLocaleTimeString()}
              </Text>
              <Text style={styles.cell}>{entry.security_name}</Text>
              <Text style={styles.cell}>{entry.edit_count || 0}</Text>
              <Text style={styles.cell}>{entry.time_remaining || 'Expired'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        
        {/* Insight Type Toggle */}
        <View style={styles.insightTypeContainer}>
          <Text style={styles.insightTypeLabel}>Insight Type:</Text>
          <View style={styles.insightTypeRow}>
            {['FG', 'RM'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.insightTypeButton,
                  insightType === type && styles.insightTypeButtonActive
                ]}
                onPress={() => handleInsightTypeChange(type)}
                disabled={loading}
              >
                <Text style={[
                  styles.insightTypeButtonText,
                  insightType === type && styles.insightTypeButtonTextActive
                ]}>
                  {type} Insights
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {insightType === 'FG' ? 'FG Vehicle Movements' : 'Raw Materials Movements'}
        </Text>

        {/* Filter Inputs - WITH OVERFLOW VISIBLE */}
        <View style={[styles.inputRow, { overflow: 'visible', zIndex: 1000 }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ overflow: 'visible' }}
            contentContainerStyle={{ overflow: 'visible' }}
          >
            <View style={[styles.inputInline, { overflow: 'visible' }]}>
              {/* From Date */}
              <View style={styles.inputBox}>
                <Text>From Date</Text>
                {renderDatePicker(
                  fromDate,
                  onFromDateChange,
                  showFromDatePicker,
                  setShowFromDatePicker,
                  'From Date'
                )}
              </View>

              {/* To Date */}
              <View style={styles.inputBox}>
                <Text>To Date</Text>
                {renderDatePicker(
                  toDate,
                  onToDateChange,
                  showToDatePicker,
                  setShowToDatePicker,
                  'To Date'
                )}
              </View>
              
{/* Warehouse Code Input - Updated Version */}
<View style={[styles.inputBox, { zIndex: 9999 }]}>
  <Text>Warehouse Code</Text>
 <TextInput
  style={[
    styles.input, 
    user?.role?.toLowerCase().includes("securityadmin") && styles.inputReadOnly
  ]}
  value={warehouseSearchText}
  placeholder={user?.role?.toLowerCase().includes("securityadmin") ? "Auto-filled" : "Type to search..."}
  onChangeText={user?.role?.toLowerCase().includes("securityadmin") ? undefined : handleWarehouseCodeChange}
  editable={!user?.role?.toLowerCase().includes("securityadmin")}
  selectTextOnFocus={!user?.role?.toLowerCase().includes("securityadmin")}
  autoCapitalize="characters"
/>


  {/* Clear Button - Only show for non-Security Admin */}
  {warehouseSearchText && !user?.role?.toLowerCase().includes("securityadmin") && (
    <TouchableOpacity
      style={{
        position: 'absolute',
        right: 10,
        top: '50%',
        transform: [{ translateY: -10 }],
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#999',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onPress={clearWarehouseSelection}
    >
      <Text style={{ color: 'white', fontWeight: 'bold' }}></Text>
    </TouchableOpacity>
  )}

  {/* Dropdown - Only show for non-Security Admin */}
  {!user?.role?.toLowerCase().includes("securityadmin") && showWarehouseDropdown && filteredWarehouses.length > 0 && (
    <View style={{
      position: 'absolute',
      top: 45,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 4,
      maxHeight: 200,
      zIndex: 99999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 5,
    }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        {filteredWarehouses.map((wh, index) => (
          <TouchableOpacity
            key={`${wh.warehouse_code}-${index}`}
            style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}
            onPress={() => selectWarehouse(wh)}
          >
            <Text style={{ fontWeight: 'bold', color: '#1976d2' }}>{wh.warehouse_code}</Text>
            <Text style={{ color: '#555' }}>{wh.warehouse_name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )}
</View>

 


              {/* Site Code */}
              <View style={styles.inputBox}>
                <Text>Site Code</Text>
                <TextInput 
                  style={[styles.input, siteCode && styles.inputFilled]} 
                  value={siteCode} 
                  onChangeText={setSiteCode} 
                  placeholder="Auto-filled or manual"
                  editable={true}
                />
              </View>

              <TouchableOpacity 
                style={styles.showButton} 
                onPress={handleShowResults}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.showButtonText}>Show Results</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Summary Stats */}
        {renderStats()}

        {/* Results Table */}
        {renderInsightTable()}
      </View>
    </ScrollView>
  );
};

export default AdminInsightsScreen;