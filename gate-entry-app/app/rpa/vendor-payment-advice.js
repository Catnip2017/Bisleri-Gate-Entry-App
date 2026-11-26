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
//  - Download Report: .xlsx of ALL matching payments (server-built; replaced
//    the on-screen-rows-only CSV on 26 Nov 2026) and refresh
//  - 26 Nov 2026: Payment Type filter (options read from the data) and the
//    invoice numbers of each payment (column + full list in the row panel;
//    search also finds a payment by any of its invoice numbers)
//  - 26 Nov 2026 (2): dates, Payment type and KPI cards apply at once (no
//    Apply needed — the button is only for the search text); the status
//    filter shows as a chip above the table (nothing shifts); invoices show
//    as a count in the table and as wrapped chips in the opened row;
//    the page keeps the scrollbar space so its width never jumps
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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { rpaAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showAlert } from '../../utils/customModal';
import AppShell from '../../components/ui/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import DataTable from '../../components/ui/DataTable';
import DateField from '../../components/ui/DateField';
import AppButton from '../../components/ui/AppButton';
import { SearchMultiSelect } from '../../components/ui/SearchSelect';
import ResultBar from '../../components/ui/ResultBar';
import { green, colors } from '../../utils/theme';

const PAGE_SIZE = 25;

const fmtDate = (d) => {
  if (!d) return undefined;
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

// Table cell: the number itself for one invoice, a "6 invoices" pill for
// several (long numbers used to wrap onto two lines); the opened row lists all.
const InvoiceCell = ({ list }) => {
  const inv = list || [];
  if (!inv.length) return '—';
  if (inv.length === 1) return inv[0];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: '#E6F1EC', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0B5236' }}>{inv.length} invoices</Text>
    </View>
  );
};

const copyText = (text) => {
  try {
    if (Platform.OS === 'web' && navigator?.clipboard) { navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* ignore */ }
  return false;
};

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
  const [emailFrom, setEmailFrom] = useState(daysAgo(30));
  const [emailTo, setEmailTo] = useState(new Date());
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  // Payment Type filter — [] = all types; options come from the data
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);

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
      rpaAPI.getVpaPaymentTypes().then((t) => setPaymentTypeOptions(t || [])).catch(() => {});
    })();
  }, []);

  const buildParams = (status, search, types = paymentTypes) => {
    const params = {
      payment_from: fmtDate(paymentFrom),
      payment_to: fmtDate(paymentTo),
      email_from: fmtDate(emailFrom),
      email_to: fmtDate(emailTo),
    };
    if (search && search.trim()) params.search = search.trim();
    if (status && status !== 'all') params.status = status;
    if (types.length) params.payment_types = types.join(',');
    return params;
  };

  const loadData = useCallback(async (status = statusFilter, search = appliedSearch, types = paymentTypes) => {
    if (paymentFrom && paymentTo && paymentFrom > paymentTo) return;   // shown inline instead
    if (emailFrom && emailTo && emailFrom > emailTo) return;
    setLoading(true);
    try {
      const params = buildParams(status, search, types);
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
  }, [paymentFrom, paymentTo, emailFrom, emailTo, statusFilter, appliedSearch, paymentTypes]);

  // Filters (dates, Payment type, KPI cards) apply on their own, shortly
  // after the last change — no Apply click needed. This also does the
  // first load once access is confirmed.
  useEffect(() => {
    if (!allowed) return undefined;
    const t = setTimeout(() => loadData(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, paymentFrom, paymentTo, emailFrom, emailTo, paymentTypes, statusFilter, appliedSearch]);

  // Search text applies with the Search button / Enter; emptying the box
  // brings back all records straight away.
  const handleApply = () => {
    if (searchDraft === appliedSearch) loadData();
    else setAppliedSearch(searchDraft);
  };
  useEffect(() => {
    if (searchDraft === '' && appliedSearch !== '') setAppliedSearch('');
  }, [searchDraft]);   // eslint-disable-line react-hooks/exhaustive-deps

  const dateError = paymentFrom && paymentTo && paymentFrom > paymentTo
    ? "'Payment to' is before 'Payment from'"
    : emailFrom && emailTo && emailFrom > emailTo ? "'Email sent to' is before 'Email sent from'" : '';

  const handleClear = () => {
    setSearchDraft('');
    setAppliedSearch('');
    setPaymentFrom(daysAgo(90));
    setPaymentTo(new Date());
    // (was setEmailFilterOn(false) — that state no longer exists, so
    // "Clear all" threw an error; reset the email dates instead)
    setEmailFrom(daysAgo(30));
    setEmailTo(new Date());
    setPaymentTypes([]);
    setStatusFilter('all');   // the filter effect reloads
  };

  const handleStatusTap = (status) => {
    const next = statusFilter === status ? 'all' : status;
    setStatusFilter(next);   // the filter effect reloads
  };

  // Download Report (26 Nov 2026, replaces Download CSV): .xlsx built on the
  // server with EVERY payment matching the filters (the CSV only had the
  // rows loaded on screen), invoice numbers included.
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (Platform.OS !== 'web') {
      showAlert('Download', 'Report download is available on the web version.');
      return;
    }
    setDownloading(true);
    try {
      const params = buildParams(statusFilter, appliedSearch);
      const blob = await rpaAPI.downloadVpaReport(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vendor_Payment_Advice_${params.payment_from || 'all'}_to_${params.payment_to || 'all'}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      let msg = handleAPIError(error);
      try {
        const txt = await error?.response?.data?.text?.();
        if (txt) msg = JSON.parse(txt).detail || msg;
      } catch (e) { /* keep msg */ }
      showAlert('Download', msg);
    } finally {
      setDownloading(false);
    }
  };

  // Table config — 5 primary columns, rest in the expandable panel
  const columns = [
    { key: 'recid', title: 'RECID', flex: 0.9, priority: 1 },
    { key: 'payment_date', title: 'Payment Date', flex: 1, priority: 1, render: (r) => r.payment_date || '—' },
    { key: 'vendor_name', title: 'Vendor', flex: 1.5, priority: 1 },
    { key: 'vendor_code', title: 'Vendor Code', flex: 1, priority: 1 },
    { key: 'payment_type', title: 'Payment Type', flex: 1, priority: 1 },
    { key: 'payment_amount', title: 'Amount', flex: 1.1, priority: 1, render: (r) => formatAmount(r.payment_amount) },
    { key: 'invoice_numbers', title: 'Invoices', flex: 1.2, priority: 1,
      render: (r) => ((r.invoice_numbers || []).length > 1 ? <InvoiceCell list={r.invoice_numbers} /> : ((r.invoice_numbers || [])[0] || '—')) },
    { key: 'status', title: 'Status', flex: 0.9, priority: 1, render: (r) => (r.status || '—').toUpperCase() },
    { key: 'email_sent_date', title: 'Email Sent', priority: 2, render: (r) => formatDateTime(r.email_sent_date) },
    { key: 'vendor_email', title: 'Email (TO)', priority: 2 },
    { key: 'site', title: 'Site', priority: 2 },
    { key: 'invoice_count', title: 'No. of invoices', priority: 2 },
  ];

  // Opened row: the usual details on one line, then EVERY invoice number as
  // a wrapped chip (a single comma line ran off the right edge), + Copy all.
  const renderExpanded = (r) => {
    const inv = r.invoice_numbers || [];
    const item = (label, value) => (
      <View style={{ minWidth: 150, marginRight: 24, marginBottom: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#3E4F47' }}>{label}</Text>
        <Text style={{ fontSize: 14, color: '#12202A' }}>{value || '—'}</Text>
      </View>
    );
    return (
      <View style={{ backgroundColor: '#E8F4F4', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#D7E6E1' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {item('Email Sent', formatDateTime(r.email_sent_date))}
          {item('Email (TO)', r.vendor_email)}
          {item('Site', r.site)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#3E4F47' }}>Invoice numbers ({inv.length})</Text>
          {inv.length > 1 && Platform.OS === 'web' && (
            <TouchableOpacity onPress={() => copyText(inv.join(', '))} accessibilityRole="button" accessibilityLabel="Copy all invoice numbers"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MaterialIcons name="content-copy" size={14} color="#0F6B46" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F6B46' }}>Copy all</Text>
            </TouchableOpacity>
          )}
        </View>
        {inv.length === 0 ? <Text style={{ fontSize: 13.5, color: '#5C6B62' }}>—</Text> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {inv.map((n) => (
              <View key={n} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#C5E0D6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#12202A' }} selectable>{n}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

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
    <AppShell title="Vendor Payment Advice" backLabel="Finance">
    <ScrollView
      // scrollbarGutter: keep the scrollbar's space reserved so the page
      // width doesn't jump when a long dropdown makes the page scroll (web)
      style={[{ flex: 1, backgroundColor: green.tint1 }, Platform.OS === 'web' ? { scrollbarGutter: 'stable' } : null]}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={{ padding: 14 }}>
        {/* Search — kept at the very top so it's the first thing you reach */}
        <View style={{
          flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          backgroundColor: green.tint2, borderRadius: 12, padding: 12, marginBottom: 14,
          borderWidth: 1, borderColor: '#C5E0D6',
        }}>
          <TextInput
            style={{
              flex: 1, minWidth: 220, backgroundColor: '#fff', borderWidth: 1, borderColor: '#C5E0D6',
              borderRadius: 8, paddingHorizontal: 12, minHeight: 44, fontSize: 14,
            }}
            placeholder="Search vendor name, vendor code, RECID or invoice number"
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={handleApply}
            returnKeyType="search"
          />
          <AppButton title="Search" icon="search" onPress={handleApply} />
          <AppButton title="Clear all" variant="secondary" icon="clear" onPress={handleClear} />
          <AppButton title="Download Report" icon="download" variant="success"
            onPress={handleDownload} loading={downloading} disabled={records.length === 0 || !!dateError} />
        </View>

        {/* KPI cards — tap to filter by status, tap again to clear */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <KpiCard
            label="Completed" value={counts.completed} icon="mark-email-read"
            tint="#C5E0D6" iconColor={green.deep}
            selected={statusFilter === 'completed'}
            caption={statusFilter === 'completed' ? 'filtering' : 'tap to filter'}
            onPress={() => handleStatusTap('completed')}
          />
          <KpiCard
            label="Failed" value={counts.failed} icon="error-outline"
            emphasized
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

        {/* Date-range filters (search bar itself now lives at the top) */}
        <View style={{
          backgroundColor: green.tint2, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 14,
          borderWidth: 1, borderColor: '#C5E0D6', zIndex: 10,
        }}>
          {/* Payment date range (left) + Email sent date range (right) —
              always on, one row, fixed widths so fields don't stretch on
              wide desktop screens */}
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ width: 192 }}>
              <DateField label="Payment from" value={paymentFrom} onChange={setPaymentFrom} />
            </View>
            <View style={{ width: 192 }}>
              <DateField label="Payment to" value={paymentTo} onChange={setPaymentTo} />
            </View>
            <View style={{ width: 192 }}>
              <DateField label="Email sent from" value={emailFrom} onChange={setEmailFrom} />
            </View>
            <View style={{ width: 192 }}>
              <DateField label="Email sent to" value={emailTo} onChange={setEmailTo} />
            </View>
            {/* Payment Type (26 Nov 2026) — applies with the Apply button,
                like the dates; also narrows the KPI counts */}
            <View style={{ width: 210, zIndex: 20 }}>
              <SearchMultiSelect
                title="Payment type"
                name="Payment type"
                options={paymentTypeOptions}
                selected={paymentTypes}
                onChange={setPaymentTypes}
                allLabel="All payment types"
              />
            </View>
          </View>
          {dateError ? <Text style={{ color: '#C62828', fontSize: 12.5, marginTop: 8 }}>{dateError}</Text> : null}
        </View>

        {/* Table */}
        {loading && records.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 8, color: green.deep }}>Loading records…</Text>
          </View>
        ) : (
          <>
            <ResultBar
              text={`${records.length.toLocaleString()} record${records.length === 1 ? '' : 's'}${records.length > PAGE_SIZE ? ` — page ${page} of ${totalPages}` : ''}`}
              chips={statusFilter !== 'all' ? [{
                label: `Status: ${statusFilter.toUpperCase()}`,
                color: statusFilter === 'failed' ? '#B45309' : '#0F6B46',
                onClear: () => setStatusFilter('all'),
              }] : []}
              loading={loading}
              note="Failed records show no Email Sent date — no email was attempted"
            />

            <DataTable
              columns={columns}
              data={pageRecords}
              keyExtractor={(r) => String(r.recid)}
              emptyText="No records match the current filters"
              detailLayout="row"
              renderExpanded={renderExpanded}
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
              <AppButton title="Refresh" icon="refresh" variant="secondary" onPress={() => loadData()} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
    </AppShell>
  );
}
