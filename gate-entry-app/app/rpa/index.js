// app/rpa/index.js
// RPA Process domain selector.
// Finance is LIVE (2 processes) — other domains remain coming-soon tiles.
import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import BackChip from '../../components/ui/BackChip';
import AppHeader from '../../components/ui/AppHeader';
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
    accentColor: '#00A651',
    iconBg: '#D5EEDF',
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Standard header + back chip row ─────────────────────────────── */}
      <AppHeader />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <BackChip label="Admin Hub" onPress={() => router.back()} />
        <Text style={styles.topTitle}>RPA Processes</Text>
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <Text style={styles.heading}>Select a Domain</Text>
        <Text style={styles.subheading}>
          Choose the domain to view its automation processes
        </Text>

        <View style={styles.grid}>
          {DOMAINS.map((domain) => (
            <Pressable
              key={domain.key}
              onPress={() => {
                if (domain.route) router.push(domain.route);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                domain.route
                  ? `Open ${domain.label} processes`
                  : `${domain.label} — coming soon`
              }
              style={({ pressed }) => [
                styles.domainTile,
                { borderTopWidth: 4, borderTopColor: domain.accentColor },
                pressed && domain.route && styles.domainTilePressed,
                !domain.route && { opacity: 0.65 },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: domain.iconBg },
                ]}
              >
                <MaterialIcons
                  name={domain.icon}
                  size={32}
                  color={domain.accentColor}
                />
              </View>
              <Text style={styles.domainLabel}>{domain.label}</Text>

              {domain.route ? (
                <View
                  style={{
                    backgroundColor: '#D5EEDF',
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#064D28' }}>
                    {domain.processCount} LIVE PROCESS{domain.processCount === 1 ? '' : 'ES'}
                  </Text>
                </View>
              ) : (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>COMING SOON</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
