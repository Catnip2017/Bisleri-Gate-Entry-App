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
import { adminAPI, rmAPI } from '../../../services/api';
import styles from '../styles/AdminInsightsStyle';
import { getCurrentUser } from '../../../utils/jwtUtils';
import { showAlert } from '../../../utils/customModal';

const formatDateForAPI = (date) => {
  if (!date) return '';
  
  // Format date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const AdminInsightsScreen = () => {
  // ✅ NEW: Toggle between FG and RM insights
  const [insightType, setInsightType] = useState('FG');
  
  // ✅ UPDATED: Default to last 7 days
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
  
  // ✅ FIXED: Simple separate filters like Security Insights
  const [siteCode, setSiteCode] = useState('');
  const [whCode, setWhCode] = useState('');
  
  // Remove the complex search functionality
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);

  // ✅ NEW: Date picker states
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const u = await getCurrentUser();
      if (!u) {
        showAlert("Error", "User not logged in");
        return;
      }
      // normalize role: lowercase + remove spaces
      u.role = u.role?.toLowerCase().replace(/\s+/g, "");
      console.log("Current user loaded:", u);
      setUser(u);
    };
    fetchUser();

    loadDashboardStats();
  }, []);

  // ✅ FIXED: Simple load dashboard stats
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

  // ✅ FIXED: Simple show results function
  const handleShowResults = async () => {
    if (!fromDate || !toDate) {
      showAlert('Error', 'Please select both from and to dates');
      return;
    }

    setLoading(true);
    try {
      if (insightType === 'FG') {
        const filters = {
          from_date: formatDateForAPI(fromDate),
          to_date: formatDateForAPI(toDate),
          site_code: siteCode || null,
          warehouse_code: whCode || null,
          vehicle_no: null,
          movement_type: null
        };
        console.log('FG Filters being sent:', filters);
        const data = await adminAPI.getAdminInsights(filters);
        setInsights(data);
      } else {
        const filters = {
          from_date: formatDateForAPI(fromDate),
          to_date: formatDateForAPI(toDate),
          site_code: siteCode || null,
          warehouse_code: whCode || null,
          vehicle_no: null,
          movement_type: null
        };
        console.log('RM Filters being sent:', filters);
        const data = await rmAPI.getFilteredRMEntries(filters);
        setInsights(data);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      showAlert('Error', `Failed to load insights data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Handle insight type toggle
  const handleInsightTypeChange = (type) => {
    setInsightType(type);
    setInsights(null); // Clear current insights
    // Reload stats immediately when type changes
    setTimeout(() => {
      loadDashboardStats();
    }, 100);
  };

  // 🔹 Role restriction: only securityadmin & itadmin
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

  // ✅ ENHANCED: Render stats based on insight type
  const renderStats = () => {
    if (!stats) return null;

    if (insightType === 'FG') {
      return (
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.today?.gate_in + stats.today?.gate_out || 0}</Text>
            <Text>Today's Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.last_30_days?.unique_vehicles || 0}</Text>
            <Text>Unique Vehicles</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.today?.gate_in || 0}</Text>
            <Text>Gate-In Today</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>{stats.today?.gate_out || 0}</Text>
            <Text>Gate-Out Today</Text>
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

  // ✅ ENHANCED: Render table based on insight type
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
              <Text style={styles.cell}>{movement.warehouse_name}</Text>
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
        
        {/* ✅ NEW: Insight Type Toggle */}
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

        {/* Filter Inputs - EXACTLY like Security Insights Tab */}
        <View style={styles.inputRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.inputInline}>
              {/* From Date */}
              <View style={styles.inputBox}>
                <Text>From Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={fromDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      setFromDate(newDate);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: '#888',
                      padding: 6,
                      borderRadius: 4,
                      fontSize: 13,
                      backgroundColor: '#fff',
                      width: '100%',
                      minHeight: 32,
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.datePickerButton}
                      onPress={() => setShowFromDatePicker(true)}
                    >
                      <Text style={styles.datePickerText}>
                        {formatDateForAPI(fromDate)}
                      </Text>
                    </TouchableOpacity>
                    
                    {showFromDatePicker && (
                      <DateTimePicker
                        value={fromDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowFromDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setFromDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </View>

              {/* To Date */}
              <View style={styles.inputBox}>
                <Text>To Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={toDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      setToDate(newDate);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: '#888',
                      padding: 6,
                      borderRadius: 4,
                      fontSize: 13,
                      backgroundColor: '#fff',
                      width: '100%',
                      minHeight: 32,
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.datePickerButton}
                      onPress={() => setShowToDatePicker(true)}
                    >
                      <Text style={styles.datePickerText}>
                        {formatDateForAPI(toDate)}
                      </Text>
                    </TouchableOpacity>
                    
                    {showToDatePicker && (
                      <DateTimePicker
                        value={toDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowToDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setToDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </View>
              
              {/* Site Code - Simple input like Security Insights */}
              <View style={styles.inputBox}>
                <Text>Site Code</Text>
                <TextInput 
                  style={styles.input} 
                  value={siteCode} 
                  onChangeText={setSiteCode} 
                  placeholder="Optional"
                />
              </View>

              {/* Warehouse Code - Simple input like Security Insights */}
              <View style={styles.inputBox}>
                <Text>Warehouse Code</Text>
                <TextInput 
                  style={styles.input} 
                  value={whCode} 
                  onChangeText={setWhCode} 
                  placeholder="Optional"
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