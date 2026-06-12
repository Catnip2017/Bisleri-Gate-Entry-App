// app/rpa/index.js
// RPA Process domain selector — placeholder tiles, not yet functional.
// Each domain tile will eventually deep-link to its own process list.

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import styles from './RpaStyles';

// ── Domain definitions ────────────────────────────────────────────────────────
// route: null until individual domain screens are built
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
    accentColor: '#38a169',
    iconBg: '#f0fff4',
    route: null,
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
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <MaterialIcons name="arrow-back" size={22} color="#1a365d" />
          <Text style={styles.backText}>Admin Hub</Text>
        </Pressable>
        <Text style={styles.topTitle}>RPA Processes</Text>
        {/* balance spacer */}
        <View style={{ width: 90 }} />
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
              // All tiles are placeholders — disabled until routes are ready
              onPress={() => {
                if (domain.route) router.push(domain.route);
                // else: no-op — tile visible but non-functional
              }}
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
              {/* Coming-soon badge shown while route is null */}
              {!domain.route && (
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
