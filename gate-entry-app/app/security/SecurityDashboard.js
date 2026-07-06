// app/security/SecurityDashboard.js - 2-tab system (Gate Entry | Insights)
// Wrapped in the shared AppShell: standard header (menu + logo + avatar),
// the one role-aware sidebar with pinned logout. No screen-owned chrome.
import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { getCurrentUser } from '../../utils/jwtUtils';
import AppShell from '../../components/ui/AppShell';
import TabNavigation from './components/TabNavigation';
import GateEntryTab from './components/GateEntryTab';
import InsightsTab from './components/InsightsTab';
import styles from './styles/dashboardStyles';

const SecurityDashboard = () => {
  const [activeTab, setActiveTab] = useState('entry');
  const [visitedTabs, setVisitedTabs] = useState({ entry: true, insights: false });

  // User data
  const [userData, setUserData] = useState(null);

  // Gate Entry form state (gateEntryNo stays empty until the backend
  // assigns the real number on submission)
  const [gateEntryData, setGateEntryData] = useState({
    gateType: 'Gate-In',
    gateEntryNo: '',
    dateTime: new Date().toLocaleString(),
    transporterName: '',
    vehicleNo: '',
    driverName: '',
    kmIn: '',
    kmOut: '',
    loaderNames: '',
    remarks: '',
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await getCurrentUser();
      setUserData(user);
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => ({ ...prev, [tab]: true }));
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        <View style={styles.tabContent}>
          {/* Gate Entry (FG/RM toggle inside) */}
          <View style={activeTab === 'entry' ? styles.visibleTab : styles.hiddenTab}>
            <GateEntryTab
              gateEntryData={gateEntryData}
              onDataChange={setGateEntryData}
              userData={userData}
            />
          </View>

          {/* Insights (FG/RM toggle inside) — lazy mounted */}
          {visitedTabs.insights && (
            <View style={activeTab === 'insights' ? styles.visibleTab : styles.hiddenTab}>
              <InsightsTab />
            </View>
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
};

export default SecurityDashboard;
