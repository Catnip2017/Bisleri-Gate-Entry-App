// app/gate-pass/GatePassDashboard.js - Gate Pass module, wireframe layout:
// left "Gate Pass Menu" panel drives the right content pane.
// Menu mirrors the approved wireframe: + New Gate Pass | View All Passes |
// Pending Release | Pending Dispatch | Dispatched | Inward Received | Cancelled.
// (Pending Dispatch = Released; Dispatched view includes Partially Received.)
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { gatePassAPI } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import AppShell from '../../components/ui/AppShell';
import GatePassForm from './GatePassForm';
import GatePassList from './GatePassList';
import styles from './styles/gatePassStyles';

// '+ New Gate Pass' is rendered as its own button above this list (not a
// tab) — it doesn't represent a status view, so it never belonged in MENU.
const MENU = [
  { key: 'all', label: 'View All Passes' },
  { key: 'released', label: 'Pending Dispatch', status: 'Released' },
  { key: 'dispatched', label: 'Dispatched', status: 'Dispatched' },
  { key: 'partial', label: 'Partially Received', status: 'Partially Received' },
  { key: 'received', label: 'Inward Received', status: 'Inward Received' },
  { key: 'cancelled', label: 'Cancelled', status: 'Cancelled' },
];

const GatePassDashboard = () => {
  const router = useRouter();
  const [activeKey, setActiveKey] = useState('new');
  const [refreshKey, setRefreshKey] = useState(0);
  const [dueItems, setDueItems] = useState([]);
  const [isItAdmin, setIsItAdmin]       = useState(false);
  const [isGuard, setIsGuard]           = useState(false);
  const [guardBlocked, setGuardBlocked] = useState(false); // any role blocked due to no gate_pass_location

  useEffect(() => {
    getCurrentUser().then((u) => {
      const roles = u?.roles || [];
      const guard = roles.includes('securityguard');
      const itadmin = roles.includes('itadmin');
      setIsItAdmin(itadmin);
      setIsGuard(guard);
      // Hard block for ANY role without gate_pass_location
      if (!u?.gatePassLocation) {
        setGuardBlocked(true);
        return;
      }
      if (guard) setActiveKey('released');
    });
  }, []);

  const loadDue = useCallback(async () => {
    if (guardBlocked) return;          // don't fire API calls for blocked guards
    try {
      const data = await gatePassAPI.getDueNotifications();
      setDueItems(data.items || []);
    } catch (error) {
      // Notifications are best-effort; never block the module on them
      setDueItems([]);
    }
  }, [guardBlocked]);

  useEffect(() => {
    loadDue();
  }, [loadDue, refreshKey]);

  const bump = () => setRefreshKey((k) => k + 1);
  const visibleMenu = MENU;
  const activeMenu = visibleMenu.find((m) => m.key === activeKey) || visibleMenu[0];

  // Guard with no gate_pass_location — full-page block, no API calls made
  if (guardBlocked) {
    return (
      <AppShell
        title={isItAdmin ? 'Gate Pass' : undefined}
        backLabel={isItAdmin ? 'Admin Hub' : undefined}
        onBack={isItAdmin ? () => router.replace('/admin-hub') : undefined}
      >
        <View style={styles.guardBlockedContainer}>
          <View style={styles.guardBlockedCard}>
            <Text style={styles.guardBlockedIcon}>🚫</Text>
            <Text style={styles.guardBlockedTitle}>No Gate Pass Location Assigned</Text>
            <Text style={styles.guardBlockedBody}>
              {isItAdmin
                ? 'Your profile does not have a Gate Pass Location assigned. Go to User Management → Assign Access, search your username, and assign a Gate Pass Location before using this module.'
                : 'Your profile does not have a gate pass location assigned. You cannot access gate passes until an IT Admin assigns your location.'}
            </Text>
            <Text style={styles.guardBlockedHint}>
              {isItAdmin ? 'You can assign it to yourself via User Management.' : 'Contact IT Admin to resolve this.'}
            </Text>
          </View>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={isItAdmin ? 'Gate Pass' : undefined}
      backLabel={isItAdmin ? 'Admin Hub' : undefined}
      onBack={isItAdmin ? () => router.replace('/admin-hub') : undefined}
    >
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
            {/* '+ New Gate Pass' — a button, not a tab (guards don't create passes) */}
            {!isGuard && (
              <TouchableOpacity
                style={styles.newPassButton}
                onPress={() => setActiveKey('new')}
                accessibilityRole="button"
              >
                <Text style={styles.newPassButtonText}>+ New Gate Pass</Text>
              </TouchableOpacity>
            )}
            {visibleMenu.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={styles.menuItem}
                onPress={() => setActiveKey(m.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeKey === m.key }}
                activeOpacity={1}
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
