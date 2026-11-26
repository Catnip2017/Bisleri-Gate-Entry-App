// app/rpa/monthly-sales-invoice.js
// Monthly Sales Invoice — RPA dashboard (26 Nov 2026; replaces the
// "coming soon" placeholder). Same layout as Vendor Payment Advice so the
// Finance pages feel the same:
//  - search at the top (invoice no., account, customer, IRN, voucher)
//  - KPI cards (Total / Completed / Pending / Issue) counting EVERY invoice
//    that matches the filters; tap a status card to filter, tap again to clear
//  - filters: invoice date range (defaults to this month), Site and Route
//    (options read from the data — a new site appears automatically),
//    Delivery challan, Download Report (.xlsx of all matching invoices)
//  - server-side paging (25 per page), expandable rows for the details
// Data: RPA_Automation.customer_invoice_journal via /rpa/msi/* (IT Admin only).
// created_at is deliberately not shown anywhere.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, ActivityIndicator, TouchableOpacity, Platform, useWindowDimensions,
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
import { SearchMultiSelect, SearchSelect } from '../../components/ui/SearchSelect';
import { green, colors } from '../../utils/theme';

const PAGE_SIZE = 25;

const fmtDate = (d) => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const showDate = (iso) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '—');

const CHALLAN_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const STATUS_CARDS = [
  { key: 'completed', label: 'Completed', icon: 'task-alt', tint: '#C5E0D6', iconColor: green.deep },
  { key: 'pending', label: 'Pending', icon: 'schedule', tint: '#E0F4F9', iconColor: '#0A6E85' },
  { key: 'issue', label: 'Issue', icon: 'error-outline', emphasized: true },
];

export default function MonthlySalesInvoiceScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const narrow = width < 700;   // phones: fewer columns, rest in the row panel
  const [allowed, setAllowed] = useState(false);

  // Filters (applied with Apply, like Vendor Payment Advice)
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(new Date());
  const [sites, setSites] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [challan, setChallan] = useState('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [options, setOptions] = useState({ sites: [], routes: [] });
  // The filters actually used for the data on screen (paging + download)
  const [applied, setApplied] = useState(null);

  const [counts, setCounts] = useState({ total: 0, completed: 0, pending: 0, issue: 0 });
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const currentParams = (over = {}) => {
    const p = {
      date_from: dateFrom ? fmtDate(dateFrom) : undefined,
      date_to: dateTo ? fmtDate(dateTo) : undefined,
      sites: sites.join(',') || undefined,
      routes: routes.join(',') || undefined,
      challan,
      search: searchDraft.trim() || undefined,
      status: statusFilter,
      ...over,
    };
    return p;
  };

  const loadPage = useCallback(async (params, pageNo) => {
    setLoading(true);
    try {
      const data = await rpaAPI.getMsiRecords({ ...params, page: pageNo, page_size: PAGE_SIZE });
      setRecords(data.results || []);
      setTotal(data.total || 0);
      setPage(pageNo);
    } catch (error) {
      showAlert('Error', handleAPIError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async (params) => {
    if (params.date_from && params.date_to && params.date_from > params.date_to) {
      showAlert('Dates', "'Invoice date to' is before 'Invoice date from'.");
      return;
    }
    setApplied(params);
    const { status: _s, ...summaryParams } = params;
    rpaAPI.getMsiSummary(summaryParams).then(setCounts).catch(() => {});
    loadPage(params, 1);
  }, [loadPage]);

  // Access check: IT Admin only (same as Vendor Payment Advice)
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/LoginScreen'); return; }
      if (!(user.roles || []).includes('itadmin')) {
        showAlert('Access Denied', 'Only IT Admin can view RPA dashboards.');
        router.replace('/admin-hub');
        return;
      }
      setAllowed(true);
      rpaAPI.getMsiFilters().then((o) => setOptions({ sites: o.sites || [], routes: o.routes || [] })).catch(() => {});
      loadAll(currentParams());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => loadAll(currentParams());

  const handleClear = () => {
    setDateFrom(monthStart());
    setDateTo(new Date());
    setSites([]);
    setRoutes([]);
    setChallan('all');
    setSearchDraft('');
    setStatusFilter('all');
    loadAll({ date_from: fmtDate(monthStart()), date_to: fmtDate(new Date()), challan: 'all', status: 'all' });
  };

  const handleStatusTap = (key) => {
    const next = statusFilter === key ? 'all' : key;
    setStatusFilter(next);
    loadAll({ ...(applied || currentParams()), status: next });
  };

  const handleDownload = async () => {
    if (Platform.OS !== 'web') {
      showAlert('Download', 'Report download is available on the web version.');
      return;
    }
    setDownloading(true);
    try {
      const params = applied || currentParams();
      const blob = await rpaAPI.downloadMsiReport(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Monthly_Sales_Invoice_${params.date_from || 'all'}_to_${params.date_to || 'all'}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      let msg = handleAPIError(error);
      // blob responses carry the server's message inside the blob
      try {
        const txt = await error?.response?.data?.text?.();
        if (txt) msg = JSON.parse(txt).detail || msg;
      } catch (e) { /* keep msg */ }
      showAlert('Download', msg);
    } finally {
      setDownloading(false);
    }
  };

  const columns = [
    { key: 'invoice_number', title: 'Invoice No', flex: 1.1, priority: 1 },
    { key: 'invoice_date', title: 'Invoice Date', flex: 0.9, priority: narrow ? 2 : 1, render: (r) => showDate(r.invoice_date) },
    { key: 'customer_name', title: 'Customer', flex: 1.8, priority: 1 },
    { key: 'invoice_account', title: 'Account', flex: 0.9, priority: narrow ? 2 : 1 },
    { key: 'site', title: 'Site', flex: 0.6, priority: narrow ? 2 : 1 },
    { key: 'route_code', title: 'Route', flex: 0.7, priority: narrow ? 2 : 1 },
    { key: 'status', title: 'Status', flex: 0.9, priority: 1, render: (r) => (r.status || '—').toUpperCase() },
    { key: 'voucher', title: 'Voucher', priority: 2 },
    { key: 'currency', title: 'Currency', priority: 2 },
    {
      key: 'delivery_challan', title: 'Delivery challan', priority: 2,
      render: (r) => (r.delivery_challan === null || r.delivery_challan === undefined ? '—' : r.delivery_challan ? 'Yes' : 'No'),
    },
    { key: 'irn_number', title: 'IRN number', priority: 2 },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!allowed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: green.tint1 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppShell title="Monthly Sales Invoice" backLabel="Finance">
    <ScrollView style={{ flex: 1, backgroundColor: green.tint1 }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ padding: 14 }}>
        {/* Search */}
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
            placeholder="Search invoice no., customer, account, IRN or voucher"
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={handleApply}
            returnKeyType="search"
          />
          <AppButton title="Apply" icon="search" onPress={handleApply} loading={loading} />
          <AppButton title="Clear all" variant="secondary" icon="clear" onPress={handleClear} />
        </View>

        {/* KPI cards — whole filtered set; status cards filter on tap */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <KpiCard
            label="Total invoices" value={counts.total} icon="receipt-long"
            tint="#D9EEFA" iconColor="#0C447C"
            selected={statusFilter === 'all'}
            caption={statusFilter === 'all' ? 'showing all' : 'tap to show all'}
            onPress={() => statusFilter !== 'all' && handleStatusTap(statusFilter)}
          />
          {STATUS_CARDS.map((c) => (
            <KpiCard
              key={c.key}
              label={c.label} value={counts[c.key]} icon={c.icon}
              tint={c.tint} iconColor={c.iconColor} emphasized={c.emphasized}
              selected={statusFilter === c.key}
              caption={statusFilter === c.key ? 'filtering' : 'tap to filter'}
              onPress={() => handleStatusTap(c.key)}
            />
          ))}
        </View>

        {statusFilter !== 'all' && (
          <Text style={{ fontSize: 12, color: green.deep, marginBottom: 8 }}>
            Showing only: {statusFilter.toUpperCase()} — tap the card again to show all
          </Text>
        )}

        {/* Filters + Download Report */}
        <View style={{
          backgroundColor: green.tint2, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 14,
          borderWidth: 1, borderColor: '#C5E0D6', zIndex: 10,
        }}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <View style={{ width: 170 }}>
              <DateField label="Invoice date from" value={dateFrom} onChange={setDateFrom} placeholder="Any" />
            </View>
            <View style={{ width: 170 }}>
              <DateField label="Invoice date to" value={dateTo} onChange={setDateTo} placeholder="Any" />
            </View>
            <View style={{ width: 170, zIndex: 30 }}>
              <SearchMultiSelect title="Site" name="Site" options={options.sites}
                selected={sites} onChange={setSites} allLabel="All sites" />
            </View>
            <View style={{ width: 170, zIndex: 29 }}>
              <SearchMultiSelect title="Route" name="Route" options={options.routes}
                selected={routes} onChange={setRoutes} allLabel="All routes" />
            </View>
            <View style={{ width: 140, zIndex: 28 }}>
              <SearchSelect title="Delivery challan" name="Delivery challan" options={CHALLAN_OPTIONS}
                value={challan} onChange={setChallan} />
            </View>
            <View style={{ marginLeft: 'auto' }}>
              <AppButton title="Download Report" icon="download" variant="success"
                onPress={handleDownload} loading={downloading} disabled={total === 0} />
            </View>
          </View>
        </View>

        {/* Table */}
        {loading && records.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 8, color: green.deep }}>Loading invoices…</Text>
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 12, color: '#5C6B62', marginBottom: 8 }}>
              {total.toLocaleString('en-IN')} invoice{total === 1 ? '' : 's'}
              {total > PAGE_SIZE ? ` — page ${page} of ${totalPages}` : ''}
              {loading ? ' · loading…' : ''}
            </Text>

            <DataTable
              columns={columns}
              data={records}
              keyExtractor={(r) => String(r.invoice_number)}
              emptyText="No invoices match the current filters"
              detailLayout="row"
            />

            {total > PAGE_SIZE && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  disabled={page === 1 || loading}
                  onPress={() => loadPage(applied, page - 1)}
                  style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Previous page"
                >
                  <MaterialIcons name="chevron-left" size={26} color={page === 1 ? '#9FB3A7' : green.deep} />
                </TouchableOpacity>
                <Text style={{ fontSize: 13, color: green.deep }}>Page {page} of {totalPages}</Text>
                <TouchableOpacity
                  disabled={page === totalPages || loading}
                  onPress={() => loadPage(applied, page + 1)}
                  style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityLabel="Next page"
                >
                  <MaterialIcons name="chevron-right" size={26} color={page === totalPages ? '#9FB3A7' : green.deep} />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <AppButton title="Refresh" icon="refresh" variant="secondary"
                onPress={() => applied && loadAll(applied)} />
            </View>
          </>
        )}
      </View>
    </ScrollView>
    </AppShell>
  );
}
