// app/rpa/index.js
// RPA Process domain selector.
// Finance is LIVE (2 processes) — other domains remain coming-soon tiles.
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AppShell from '../../components/ui/AppShell';
import HubTile from '../../components/ui/HubTile';
import styles from './RpaStyles';

// ── Domain definitions ────────────────────────────────────────────────────
const DOMAINS = [
  {
    key: 'it',
    label: 'IT',
    icon: 'computer',
    accentColor: '#2b6cb0',
    iconBg: '#ebf8ff',
    route: null,
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: 'account-balance',
    accentColor: '#0F6B46',
    iconBg: '#E6F1EC',
    route: '/rpa/finance',
    processCount: 2,
  },
  {
    key: 'sales',
    label: 'Sales',
    icon: 'trending-up',
    accentColor: '#dd6b20',
    iconBg: '#fffaf0',
    route: null,
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: 'settings',
    accentColor: '#6b46c1',
    iconBg: '#faf5ff',
    route: null,
  },
];

export default function RpaScreen() {
  const router = useRouter();

  return (
    <AppShell title="RPA Processes" backLabel="Admin Hub">
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={[styles.body, { alignItems: 'center' }]}>
        <View style={{ width: '100%', maxWidth: 1100 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#00604F' }}>Select a Domain</Text>
          <Text style={[styles.subheading, { textAlign: 'left', marginBottom: 20 }]}>
            Choose the domain to view its automation processes
          </Text>

          {/* Same card look as the Admin Hub (components/ui/HubTile) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
            {DOMAINS.map((domain) => (
              <HubTile
                key={domain.key}
                label={domain.label}
                sublabel={domain.route
                  ? `${domain.processCount} live process${domain.processCount === 1 ? '' : 'es'}`
                  : 'Automation processes'}
                icon={domain.icon}
                accentColor={domain.accentColor}
                iconBg={domain.iconBg}
                disabled={!domain.route}
                statusText={domain.route ? null : 'COMING SOON'}
                accessibilityLabel={domain.route
                  ? `Open ${domain.label} processes`
                  : `${domain.label} — coming soon`}
                onPress={() => { if (domain.route) router.push(domain.route); }}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
    </AppShell>
  );
}
