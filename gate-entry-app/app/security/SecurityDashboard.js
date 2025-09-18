
// app/security/SecurityDashboard.js - MERGED 3-Tab System with RM Support
import React, { useState, useEffect } from 'react';
import { View, SafeAreaView, ScrollView } from 'react-native';
import { getCurrentUser } from '../../utils/jwtUtils';
import { gateAPI } from '../../services/api';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TabNavigation from './components/TabNavigation';
import GateEntryTab from './components/GateEntryTab';
import SecurityInsightsTab from './components/SecurityInsightsTab';
import RMInsightsTab from './components/RMInsightsTab';
import styles from './styles/dashboardStyles';

const SecurityDashboard = () => {
  // ✅ MERGED: 3-tab system (FG Entry, FG Insights, RM Insights)
  const [activeTab, setActiveTab] = useState('fgentry');
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  
  // User data
  const [userData, setUserData] = useState(null);
  
  // Gate Entry form state
  const [gateEntryData, setGateEntryData] = useState({
    gateType: 'Gate-In',
    gateEntryNo: '',
    dateTime: '',
    transporterName: '',
    vehicleNo: '',
    driverName: '',
    kmIn: '',
    kmOut: '',
    loaderNames: '',
    remarks: '',
    checkedItems: [false]
  });

  // Security Insights filters state
  const [insightsData, setInsightsData] = useState({
    fromDate: '2025/06/16',
    toDate: '2025/06/23',
    warehouseName: ''
  });

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
    generateAutoFields();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const generateAutoFields = () => {
    const now = new Date();
    const gateEntryNo = `GATE-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
    const dateTime = now.toLocaleString();
    
    setGateEntryData(prev => ({
      ...prev,
      gateEntryNo,
      dateTime
    }));
  };

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Gate Entry handlers
  const handleGateEntrySubmit = async () => {
    try {
      if (!gateEntryData.vehicleNo.trim()) {
        showAlert('Error', 'Please enter vehicle number');
        return;
      }

      const entryData = {
        gate_type: gateEntryData.gateType,
        vehicle_no: gateEntryData.vehicleNo,
        document_no: gateEntryData.documentNo || null,
        remarks: gateEntryData.remarks || null
      };

      const response = await gateAPI.createGateEntry(entryData);
      
      showAlert(
        'Success', 
        `Gate entry created successfully!\nGate Entry No: ${response.gate_entry_no}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setGateEntryData(prev => ({
                ...prev,
                transporterName: '',
                vehicleNo: '',
                driverName: '',
                kmIn: '',
                kmOut: '',
                loaderNames: '',
                remarks: '',
                checkedItems: [false]
              }));
              generateAutoFields();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Gate entry submission failed:', error);
      
      let errorMessage = 'Failed to create gate entry';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showAlert('Error', errorMessage);
    }
  };

  const handleAddManualEntry = () => {
    showAlert('Manual Entry', 'Manual entry functionality coming soon!');
  };

  const handleClearAll = () => {
    showAlert(
      'Clear All',
      'Are you sure you want to clear all fields?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setGateEntryData(prev => ({
              ...prev,
              transporterName: '',
              vehicleNo: '',
              driverName: '',
              kmIn: '',
              kmOut: '',
              loaderNames: '',
              remarks: '',
              checkedItems: [false]
            }));
            generateAutoFields();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Header */}
      <Header onMenuPress={toggleSidebar} userData={userData} />

      {/* Sidebar + Content */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Sidebar */}
        <Sidebar isVisible={isSidebarVisible} userData={userData} />

        {/* Main Content */}
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container}>
            {/* ✅ MERGED: 3-Tab Navigation */}
            <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

            {/* Tab Content */}
            <View style={styles.tabContent}>
              {/* ✅ MERGED: FG Entry Tab (with FG/RM toggle inside) */}
              <View style={activeTab === 'fgentry' ? styles.visibleTab : styles.hiddenTab}>
                <GateEntryTab
                  gateEntryData={gateEntryData}
                  onDataChange={setGateEntryData}
                  onSubmit={handleGateEntrySubmit}
                  onAddManualEntry={handleAddManualEntry}
                  onClearAll={handleClearAll}
                  userData={userData}
                />
              </View>

              {/* ✅ MERGED: FG Insights Tab */}
              <View style={activeTab === 'fginsights' ? styles.visibleTab : styles.hiddenTab}>
                <SecurityInsightsTab
                  insightsData={insightsData}
                  onDataChange={setInsightsData}
                />
              </View>

              {/* ✅ MERGED: RM Insights Tab */}
              <View style={activeTab === 'rminsights' ? styles.visibleTab : styles.hiddenTab}>
                <RMInsightsTab />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SecurityDashboard;