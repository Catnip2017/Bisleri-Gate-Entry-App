// app/gate-pass/GatePassDashboard.js - Gate Pass module, wireframe layout:
// left "Gate Pass Menu" panel drives the right content pane.
// Menu mirrors the approved wireframe: + New Gate Pass | View All Passes |
// Pending Release | Pending Dispatch | Dispatched | Inward Received | Cancelled.
// (Pending Dispatch = Released; Dispatched view includes Partially Received.)
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { gatePassAPI } from '../../services/api';
import AppShell from '../../components/ui/AppShell';
import GatePassForm from './GatePassForm';
import GatePassList from './GatePassList';
import styles from './styles/gatePassStyles';

const MENU = [
  { key: 'new', label: '+ New Gate Pass' },
  { key: 'all', label: 'View All Passes' },
  { key: 'open', label: 'Pending Release', status: 'Open' },
  { key: 'released', label: 'Pending Dispatch', status: 'Released' },
  { key: 'dispatched', label: 'Dispatched', status: 'Dispatched' },
  { key: 'partial', label: 'Partially Received', status: 'Partially Received' },
  { key: 'received', label: 'Inward Received', status: 'Inward Received' },
  { key: 'cancelled', label: 'Cancelled', status: 'Cancelled' },
];

const GatePassDashboard = () => {
  const [activeKey, setActiveKey] = useState('new');
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
  const activeMenu = MENU.find((m) => m.key === activeKey) || MENU[0];

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
              <Text style={styles.dueBannerText}>…and {dueItems.length - 3} more</Text>
            )}
          </View>
        )}

        <View style={styles.layoutRow}>
          {/* ── Gate Pass Menu (wireframe left panel) ── */}
          <View style={styles.menuPanel}>
            <Text style={styles.menuTitle}>Gate Pass Menu</Text>
            {MENU.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={styles.menuItem}
                onPress={() => setActiveKey(m.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeKey === m.key }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={activeKey === m.key ? styles.menuItemActiveText : styles.menuItemText}>
                    {m.label}
                  </Text>
                  {m.key === 'dispatched' && dueItems.length > 0 && (
                    <View style={styles.menuBadge}>
                      <Text style={styles.menuBadgeText}>{dueItems.length}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Content pane ── */}
          <View style={styles.contentPane}>
            {activeKey === 'new' ? (
              <GatePassForm
                onCreated={() => {
                  bump();
                  setActiveKey('all');
                }}
              />
            ) : (
              <GatePassList
                refreshKey={refreshKey}
                onChanged={bump}
                fixedStatus={activeMenu.status || null}
                showFilters={activeKey === 'all'}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
};

export default GatePassDashboard;
