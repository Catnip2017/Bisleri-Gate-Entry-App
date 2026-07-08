// app/gate-pass/GatePassDashboard.js - Initiator module (temporary: IT Admin
// stands in for the future Gate Pass User role — see backend ROLE SWAP NOTE).
// Two views: New Gate Pass (create-once form) | My Passes (status lifecycle).
// A due-returns banner surfaces returnable passes expected back and not yet in.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { gatePassAPI } from '../../services/api';
import AppShell from '../../components/ui/AppShell';
import GatePassForm from './GatePassForm';
import GatePassList from './GatePassList';
import styles from './styles/gatePassStyles';

const GatePassDashboard = () => {
  const [activeView, setActiveView] = useState('new');   // 'new' | 'list'
  const [refreshKey, setRefreshKey] = useState(0);
  const [dueItems, setDueItems] = useState([]);

  const loadDue = useCallback(async () => {
    try {
      const data = await gatePassAPI.getDueNotifications();
      setDueItems(data.items || []);
    } catch (error) {
      // Notifications are best-effort; never block the module on them
      setDueItems([]);
    }
  }, []);

  useEffect(() => {
    loadDue();
  }, [loadDue, refreshKey]);

  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.container}>
        {/* In-app due-return alert (items expected back today or earlier) */}
        {dueItems.length > 0 && (
          <View style={styles.dueBanner}>
            <Text style={styles.dueBannerTitle}>
              {dueItems.length} returnable pass{dueItems.length === 1 ? '' : 'es'} overdue for inward
            </Text>
            {dueItems.slice(0, 3).map((d) => (
              <Text key={d.gate_pass_no} style={styles.dueBannerText}>
                {d.gate_pass_no} — {d.party_name} — {d.outstanding_quantity} item(s), due{' '}
                {d.days_overdue === 0 ? 'today' : `${d.days_overdue} day(s) ago`}
              </Text>
            ))}
            {dueItems.length > 3 && (
              <Text style={styles.dueBannerText}>…and {dueItems.length - 3} more (see Overdue Returns filter)</Text>
            )}
          </View>
        )}

        {/* View toggle */}
        <View style={styles.subToggleRow} accessibilityRole="tablist">
          {[
            { key: 'new', label: 'New Gate Pass' },
            { key: 'list', label: 'My Passes' },
          ].map((v) => (
            <TouchableOpacity
              key={v.key}
              style={activeView === v.key ? styles.toggleActive : styles.toggleInactive}
              onPress={() => setActiveView(v.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeView === v.key }}
            >
              <Text style={activeView === v.key ? styles.toggleActiveText : styles.toggleInactiveText}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeView === 'new' ? (
          <GatePassForm
            onCreated={() => {
              bump();
              setActiveView('list');
            }}
          />
        ) : (
          <GatePassList refreshKey={refreshKey} onChanged={bump} />
        )}
      </ScrollView>
    </AppShell>
  );
};

export default GatePassDashboard;
