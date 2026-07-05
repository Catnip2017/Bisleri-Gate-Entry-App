// app/rpa/monthly-sales-invoice.js
// Monthly Sales Invoice — logs dashboard PLACEHOLDER.
// The process is live; its log dashboard will be converted from Streamlit
// the same way as Vendor Payment Advice once the code is provided.
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import KpiCard from '../../components/ui/KpiCard';
import { green } from '../../utils/theme';

export default function MonthlySalesInvoiceScreen() {
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: green.tint1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Top bar */}
      <View style={{
        height: 52, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#BCE5CC',
      }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 90, minHeight: 48 }, pressed && { opacity: 0.6 }]}
        >
          <MaterialIcons name="arrow-back" size={22} color={green.deep} />
          <Text style={{ fontSize: 14, color: green.deep, fontWeight: '500' }}>Finance</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: green.dark }}>Monthly Sales Invoice</Text>
        <View style={{ width: 90 }} />
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
