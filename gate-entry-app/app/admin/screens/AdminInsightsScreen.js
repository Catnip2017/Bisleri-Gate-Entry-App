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
import { adminAPI } from '../../../services/api';
import styles from '../styles/AdminInsightsStyle';
import { getCurrentUser } from '../../../utils/jwtUtils';

const AdminInsightsScreen = () => {
  const [fromDate, setFromDate] = useState('2025-01-01');
  const [toDate, setToDate] = useState('2025-12-31');
  const [siteCode, setSiteCode] = useState('');
  const [whCode, setWhCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const u = await getCurrentUser();
      if (!u) {
        Alert.alert("Error", "User not logged in");
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

  const loadDashboardStats = async () => {
    try {
      const statsData = await adminAPI.getAdminDashboardStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const handleShowResults = async () => {
    if (!fromDate || !toDate) {
      Alert.alert('Error', 'Please select both from and to dates');
      return;
    }

    setLoading(true);
    try {
      const filters = {
        fromDate,
        toDate,
        siteCode: siteCode || null,
        warehouseCode: whCode || null
      };

      const data = await adminAPI.getAdminInsights(filters);
      setInsights(data);
    } catch (error) {
      console.error('Error fetching insights:', error);
      Alert.alert('Error', 'Failed to load insights data');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Role restriction: only securityadmin & itadmin
  if (user) {
    const roleNormalized = user.role?.toLowerCase().replace(/\s+/g, "");
    if (!roleNormalized.includes("securityadmin") && !roleNormalized.includes("itadmin")) {
      return (
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "red" }}>
            Access Denied - You don’t have permission to view Admin Insights
          </Text>
        </View>
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Admin Insights - Vehicle Movements</Text>

        {/* Filter Inputs */}
        <View style={styles.inputRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.inputInline}>
              <View style={styles.inputBox}>
                <Text>From Date</Text>
                <TextInput 
                  style={styles.input} 
                  value={fromDate} 
                  onChangeText={setFromDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.inputBox}>
                <Text>To Date</Text>
                <TextInput 
                  style={styles.input} 
                  value={toDate} 
                  onChangeText={setToDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.inputBox}>
                <Text>Site Code</Text>
                <TextInput 
                  style={styles.input} 
                  value={siteCode} 
                  onChangeText={setSiteCode} 
                  placeholder="Optional"
                />
              </View>
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
        {stats && (
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
        )}

        {/* Results Table */}
        {insights && (
          <View style={styles.tableContainer}>
            <Text style={styles.tableTitle}>Vehicle Movement Records ({insights.count})</Text>
            
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
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default AdminInsightsScreen;