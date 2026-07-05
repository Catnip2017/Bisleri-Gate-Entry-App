// app/rpa/monthly-sales-invoice.js
// Monthly Sales Invoice — logs dashboard PLACEHOLDER.
// The process is live; its log dashboard will be converted from Streamlit
// the same way as Vendor Payment Advice once the code is provided.
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import BackChip from '../../components/ui/BackChip';
import AppHeader from '../../components/ui/AppHeader';
import KpiCard from '../../components/ui/KpiCard';
import { green } from '../../utils/theme';

export default function MonthlySalesInvoiceScreen() {
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: green.tint1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Standard header + back chip row */}
      <AppHeader />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <BackChip label="Finance" onPress={() => router.back()} />
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: green.dark }}>Monthly Sales Invoice</Text>
      </View>

      <View style={{ padding: 14 }}>
        {/* Placeholder KPI row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <KpiCard label="Invoices sent" value="—" icon="receipt-long" tint="#D9EEFA" iconColor="#0C447C" />
          <KpiCard label="Failed" value="—" icon="error-outline" tint="#F1EFE8" iconColor="#5F5E5A" />
          <KpiCard label="Pending" value="—" icon="schedule" tint="#E0F4F9" iconColor="#0A6E85" />
        </View>

        <View style={{
          backgroundColor: green.tint2, borderRadius: 12, padding: 20, alignItems: 'center',
          borderWidth: 1, borderColor: '#BCE5CC', gap: 8,
        }}>
          <MaterialIcons name="construction" size={36} color={green.dark} />
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: green.deep }}>
            Log dashboard coming soon
          </Text>
          <Text style={{ fontSize: 13, color: '#5C6B62', textAlign: 'center', lineHeight: 19 }}>
            The Monthly Sales Invoice process is live. Its delivery logs and
            run summary will appear here once the dashboard conversion is
            complete — the same layout as Vendor Payment Advice.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
