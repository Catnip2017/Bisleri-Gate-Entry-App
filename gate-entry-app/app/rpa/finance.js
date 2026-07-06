// app/rpa/finance.js
// Finance domain — live RPA process list.
// Compact name cards; full details live behind the "About process" button
// which opens a popup card. Tapping the card body opens the logs dashboard.
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AppShell from '../../components/ui/AppShell';
import styles from './RpaStyles';

// NOTE: About content summarised from the Process Solution Documents —
// refine wording against the PSDs if needed.
const PROCESSES = [
  {
    key: 'vpa',
    name: 'Vendor Payment Advice',
    icon: 'mark-email-read',
    accentColor: '#00A651',
    iconBg: '#D5EEDF',
    route: '/rpa/vendor-payment-advice',
    live: true,
    about: {
      purpose:
        'Automatically emails a payment advice PDF to each vendor after a payment run, so vendors know which invoices were paid, for how much, and by which payment type.',
      trigger: 'Runs after each vendor payment batch is processed.',
      systems: 'ERP payment data → RPA bot → Outlook/SMTP email → PostgreSQL (RPA_Automation) tracking database.',
      statuses: [
        ['Completed', 'Advice emailed successfully to the vendor.'],
        ['Failed', 'Vendor email address invalid — no email was attempted.'],
        ['Undeliverable', 'Email was sent but bounced back.'],
        ['Pending', 'Queued — the bot has not processed this record yet.'],
      ],
      data: 'Each record (RECID) groups one payment to one vendor; a payment can cover multiple invoices. Amounts shown are per payment, not per invoice.',
    },
  },
  {
    key: 'msi',
    name: 'Monthly Sales Invoice',
    icon: 'receipt-long',
    accentColor: '#0277BD',
    iconBg: '#D9EEFA',
    route: '/rpa/monthly-sales-invoice',
    live: true,
    about: {
      purpose:
        'Generates and distributes monthly sales invoice statements to customers at month close.',
      trigger: 'Runs on a monthly schedule at period close.',
      systems: 'ERP sales data → RPA bot → email distribution → tracking database.',
      statuses: [
        ['Completed', 'Statement emailed successfully.'],
        ['Failed', 'Delivery failed — see logs when available.'],
        ['Pending', 'Queued for the next run.'],
      ],
      data: 'Log dashboard is being converted — detailed run data will appear on the process screen soon.',
    },
  },
];

export default function FinanceProcessesScreen() {
  const router = useRouter();
  const [aboutProc, setAboutProc] = useState(null);

  return (
    <AppShell title="Finance Processes" backLabel="Domains">
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <Text style={styles.heading}>Finance automation</Text>
        <Text style={styles.subheading}>
          Tap a process to open its logs — About process for details
        </Text>

        <View style={{ gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          {PROCESSES.map((proc) => (
            <Pressable
              key={proc.key}
              onPress={() => router.push(proc.route)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${proc.name} logs`}
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

                {/* Small About-process button */}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setAboutProc(proc);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    alignSelf: 'flex-start',
                    marginTop: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: proc.accentColor,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`About ${proc.name}`}
                >
                  <MaterialIcons name="info-outline" size={15} color={proc.accentColor} />
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: proc.accentColor }}>
                    About process
                  </Text>
                </TouchableOpacity>
              </View>

              <MaterialIcons name="chevron-right" size={26} color="#9FB3A7" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── About process popup ──────────────────────────────────────────── */}
      <Modal
        visible={!!aboutProc}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAboutProc(null)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', padding: 20,
        }}>
          <View style={{
            backgroundColor: '#ffffff', borderRadius: 16, padding: 20,
            width: '100%', maxWidth: 520, maxHeight: '85%',
          }}>
            {aboutProc && (
              <>
                {/* Popup header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10, backgroundColor: aboutProc.iconBg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MaterialIcons name={aboutProc.icon} size={20} color={aboutProc.accentColor} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: 'bold', color: '#1A2E22' }}>
                    {aboutProc.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAboutProc(null)}
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <MaterialIcons name="close" size={22} color="#5C6B62" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 420 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#064D28', marginBottom: 4 }}>
                    WHAT IT DOES
                  </Text>
                  <Text style={{ fontSize: 14, color: '#1A2E22', lineHeight: 20, marginBottom: 14 }}>
                    {aboutProc.about.purpose}
                  </Text>

                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#064D28', marginBottom: 4 }}>
                    WHEN IT RUNS
                  </Text>
                  <Text style={{ fontSize: 14, color: '#1A2E22', lineHeight: 20, marginBottom: 14 }}>
                    {aboutProc.about.trigger}
                  </Text>

                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#064D28', marginBottom: 4 }}>
                    SYSTEMS INVOLVED
                  </Text>
                  <Text style={{ fontSize: 14, color: '#1A2E22', lineHeight: 20, marginBottom: 14 }}>
                    {aboutProc.about.systems}
                  </Text>

                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#064D28', marginBottom: 6 }}>
                    STATUS MEANINGS
                  </Text>
                  {aboutProc.about.statuses.map(([label, meaning]) => (
                    <View key={label} style={{ flexDirection: 'row', marginBottom: 6 }}>
                      <Text style={{ width: 110, fontSize: 13, fontWeight: 'bold', color: '#1A2E22' }}>
                        {label}
                      </Text>
                      <Text style={{ flex: 1, fontSize: 13, color: '#5C6B62', lineHeight: 18 }}>
                        {meaning}
                      </Text>
                    </View>
                  ))}

                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#064D28', marginTop: 8, marginBottom: 4 }}>
                    ABOUT THE DATA
                  </Text>
                  <Text style={{ fontSize: 14, color: '#1A2E22', lineHeight: 20 }}>
                    {aboutProc.about.data}
                  </Text>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
    </AppShell>
  );
}
