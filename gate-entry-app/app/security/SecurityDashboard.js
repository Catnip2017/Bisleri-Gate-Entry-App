// app/security/SecurityDashboard.js - 2-tab system (Gate Entry | Insights)
// Wrapped in the shared AppShell: standard header (menu + logo + avatar),
// the one role-aware sidebar with pinned logout. No screen-owned chrome.
import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import AppShell from '../../components/ui/AppShell';
import TabNavigation from './components/TabNavigation';
import GateEntryTab from './components/GateEntryTab';
import InsightsTab from './components/InsightsTab';
import GatePassGuardTab from './components/GatePassGuardTab';
import styles from './styles/dashboardStyles';

const SecurityDashboard = () => {
  const router = useRouter();
  // Initial tab is role-dependent: admins land on Insights (their job is
  // reviewing), guards land on Gate Entry (their job is recording). Resolved
  // AFTER the user loads so there's no wrong-tab flash.
  const [activeTab, setActiveTab] = useState(null);
  const [visitedTabs, setVisitedTabs] = useState({ entry: false, insights: false, gatepass: false });

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

      // Role-based default tab
      const roles = user?.roles || [];
      const isAdminViewer = roles.includes('itadmin');
      const initialTab = isAdminViewer ? 'insights' : 'entry';
      setActiveTab(initialTab);
      setVisitedTabs((prev) => ({ ...prev, [initialTab]: true }));
    } catch (error) {
      console.log('Error loading user data:', error);
      setActiveTab('entry');
      setVisitedTabs((prev) => ({ ...prev, entry: true }));
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => ({ ...prev, [tab]: true }));
  };

  const roles = userData?.roles || [];
  const isAdminViewer = roles.includes('itadmin');
  // Gate Pass tab: visible to EVERY guard. Guards without the Gate Pass
  // Dispatcher role see a blocked card telling them which role to ask for
  // (show-and-explain — special to this tab, decided 14 Jul 2026).
  const showGatePassTab = roles.includes('securityguard');
  // IT Admins arrive here from the Admin Hub tile — give them a way back.
  // Guards/Security Admins have no Admin Hub, so they get no back chip.
  const isItAdmin = roles.includes('itadmin');

  return (
    <AppShell
      title={isItAdmin ? 'Gate Entry & Insights' : undefined}
      backLabel={isItAdmin ? 'Admin Hub' : undefined}
      onBack={isItAdmin ? () => router.replace('/admin-hub') : undefined}
    >
      {activeTab === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#00A651" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <TabNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            viewOnlyEntry={isAdminViewer}
            showGatePass={showGatePassTab}
          />

          <View style={styles.tabContent}>
            {/* Gate Entry (FG/RM toggle inside) — lazy mounted */}
            {visitedTabs.entry && (
              <View style={activeTab === 'entry' ? styles.visibleTab : styles.hiddenTab}>
                <GateEntryTab
                  gateEntryData={gateEntryData}
                  onDataChange={setGateEntryData}
                  userData={userData}
                />
              </View>
            )}

            {/* Insights (FG/RM toggle inside) — lazy mounted */}
            {visitedTabs.insights && (
              <View style={activeTab === 'insights' ? styles.visibleTab : styles.hiddenTab}>
                <InsightsTab />
              </View>
            )}

            {/* Gate Pass worklist (dispatch / inward / cancelled) — lazy mounted */}
            {showGatePassTab && visitedTabs.gatepass && (
              <View style={activeTab === 'gatepass' ? styles.visibleTab : styles.hiddenTab}>
                <GatePassGuardTab hasGpdRole={roles.includes('gatepassdispatcher')} />
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </AppShell>
  );
};

export default SecurityDashboard;
