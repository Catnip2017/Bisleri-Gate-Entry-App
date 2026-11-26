// app/inventory/InventoryPortal.js - Blinkit Inventory Portal (26 Nov 2026).
//
// One screen inside AppShell; its pages show as the sidebar sub-menu on
// desktop web and as tab buttons on phones / narrow windows:
//
//   Bisleri Inventory Operator : Dashboard · Inventory Entry · Inventory View · Inventory History
//   Blinkit Inventory Viewer   : Inventory View · Inventory History
//   IT Admin (Admin Hub tile)  : Inventory View · Inventory History (everything)
//
// All scope rules live on the server (/inventory/*): the screen only shows
// what the API returns. Rules mirrored here for instant feedback: date today
// or later, whole cases >= 1, mapped Blinkit store / warehouse, SKU (item
// number) from item_master. The warehouse name is saved with each line.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AppShell from '../../components/ui/AppShell';
import { WIDE_BREAKPOINT } from '../../components/ui/AppHeader';
import DateField from '../../components/ui/DateField';
import { SearchMultiSelect, SearchSelect } from '../../components/ui/SearchSelect';
import { inventoryAPI, handleAPIError } from '../../services/api';
import { getCurrentUser } from '../../utils/jwtUtils';
import { showAlert, confirmAction } from '../../utils/customModal';

// ── helpers ──────────────────────────────────────────────────────────────────
const isoOf = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
const dateOf = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);
const ddmmyyyy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000) + 1;
const stamp = (raw) => {
  if (!raw) return '—';
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(raw) ? raw : `${raw}Z`);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};
const errDetail = (e) => {
  const d = e?.response?.data?.detail;
  if (d && typeof d === 'object') return d;
  return { message: handleAPIError(e) };
};
const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const C = {
  bg: '#EEF5F2', card: '#fff', border: '#E0E9E5', text: '#12202A', sub: '#5B6B75', muted: '#8B99A3',
  green: '#0F6B46', teal: '#00836F', deep: '#00604F', red: '#C62828', soft: '#E6F1EC',
};
const card = {
  backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 18,
  ...(Platform.OS === 'web' ? { boxShadow: '0px 4px 14px rgba(0,96,79,0.06)' } : {}),
};

function Btn({ label, icon, onPress, kind = 'primary', disabled, busy, small, testID }) {
  const primary = kind === 'primary';
  const danger = kind === 'danger';
  return (
    <TouchableOpacity
      onPress={onPress} disabled={disabled || busy} testID={testID}
      accessibilityRole="button" accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: small ? 36 : 44, paddingHorizontal: small ? 12 : 18, borderRadius: 10,
        backgroundColor: primary ? (disabled ? '#9CB5AA' : C.green) : '#fff',
        borderWidth: primary ? 0 : 1.5, borderColor: danger ? '#E7A6A6' : C.green,
        opacity: disabled && !primary ? 0.5 : 1,
        ...(Platform.OS === 'web' ? { cursor: disabled ? 'default' : 'pointer' } : {}),
      }}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? '#fff' : C.green} /> : (
        icon ? <MaterialIcons name={icon} size={small ? 16 : 18} color={primary ? '#fff' : danger ? C.red : C.green} /> : null
      )}
      <Text style={{ color: primary ? '#fff' : danger ? C.red : C.green, fontWeight: '700', fontSize: small ? 13 : 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ title, children, flex = 1, minWidth = 180, z }) {
  return (
    <View style={{ flex, minWidth, zIndex: z || 1 }}>
      {title ? <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>{title}</Text> : null}
      {children}
    </View>
  );
}

const inputStyle = (err) => ({
  borderWidth: 1.5, borderColor: err ? C.red : '#CFDDD7', borderRadius: 10, paddingHorizontal: 12,
  minHeight: 44, fontSize: 14, color: C.text, backgroundColor: '#fff',
});

function Stat({ label, value, icon }) {
  return (
    <View style={{
      flex: 1, minWidth: 170, borderRadius: 14, padding: 16, backgroundColor: C.teal,
      ...(Platform.OS === 'web' ? { backgroundImage: 'linear-gradient(135deg, #00A68B 0%, #00836F 60%, #00604F 100%)' } : {}),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={icon} size={18} color="#fff" />
        </View>
      </View>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 }}>{value}</Text>
    </View>
  );
}

// ── SKU picker: type to search item_master (server, debounced) ───────────────
function SkuPicker({ value, onChange, error }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { setRows(await inventoryAPI.searchSkus(q.trim())); } catch (e) { setRows([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q, open]);
  return (
    <View style={{ zIndex: open ? 70 : 1 }}>
      <TouchableOpacity
        onPress={() => { setOpen((o) => !o); setQ(''); }}
        accessibilityRole="button" accessibilityLabel={`SKU: ${value ? value.name : 'Select SKU'}`}
        style={[inputStyle(error), { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
          value && !error && { borderColor: C.green }, Platform.OS === 'web' ? { cursor: 'pointer' } : null]}
      >
        <Text style={{ flex: 1, fontSize: 13.5, color: value ? C.text : C.muted }} numberOfLines={1}>
          {value ? `${value.name}  ·  ${value.code}` : 'Search SKU name or code'}
        </Text>
        <MaterialIcons name="search" size={18} color={C.muted} />
      </TouchableOpacity>
      {open && (
        <View style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#fff',
          borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingTop: 6, zIndex: 100, minWidth: 280,
          ...(Platform.OS === 'web' ? { boxShadow: '0px 6px 18px rgba(0,0,0,0.12)' } : { elevation: 8 }),
        }}>
          <TextInput
            value={q} onChangeText={setQ} autoFocus placeholder="Type SKU name or code…" placeholderTextColor={C.muted}
            style={{ marginHorizontal: 8, marginBottom: 4, borderWidth: 1, borderColor: '#CFDDD7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 }}
          />
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {loading && <ActivityIndicator style={{ margin: 10 }} color={C.green} />}
            {!loading && rows.map((r) => (
              <TouchableOpacity key={r.code} onPress={() => { onChange(r); setOpen(false); }}
                accessibilityRole="button" accessibilityLabel={r.name}
                style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: value?.code === r.code ? '#EAF5F0' : '#fff' }}>
                <Text style={{ fontSize: 13, color: C.text, fontWeight: '600' }}>{r.name || r.code}</Text>
                <Text style={{ fontSize: 11.5, color: C.sub }}>{r.code}</Text>
              </TouchableOpacity>
            ))}
            {!loading && rows.length === 0 && <Text style={{ padding: 12, fontSize: 12.5, color: C.muted }}>No SKUs found</Text>}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Dashboard (operator) ─────────────────────────────────────────────────────
function DashboardPage({ user, onGo, active }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    try { setD(await inventoryAPI.dashboard()); } catch (e) { setErr(handleAPIError(e)); }
  }, []);
  useEffect(() => { if (active) load(); }, [load, active]);   // fresh numbers each visit
  return (
    <View style={{ gap: 16 }}>
      <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }]}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="inventory" size={28} color={C.green} />
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.deep }}>Welcome{user?.firstName ? `, ${user.firstName}` : ''}</Text>
          <Text style={{ fontSize: 13.5, color: C.sub, marginTop: 3 }}>
            Record today's stock for your Blinkit stores. Lines can't be edited after Submit All.
          </Text>
        </View>
        <Btn label="Inventory Entry" icon="add-box" onPress={() => onGo('entry')} />
      </View>
      {err ? <Text style={{ color: C.red }}>{err}</Text> : null}
      {!d && !err ? <ActivityIndicator color={C.green} /> : null}
      {d && (
        <>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Stat label="Lines today" value={d.lines_today} icon="list-alt" />
            <Stat label="Cases today" value={d.cases_today.toLocaleString('en-IN')} icon="inventory-2" />
            <Stat label="Stores today" value={d.stores_today} icon="storefront" />
            <Stat label="Mapped warehouses" value={d.warehouses.length} icon="warehouse" />
          </View>
          <View style={card}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 10 }}>Your warehouses</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {d.warehouses.map((w) => (
                <View key={w.code} style={{ backgroundColor: C.soft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 12.5, color: C.deep, fontWeight: '700' }}>{w.code}<Text style={{ fontWeight: '400' }}>{w.name ? `  ${w.name}` : ''}</Text></Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ── Inventory Entry (operator) ───────────────────────────────────────────────
let lineSeq = 1;

function EntryPage({ lookups, lines, setLines }) {
  const today = lookups.today;
  const whOptions = lookups.warehouses.map((w) => ({ value: w.code, label: w.name ? `${w.code} — ${w.name}` : w.code }));
  const storeOptions = lookups.stores.map((c) => ({ value: c.code, label: c.label }));
  const storeName = (code) => lookups.stores.find((c) => c.code === code)?.name || '';
  const whName = (code) => lookups.warehouses.find((w) => w.code === code)?.name || '';

  const blank = { inv_date: today, store_code: storeOptions.length === 1 ? storeOptions[0].value : null, warehouse_code: whOptions.length === 1 ? whOptions[0].value : null, sku: null, quantity: '', batch_no: '', mfg_date: null };
  const [form, setForm] = useState(blank);
  const [fErr, setFErr] = useState({});
  const [upload, setUpload] = useState(null);   // { file_name, total_rows, valid, errors }
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(true);
  const fileRef = useRef(null);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFErr((e) => ({ ...e, [k]: null })); };

  const addLine = () => {
    const e = {};
    if (!form.inv_date) e.inv_date = 'Pick a date';
    else if (form.inv_date < today) e.inv_date = 'Past dates are not allowed';
    if (!form.store_code) e.store_code = 'Pick a store';
    if (!form.warehouse_code) e.warehouse_code = 'Pick a warehouse';
    if (!form.sku) e.sku = 'Pick a SKU';
    if (!/^\d+$/.test(String(form.quantity)) || Number(form.quantity) < 1) e.quantity = 'Whole cases, 1 or more';
    if (form.mfg_date && form.inv_date && form.mfg_date > form.inv_date) e.mfg_date = 'Must not be after the date';
    setFErr(e);
    if (Object.keys(e).length) return;
    setLines((ls) => [...ls, {
      id: lineSeq++, source: 'manual', inv_date: form.inv_date, store_code: form.store_code, store_name: storeName(form.store_code),
      warehouse_code: form.warehouse_code, warehouse_name: whName(form.warehouse_code),
      sku_code: form.sku.code, sku_name: form.sku.name, quantity: Number(form.quantity),
      batch_no: form.batch_no.trim() || null, mfg_date: form.mfg_date || null,
    }]);
    // keep date / store / warehouse for fast repeated entry
    setForm((f) => ({ ...f, sku: null, quantity: '', batch_no: '', mfg_date: null }));
  };

  const pickFile = () => {
    if (Platform.OS !== 'web') { showAlert('Upload', 'Excel upload is available on the web version.'); return; }
    fileRef.current?.click();
  };
  const onFile = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { showAlert('Upload', 'Please choose the .xlsx template file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showAlert('Upload', 'The file is larger than 5 MB.'); return; }
    setChecking(true); setUpload(null);
    try {
      const res = await inventoryAPI.uploadCheck(file);
      setUpload(res); setShowErrors(true);
      if (res.valid.length) {
        setLines((ls) => [...ls, ...res.valid.map((v) => ({ ...v, id: lineSeq++, source: 'upload', file_name: res.file_name }))]);
      }
    } catch (e) {
      showAlert('Upload', errDetail(e).message || 'Could not read the file');
    } finally { setChecking(false); }
  };
  const downloadTemplate = async () => {
    if (Platform.OS !== 'web') { showAlert('Template', 'Template download is available on the web version.'); return; }
    setTplBusy(true);
    try { saveBlob(await inventoryAPI.template(), 'Inventory_Upload_Template.xlsx'); }
    catch (e) { showAlert('Template', handleAPIError(e)); }
    finally { setTplBusy(false); }
  };

  const totalCases = lines.reduce((s, l) => s + (l.quantity || 0), 0);
  const submitAll = () => {
    if (!lines.length) return;
    confirmAction({
      title: 'Submit All',
      message: `Save ${lines.length} line(s), ${totalCases.toLocaleString('en-IN')} case(s)? Lines can't be edited or deleted after saving.`,
      confirmText: 'Submit All',
      onConfirm: async () => {
        setSubmitting(true);
        const fromUpload = lines.find((l) => l.source === 'upload');
        try {
          const res = await inventoryAPI.submit({
            source: fromUpload ? 'upload' : 'manual',
            file_name: fromUpload?.file_name || null,
            lines: lines.map(({ inv_date, store_code, warehouse_code, sku_code, sku_name, quantity, batch_no, mfg_date }) => ({
              inv_date, store_code, warehouse_code, sku_code, sku_name, quantity, batch_no, mfg_date,
            })),
          });
          const bad = new Map(res.errors.map((er) => [er.index, er.error]));
          setLines((ls) => ls.map((l, i) => ({ ...l, error: bad.get(i) || null })).filter((l) => l.error));
          setUpload(null);
          showAlert('Saved', `${res.saved} line(s) saved.${res.errors.length ? ` ${res.errors.length} line(s) were not saved — see the reasons in the list.` : ''}`);
        } catch (e) {
          const d = errDetail(e);
          if (Array.isArray(d.errors)) {
            const bad = new Map(d.errors.map((er) => [er.index, er.error]));
            setLines((ls) => ls.map((l, i) => ({ ...l, error: bad.get(i) || null })));
          }
          showAlert('Not saved', d.message || 'Could not save');
        } finally { setSubmitting(false); }
      },
    });
  };
  const clearAll = () => confirmAction({
    title: 'Clear list', message: 'Remove all lines that are not yet submitted?', confirmText: 'Clear', destructive: true,
    onConfirm: () => { setLines([]); setUpload(null); },
  });

  return (
    <View style={{ gap: 16 }}>
      {/* Bulk upload */}
      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <MaterialIcons name="upload-file" size={22} color={C.green} />
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>Bulk upload</Text>
            <Text style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>
              Fill the template (max 5,000 rows, 5 MB). Correct rows are added to the list below; rows with errors are listed with the reason.
            </Text>
          </View>
          <Btn label="Download Template" icon="download" kind="outline" onPress={downloadTemplate} busy={tplBusy} small />
          <Btn label="Upload Excel" icon="upload" onPress={pickFile} busy={checking} small />
          {Platform.OS === 'web' && (
            <input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} style={{ display: 'none' }} data-testid="inv-file" />
          )}
        </View>
        {upload && (
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#EEF3F1', paddingTop: 12 }}>
            <Text style={{ fontSize: 13.5, color: C.text }}>
              <Text style={{ fontWeight: '700' }}>{upload.file_name}</Text>: {upload.total_rows} row(s) read ·{' '}
              <Text style={{ color: '#1E8A4C', fontWeight: '700' }}>{upload.valid.length} added to the list</Text>
              {upload.errors.length ? <Text style={{ color: C.red, fontWeight: '700' }}> · {upload.errors.length} with errors</Text> : null}
            </Text>
            {upload.errors.length > 0 && (
              <>
                <TouchableOpacity onPress={() => setShowErrors((s) => !s)} style={{ marginTop: 6 }}>
                  <Text style={{ color: C.green, fontWeight: '700', fontSize: 12.5 }}>{showErrors ? 'Hide' : 'Show'} error rows</Text>
                </TouchableOpacity>
                {showErrors && (
                  <ScrollView style={{ maxHeight: 220, marginTop: 6, backgroundColor: '#FDF3F3', borderRadius: 10, padding: 10 }} nestedScrollEnabled>
                    {upload.errors.map((er, i) => (
                      <Text key={i} style={{ fontSize: 12.5, color: '#7A1F1F', marginBottom: 3 }}>
                        <Text style={{ fontWeight: '700' }}>Row {er.row}:</Text> {er.error}
                      </Text>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* Single line */}
      <View style={[card, { zIndex: 20 }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 }}>Add single line</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, zIndex: 30 }}>
          <Field title="Date *" minWidth={160} flex={0.8}>
            <DateField value={dateOf(form.inv_date)} minDate={dateOf(today)} onChange={(d) => set('inv_date', isoOf(d))} />
            {fErr.inv_date ? <Text style={{ color: C.red, fontSize: 12 }}>{fErr.inv_date}</Text> : null}
          </Field>
          <Field title="Blinkit store *" z={40}>
            <SearchSelect name="Blinkit store" options={storeOptions} value={form.store_code} onChange={(v) => set('store_code', v)} placeholder="Select store" error={fErr.store_code} />
            {fErr.store_code ? <Text style={{ color: C.red, fontSize: 12 }}>{fErr.store_code}</Text> : null}
          </Field>
          <Field title="BIPL warehouse *" z={39}>
            <SearchSelect name="BIPL warehouse" options={whOptions} value={form.warehouse_code} onChange={(v) => set('warehouse_code', v)} placeholder="Select warehouse" error={fErr.warehouse_code} />
            {fErr.warehouse_code ? <Text style={{ color: C.red, fontSize: 12 }}>{fErr.warehouse_code}</Text> : null}
          </Field>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, zIndex: 20 }}>
          <Field title="SKU *" flex={2} minWidth={260} z={38}>
            <SkuPicker value={form.sku} onChange={(v) => set('sku', v)} error={fErr.sku} />
            {fErr.sku ? <Text style={{ color: C.red, fontSize: 12 }}>{fErr.sku}</Text> : null}
          </Field>
          <Field title="Quantity (cases) *" minWidth={130} flex={0.6}>
            <TextInput value={String(form.quantity)} onChangeText={(v) => set('quantity', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted} style={inputStyle(fErr.quantity)}
              accessibilityLabel="Quantity (cases)" onSubmitEditing={addLine} />
            {fErr.quantity ? <Text style={{ color: C.red, fontSize: 12 }}>{fErr.quantity}</Text> : null}
          </Field>
          <Field title="Batch (optional)" minWidth={140} flex={0.7}>
            <TextInput value={form.batch_no} onChangeText={(v) => set('batch_no', v)} maxLength={100}
              placeholder="Batch no." placeholderTextColor={C.muted} style={inputStyle(false)} accessibilityLabel="Batch" />
          </Field>
          <Field title="Mfg. date (optional)" minWidth={160} flex={0.8}>
            <DateField value={dateOf(form.mfg_date)} maxDate={dateOf(form.inv_date)} onChange={(d) => set('mfg_date', isoOf(d))} placeholder="Optional" />
            {fErr.mfg_date ? <Text style={{ color: C.red, fontSize: 12 }}>{fErr.mfg_date}</Text> : null}
          </Field>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn label="Add to list" icon="playlist-add" onPress={addLine} testID="inv-add" />
        </View>
      </View>

      {/* Pending list */}
      <View style={card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, flex: 1 }}>
            Lines to submit <Text style={{ color: C.sub, fontWeight: '400', fontSize: 13.5 }}>· {lines.length} line(s) · {totalCases.toLocaleString('en-IN')} case(s)</Text>
          </Text>
          <Btn label="Clear" icon="delete-sweep" kind="danger" onPress={clearAll} disabled={!lines.length || submitting} small />
          <Btn label="Submit All" icon="cloud-upload" onPress={submitAll} disabled={!lines.length} busy={submitting} small testID="inv-submit" />
        </View>
        {lines.length === 0 ? (
          <Text style={{ color: C.muted, fontSize: 13, paddingVertical: 16, textAlign: 'center' }}>
            No lines yet — add a line above or upload the Excel template.
          </Text>
        ) : (
          <ScrollView horizontal>
            <View style={{ minWidth: 900, flex: 1 }}>
              <Row head cells={['Date', 'Store', 'Warehouse', 'SKU', 'Cases', 'Batch', 'Mfg. date', '']} widths={ENTRY_W} />
              {lines.map((l) => (
                <View key={l.id}>
                  <Row
                    widths={ENTRY_W}
                    cells={[
                      ddmmyyyy(l.inv_date), `${l.store_code}${l.store_name ? ` · ${l.store_name}` : ''}`,
                      `${l.warehouse_code}${l.warehouse_name ? ` · ${l.warehouse_name}` : ''}`,
                      `${l.sku_name || ''} (${l.sku_code})`, String(l.quantity), l.batch_no || '—',
                      l.mfg_date ? ddmmyyyy(l.mfg_date) : '—',
                      <TouchableOpacity key="x" onPress={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                        accessibilityRole="button" accessibilityLabel="Remove line" style={{ padding: 4 }}>
                        <MaterialIcons name="close" size={18} color={C.red} />
                      </TouchableOpacity>,
                    ]}
                    tint={l.error ? '#FDF3F3' : null}
                  />
                  {l.error ? <Text style={{ color: C.red, fontSize: 12, paddingHorizontal: 14, paddingBottom: 6, backgroundColor: '#FDF3F3' }}>{l.error}</Text> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
const ENTRY_W = [100, 170, 190, 250, 70, 100, 100, 44];

function Row({ cells, widths, head, tint }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: head ? 9 : 8,
      backgroundColor: head ? '#F4FAF7' : tint || '#fff', borderTopWidth: head ? 0 : 1, borderTopColor: '#EEF3F1',
    }}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: widths[i], flexGrow: i === 3 ? 1 : 0, paddingHorizontal: 6 }}>
          {typeof c === 'string' || typeof c === 'number' ? (
            <Text style={head ? { fontSize: 11.5, fontWeight: '700', color: C.sub, letterSpacing: 0.5 } : { fontSize: 13, color: '#2B3A42' }} numberOfLines={2}>{c}</Text>
          ) : c}
        </View>
      ))}
    </View>
  );
}

// ── Inventory View (one date) / History (range) ──────────────────────────────
const PAGE = 25;

function EntriesPage({ mode, lookups, active }) {
  const today = lookups.today;
  const viewer = lookups.kind === 'viewer';
  const max = lookups.max_search_days || 92;
  const [day, setDay] = useState(today);
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [whSel, setWhSel] = useState([]);
  const [custSel, setCustSel] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  const range = mode === 'view' ? [day, day] : [from, to];
  const rangeErr = !range[0] || !range[1] ? 'Pick the dates'
    : range[1] < range[0] ? "'To' date is before 'From' date"
      : daysBetween(range[0], range[1]) > max ? `Please choose at most ${max} days` : '';
  const params = useMemo(() => ({
    date_from: range[0], date_to: range[1],
    warehouses: whSel.join(',') || undefined, stores: custSel.join(',') || undefined,
  }), [range[0], range[1], whSel, custSel]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [params]);
  useEffect(() => {
    if (!active) return undefined;
    if (rangeErr) { setData(null); return undefined; }
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await inventoryAPI.entries({ ...params, page, page_size: PAGE });
        if (!cancelled) setData(res);
      } catch (e) { if (!cancelled) setErr(handleAPIError(e)); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params, page, rangeErr, active]);   // re-reads when the page is shown again

  const doExport = async () => {
    if (Platform.OS !== 'web') { showAlert('Export', 'Excel export is available on the web version.'); return; }
    setExporting(true);
    try { saveBlob(await inventoryAPI.exportXlsx(params), `Inventory_${range[0]}_to_${range[1]}.xlsx`); }
    catch (e) { showAlert('Export', handleAPIError(e)); }
    finally { setExporting(false); }
  };

  const whOptions = lookups.warehouses.map((w) => ({ value: w.code, label: w.name ? `${w.code} — ${w.name}` : w.code }));
  const custOptions = lookups.stores.map((c) => ({ value: c.code, label: c.label }));
  const storeLabel = (r) => `${r.store_code}${r.store_name ? ` · ${r.store_name}` : ''}`;
  const cols = viewer
    ? [['Date', 100], ['Blinkit store', 190], ['BIPL warehouse', 200], ['SKU', 260], ['Cases', 80], ['Updated', 150]]
    : [['Date', 96], ['Blinkit store', 170], ['BIPL warehouse', 180], ['SKU', 210], ['Cases', 64], ['Batch', 90], ['Mfg. date', 96], ['Entered by', 100], ['Updated', 140]];
  const cellsOf = (r) => (viewer
    ? [ddmmyyyy(r.inv_date), storeLabel(r), r.warehouse_name || '—', r.sku_name || '—', String(r.quantity), stamp(r.updated_at)]
    : [ddmmyyyy(r.inv_date), storeLabel(r), `${r.warehouse_code}${r.warehouse_name ? ` · ${r.warehouse_name}` : ''}`,
      `${r.sku_name || ''} (${r.sku_code})`, String(r.quantity), r.batch_no || '—', r.mfg_date ? ddmmyyyy(r.mfg_date) : '—',
      r.created_by || '—', stamp(r.updated_at)]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <View style={{ gap: 14 }}>
      <View style={[card, { zIndex: 20 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {mode === 'view' ? (
            <Field title="Date" minWidth={170} flex={0}>
              <DateField value={dateOf(day)} onChange={(d) => setDay(isoOf(d))} />
            </Field>
          ) : (
            <>
              <Field title="From" minWidth={170} flex={0}>
                <DateField value={dateOf(from)} onChange={(d) => setFrom(isoOf(d))} />
              </Field>
              <Field title="To" minWidth={170} flex={0}>
                <DateField value={dateOf(to)} onChange={(d) => setTo(isoOf(d))} />
              </Field>
            </>
          )}
          <Field title="Warehouses" minWidth={220} z={40}>
            <SearchMultiSelect name="Warehouses" options={whOptions} selected={whSel} onChange={setWhSel} allLabel="All warehouses" />
          </Field>
          {!viewer && (
            <Field title="Blinkit stores" minWidth={220} z={39}>
              <SearchMultiSelect name="Blinkit stores" options={custOptions} selected={custSel} onChange={setCustSel} allLabel="All stores" />
            </Field>
          )}
          <Btn label="Export to Excel" icon="download" onPress={doExport} busy={exporting} disabled={!!rangeErr || !data?.total} />
        </View>
        {mode === 'history' ? (
          <Text style={{ fontSize: 12, color: rangeErr ? C.red : C.muted, marginTop: 8 }}>
            {rangeErr || `Up to ${max} days per search. Older records are kept — just pick older dates.`}
          </Text>
        ) : rangeErr ? <Text style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{rangeErr}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Lines" value={data ? data.total.toLocaleString('en-IN') : '—'} icon="list-alt" />
        <Stat label="Total cases" value={data ? data.total_cases.toLocaleString('en-IN') : '—'} icon="inventory-2" />
      </View>

      <View style={[card, { padding: 0, overflow: 'hidden' }]}>
        {err ? <Text style={{ color: C.red, padding: 16 }}>{err}</Text> : null}
        <ScrollView horizontal>
          <View style={{ minWidth: cols.reduce((s, c) => s + c[1], 16), flex: 1 }}>
            <Row head cells={cols.map((c) => c[0])} widths={cols.map((c) => c[1])} />
            {loading && !data ? <ActivityIndicator style={{ margin: 24 }} color={C.green} /> : null}
            {data && data.results.map((r) => <Row key={r.id} cells={cellsOf(r)} widths={cols.map((c) => c[1])} />)}
            {data && data.results.length === 0 ? (
              <Text style={{ color: C.muted, padding: 24, textAlign: 'center' }}>No inventory for the selected filters.</Text>
            ) : null}
          </View>
        </ScrollView>
        {data && data.total > PAGE && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#EEF3F1' }}>
            {loading ? <ActivityIndicator size="small" color={C.green} /> : null}
            <Text style={{ fontSize: 12.5, color: C.sub }}>Page {page} of {pages}</Text>
            <Btn label="Previous" kind="outline" small onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} />
            <Btn label="Next" kind="outline" small onPress={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} />
          </View>
        )}
      </View>
    </View>
  );
}

// ── Page frame ───────────────────────────────────────────────────────────────
const TABS = {
  dashboard: { label: 'Dashboard', icon: 'dashboard' },
  entry: { label: 'Inventory Entry', icon: 'add-box' },
  view: { label: 'Inventory View', icon: 'visibility' },
  history: { label: 'Inventory History', icon: 'history' },
};

export default function InventoryPortal() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const fixedNav = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
  const [user, setUser] = useState(null);
  const [lookups, setLookups] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(null);
  const [visited, setVisited] = useState({});
  const [lines, setLines] = useState([]);   // unsaved entry lines survive tab switches

  useEffect(() => {
    getCurrentUser().then(setUser);
    inventoryAPI.lookups()
      .then((l) => { setLookups(l); const first = l.kind === 'operator' ? 'dashboard' : 'view'; setTab(first); setVisited({ [first]: true }); })
      .catch((e) => setError(handleAPIError(e)));
  }, []);

  // Warn before closing / reloading the browser tab with unsaved lines.
  useEffect(() => {
    if (Platform.OS !== 'web' || !lines.length) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [lines.length]);

  const tabs = !lookups ? [] : lookups.kind === 'operator' ? ['dashboard', 'entry', 'view', 'history'] : ['view', 'history'];
  const go = (t) => { setTab(t); setVisited((v) => ({ ...v, [t]: true })); };
  const isItAdmin = (user?.roles || []).includes('itadmin');
  const appNav = !lookups ? null : {
    title: 'Blinkit Inventory Portal',
    items: tabs.map((t) => ({
      key: t, label: TABS[t].label, icon: TABS[t].icon, active: tab === t, onPress: () => go(t),
      badge: t === 'entry' && lines.length ? String(lines.length) : null,
    })),
  };

  return (
    <AppShell
      appNav={appNav}
      title="Blinkit Inventory Portal"
      backLabel={isItAdmin ? 'Admin Hub' : undefined}
      onBack={isItAdmin ? () => router.replace('/admin-hub') : undefined}
    >
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={[card, { alignItems: 'center', gap: 8 }]}>
            <MaterialIcons name="block" size={32} color={C.red} />
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>Inventory Portal unavailable</Text>
            <Text style={{ color: C.sub, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : !lookups ? (
          <ActivityIndicator size="large" color={C.green} style={{ marginTop: 40 }} />
        ) : (
          <>
            {!fixedNav && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                {tabs.map((t) => (
                  <TouchableOpacity key={t} onPress={() => go(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 20,
                      backgroundColor: tab === t ? C.green : '#fff', borderWidth: 1, borderColor: tab === t ? C.green : C.border,
                    }}>
                    <MaterialIcons name={TABS[t].icon} size={16} color={tab === t ? '#fff' : C.green} />
                    <Text style={{ color: tab === t ? '#fff' : C.text, fontWeight: '700', fontSize: 13 }}>
                      {TABS[t].label}{t === 'entry' && lines.length ? ` (${lines.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {lookups.kind === 'operator' && (lookups.warehouses.length === 0 || lookups.stores.length === 0) && (
              <View style={[card, { backgroundColor: '#FFF8E6', borderColor: '#F3D58A', marginBottom: 14 }]}>
                <Text style={{ color: '#7A5A00', fontSize: 13.5 }}>
                  Your account has no {lookups.warehouses.length === 0 ? 'warehouses' : 'Blinkit stores'} mapped yet. Please ask IT Admin to update your access.
                </Text>
              </View>
            )}
            {visited.dashboard && <View style={{ display: tab === 'dashboard' ? 'flex' : 'none' }}><DashboardPage user={user} onGo={go} active={tab === 'dashboard'} /></View>}
            {visited.entry && <View style={{ display: tab === 'entry' ? 'flex' : 'none' }}><EntryPage lookups={lookups} lines={lines} setLines={setLines} /></View>}
            {visited.view && <View style={{ display: tab === 'view' ? 'flex' : 'none' }}><EntriesPage mode="view" lookups={lookups} active={tab === 'view'} /></View>}
            {visited.history && <View style={{ display: tab === 'history' ? 'flex' : 'none' }}><EntriesPage mode="history" lookups={lookups} active={tab === 'history'} /></View>}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}
