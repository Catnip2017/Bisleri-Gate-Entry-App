// app/rpa/vendor-payment-advice.js
// Vendor Payment Advice — delivery logs dashboard.
//
// React conversion of the standalone Streamlit VPA dashboard. Feature parity:
//  - Status counts (completed / failed / undeliverable / pending) that
//    respect the active filters — now as tappable KpiCards that ALSO act
//    as the status filter (replaces the Streamlit tabs)
//  - Shared filters: payment date range, email-sent date range, search
//    across vendor name / vendor code / RECID — one filter state for all
//  - Paginated records table (25/page) via the shared DataTable with
//    expandable rows instead of an 11-column horizontal scroll
//  - CSV export of the filtered data (web) and refresh
// Differences by design: uses the gate-entry app's JWT login (IT Admin
// only) — the Streamlit app's own login/register/reset is not needed.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { rpaAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showAlert } from '../../utils/customModal';
import KpiCard from '../../components/ui/KpiCard';
import DataTable from '../../components/ui/DataTable';
import DateField from '../../components/ui/DateField';
import AppButton from '../../components/ui/AppButton';
import { green, colors } from '../../utils/theme';

const PAGE_SIZE = 25;

const fmtDate = (d) => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const formatAmount = (value) =>
  value === null || value === undefined
    ? '—'
    : `Rs. ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function VendorPaymentAdviceScreen() {
  const router = useRouter();

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  // Filters (applied). Payment range defaults to last 90 days to keep the
  // first load bounded; Clear resets to this default.
  const [paymentFrom, setPaymentFrom] = useState(daysAgo(90));
  const [paymentTo, setPaymentTo] = useState(new Date());
  const [emailFilterOn, setEmailFilterOn] = useState(false);
  const [emailFrom, setEmailFrom] = useState(daysAgo(30));
  const [emailTo, setEmailTo] = useState(new Date());
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Status quick-filter — tapping a KPI card toggles it
  const [statusFilter, setStatusFilter] = useState('all');

  // Data
  const [counts, setCounts] = useState({ completed: 0, failed: 0, undeliverable: 0, pending: 0 });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Access check: IT Admin only
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/LoginScreen');
        return;
      }
      if (!(user.roles || []).includes('itadmin')) {
        showAlert('Access Denied', 'Only IT Admin can view RPA dashboards.');
        router.replace('/admin-hub');
        return;
      }
      setAllowed(true);
      setChecking(false);
      loadData('all', '');
    })();
  }, []);

  const buildParams = (status, search) => {
    const params = {
      payment_from: fmtDate(paymentFrom),
      payment_to: fmtDate(paymentTo),
    };
    if (emailFilterOn) {
      params.email_from = fmtDate(emailFrom);
      params.email_to = fmtDate(emailTo);
    }
    if (search && search.trim()) params.search = search.trim();
    if (status && status !== 'all') params.status = status;
    return params;
  };

  const loadData = useCallback(async (status = statusFilter, search = appliedSearch) => {
    setLoading(true);
    try {
      const params = buildParams(status, search);
      const { status: _s, ...summaryParams } = params;
      const [summary, data] = await Promise.all([
        rpaAPI.getVpaSummary(summaryParams),
        rpaAPI.getVpaRecords(params),
      ]);
      setCounts(summary);
      setRecords(data.results || []);
      setPage(1);
    } catch (error) {
      console.log('VPA load error:', error);
      showAlert('Error', handleAPIError(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFrom, paymentTo, emailFilterOn, emailFrom, emailTo, statusFilter, appliedSearch]);

  const handleApply = () => {
    setAppliedSearch(searchDraft);
    loadData(statusFilter, searchDraft);
  };

  const handleClear = () => {
    setSearchDraft('');
    setAppliedSearch('');
    setPaymentFrom(daysAgo(90));
    setPaymentTo(new Date());
    setEmailFilterOn(false);
    setStatusFilter('all');
    loadData('all', '');
  };

  const handleStatusTap = (status) => {
    const next = statusFilter === status ? 'all' : status;
    setStatusFilter(next);
    loadData(next, appliedSearch);
  };

  // CSV export (web)
  const handleDownload = () => {
    if (Platform.OS !== 'web') {
      showAlert('Download', 'CSV export is available on the web version.');
      return;
    }
    const header = ['RECID', 'Payment Date', 'Email Sent', 'Vendor Code', 'Vendor Name',
      'Email (TO)', 'Site', 'Amount', 'Payment Type', 'Invoices', 'Status'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = records.map((r) => [
      r.recid, r.payment_date || '', formatDateTime(r.email_sent_date),
      r.vendor_code || '', r.vendor_name || '', r.vendor_email || '',
      r.site || '', r.payment_amount ?? '', r.payment_type || '',
      r.invoice_count, (r.status || '').toUpperCase(),
    ].map(escape).join(','));
    const csv = [header.map(escape).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vpa_${statusFilter}_${fmtDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Table config — 5 primary columns, rest in the expandable panel
  const columns = [
    { key: 'recid', title: 'RECID', flex: 0.9, priority: 1 },
    { key: 'payment_date', title: 'Payment Date', flex: 1, priority: 1, render: (r) => r.payment_date || '—' },
    { key: 'vendor_name', title: 'Vendor', flex: 1.6, priority: 1 },
    { key: 'payment_amount', title: 'Amount', flex: 1.1, priority: 1, render: (r) => formatAmount(r.payment_amount) },
    { key: 'status', title: 'Status', flex: 0.9, priority: 1, render: (r) => (r.status || '—').toUpperCase() },
    { key: 'email_sent_date', title: 'Email Sent', priority: 2, render: (r) => formatDateTime(r.email_sent_date) },
    { key: 'vendor_code', title: 'Vendor Code', priority: 2 },
    { key: 'vendor_email', title: 'Email (TO)', priority: 2 },
    { key: 'site', title: 'Site', priority: 2 },
    { key: 'payment_type', title: 'Payment Type', priority: 2 },
    { key: 'invoice_count', title: 'Invoices', priority: 2 },
  ];

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRecords = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (checking || !allowed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: green.tint1 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: green.dark }}>Vendor Payment Advice</Text>
        <View style={{ width: 90 }} />
      </View>

      <View style={{ padding: 14 }}>
        {/* KPI cards — tap to filter by status, tap again to clear */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <KpiCard
            label="Completed" value={counts.completed} icon="mark-email-read"
            tint="#BCE5CC" iconColor={green.deep}
            selected={statusFilter === 'completed'}
            caption={statusFilter === 'completed' ? 'filtering' : 'tap to filter'}
            onPress={() => handleStatusTap('completed')}
          />
          <KpiCard
            label="Failed" value={counts.failed} icon="error-outline"
            emphasized={counts.failed > 0}
            tint="#F1EFE8" iconColor="#5F5E5A"
            selected={statusFilter === 'failed'}
            caption={statusFilter === 'failed' ? 'filtering' : 'tap to filter'}
            onPress={() => handleStatusTap('failed')}
          />
          <KpiCard
            label="Undeliverable" value={counts.undeliverable} icon="unsubscribe"
            tint="#FAC775" iconColor="#633806"
            selected={statusFilter === 'undeliverable'}
            caption={statusFilter === 'undeliverable' ? 'filtering' : 'tap to filter'}
            onPress={() => handleStatusTap('undeliverable')}
          />
          <KpiCard
            label="Pending" value={counts.pending} icon="schedule"
            tint="#E0F4F9" iconColor="#0A6E85"
            selected={statusFilter === 'pending'}
            caption={statusFilter === 'pending' ? 'filtering' : 'tap to filter'}
            onPress={() => handleStatusTap('pending')}
          />
        </View>

        {statusFilter !== 'all' && (
          <Text style={{ fontSize: 12, color: green.deep, marginBottom: 8 }}>
            Showing only: {statusFilter.toUpperCase()} — tap the card again to show all
          </Text>
        )}

        {/* Filters */}
        <View style={{
          backgroundColor: green.tint2, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 14,
          borderWidth: 1, borderColor: '#BCE5CC',
        }}>
          {/* Search row */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <TextInput
              style={{
                flex: 1, minWidth: 220, backgroundColor: '#fff', borderWidth: 1, borderColor: '#BCE5CC',
                borderRadius: 8, paddingHorizontal: 12, minHeight: 44, fontSize: 14,
              }}
              placeholder="Search vendor name, vendor code or RECID"
              value={searchDraft}
              onChangeText={setSearchDraft}
              onSubmitEditing={handleApply}
              returnKeyType="search"
            />
            <AppButton title="Apply" icon="search" onPress={handleApply} loading={loading} />
            <AppButton title="Clear all" variant="secondary" icon="clear" onPress={handleClear} />
          </View>

          {/* Payment date range */}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <DateField label="Payment from" value={paymentFrom} onChange={setPaymentFrom} />
            </View>
            <View style={{ flex: 1, minWidth: 150 }}>
              <DateField label="Payment to" value={paymentTo} onChange={setPaymentTo} />
            </View>
          </View>

          {/* Email sent range (optional) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Checkbox
              value={emailFilterOn}
              onValueChange={setEmailFilterOn}
              color={emailFilterOn ? colors.primary : undefined}
            />
            <Text style={{ fontSize: 13, color: green.deep }}>Filter by email sent date</Text>
          </View>
          {emailFilterOn && (
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <DateField label="Email sent from" value={emailFrom} onChange={setEmailFrom} />
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <DateField label="Email sent to" value={emailTo} onChange={setEmailTo} />
              </View>
            </View>
          )}
        </View>

        {/* Table */}
        {loading ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 8, color: green.deep }}>Loading records…</Text>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 12, color: '#5C6B62', marginBottom: 8 }}>
              {records.length.toLocaleString()} record{records.length === 1 ? '' : 's'}
              {records.length > PAGE_SIZE ? ` — page ${page} of ${totalPages}` : ''}
              {' '}(failed records show no Email Sent date — no email was attempted)
            </Text>

            <DataTable
              columns={columns}
              data={pageRecords}
              keyExtractor={(r) => String(r.recid)}
              emptyText="No records match the current filters"
            />

            {/* Pagination */}
            {records.length > PAGE_SIZE && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  disabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Previous page"
                >
                  <MaterialIcons name="chevron-left" size={26} color={page === 1 ? '#9FB3A7' : green.deep} />
                </TouchableOpacity>
                <Text style={{ fontSize: 13, color: green.deep }}>
                  Page {page} of {totalPages}
                </Text>
                <TouchableOpacity
                  disabled={page === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Next page"
                >
                  <MaterialIcons name="chevron-right" size={26} color={page === totalPages ? '#9FB3A7' : green.deep} />
                </TouchableOpacity>
              </View>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <AppButton title="Download CSV" icon="download" variant="success" onPress={handleDownload} disabled={records.length === 0} />
              <AppButton title="Refresh" icon="refresh" variant="secondary" onPress={() => loadData()} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
