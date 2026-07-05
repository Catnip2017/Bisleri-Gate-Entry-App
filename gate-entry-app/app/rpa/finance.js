// app/rpa/finance.js
// Finance domain — live RPA process list.
// Tapping a process opens its logs & summary screen.
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

// NOTE: descriptions summarised from the Process Solution Documents —
// refine wording against the PSDs if needed.
const PROCESSES = [
  {
    key: 'vpa',
    name: 'Vendor Payment Advice',
    icon: 'mark-email-read',
    accentColor: '#00A651',
    iconBg: '#D5EEDF',
    route: '/rpa/vendor-payment-advice',
    description:
      'Emails payment advice PDFs to vendors after every payment run and tracks delivery — completed, failed (invalid address) and bounced emails.',
    live: true,
  },
  {
    key: 'msi',
    name: 'Monthly Sales Invoice',
    icon: 'receipt-long',
    accentColor: '#0277BD',
    iconBg: '#D9EEFA',
    route: '/rpa/monthly-sales-invoice',
    description:
      'Generates and distributes the monthly sales invoice statements to customers at month close.',
    live: true,
  },
];

export default function FinanceProcessesScreen() {
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
          <MaterialIcons name="arrow-back" size={22} color="#064D28" />
          <Text style={styles.backText}>Domains</Text>
        </Pressable>
        <Text style={styles.topTitle}>Finance Processes</Text>
        <View style={{ width: 90 }} />
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <Text style={styles.heading}>Finance automation</Text>
        <Text style={styles.subheading}>
          Tap a process to view its run summary and delivery logs
        </Text>

        <View style={{ gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          {PROCESSES.map((proc) => (
            <Pressable
              key={proc.key}
              onPress={() => router.push(proc.route)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${proc.name}`}
              style={({ pressed }) => [
                {
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#BCE5CC',
                  borderLeftWidth: 4,
                  borderLeftColor: proc.accentColor,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: proc.iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name={proc.icon} size={26} color={proc.accentColor} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A2E22' }}>
                    {proc.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: proc.live ? '#D5EEDF' : '#F1EFE8',
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: proc.live ? '#064D28' : '#5F5E5A' }}>
                      {proc.live ? 'LIVE' : 'PAUSED'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: '#1A2E22', marginTop: 6, lineHeight: 18 }}>
                  {proc.description}
                </Text>
              </View>

              <MaterialIcons name="chevron-right" size={26} color="#9FB3A7" />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
