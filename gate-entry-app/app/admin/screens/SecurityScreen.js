// app/admin/screens/SecurityScreen.js - "Security" tab of User Management
// (26 Nov 2026, IT Admin only).
//
//   Alerts       dormant accounts found by the nightly check (inactive 90
//                days, warning from day 75, never used in 30 days). Nothing
//                is ever disabled automatically — open the user and decide.
//   Audit trail  every access change, disable/enable, delete, password
//                reset, failed login and settings change; filter + Excel.
//   Settings     the limits, alert switches, alert email recipients and
//                exempt users, with their own change history.
//
// Needs migration b9e4d2a7c1f5; before that the tab says so plainly.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Switch } from 'react-native';
import { securityAPI, adminAPI, handleAPIError } from '../../../services/api';
import { showAlert, confirmAction } from '../../../utils/customModal';
import { saveBlob, blobErrorMessage, canDownload, today } from '../../../utils/download';
import DateField from '../../../components/ui/DateField';
import { SearchMultiSelect } from '../../../components/ui/SearchSelect';
import ResultBar from '../../../components/ui/ResultBar';
import { fmtStamp, ACTION_COLOR } from '../utils/UserHistory';

const C = { green: '#0F6B46', deep: '#00604F', text: '#12202A', sub: '#5B6B75', muted: '#8B99A3', line: '#E0E9E5', red: '#C62828', amber: '#A35F00' };
const CARD = { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 16 };
const TITLE = { fontSize: 11.5, fontWeight: '700', color: C.green, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 };
const INPUT = { borderWidth: 1.5, borderColor: '#CFDDD7', borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: C.text, backgroundColor: '#fff' };
const pointer = Platform.OS === 'web' ? { cursor: 'pointer' } : {};
const KIND = {
  inactive: { label: 'Inactive', color: '#A32D2D', bg: '#FCEBEB' },
  inactive_warning: { label: 'Inactive soon', color: '#856404', bg: '#FFF3CD' },
  never_used: { label: 'Never used', color: '#534AB7', bg: '#EEEDFE' },
};
const iso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined);

function Btn({ label, onPress, kind = 'primary', busy, disabled, small }) {
  const outline = kind !== 'primary';
  return (
    <TouchableOpacity
      onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={label}
      style={[{
        borderRadius: 8, paddingVertical: small ? 6 : 10, paddingHorizontal: small ? 12 : 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: outline ? '#fff' : C.green, borderWidth: 1.5, borderColor: kind === 'danger' ? C.red : C.green,
        opacity: disabled ? 0.45 : 1, minHeight: small ? 32 : 40,
      }, pointer]}>
      {busy ? <ActivityIndicator size="small" color={outline ? C.green : '#fff'} />
        : <Text style={{ color: outline ? (kind === 'danger' ? C.red : C.green) : '#fff', fontWeight: '700', fontSize: small ? 12.5 : 13.5 }}>{label}</Text>}
    </TouchableOpacity>
  );
}

function NotReady() {
  return (
    <View style={[CARD, { backgroundColor: '#FFF8E6', borderColor: '#F3D58A' }]}>
      <Text style={{ color: '#7A5A00', fontSize: 13.5, lineHeight: 20 }}>
        Security features are not set up on this database yet. Ask the server admin to run
        {' '}<Text style={{ fontWeight: '700' }}>alembic upgrade b9e4d2a7c1f5</Text> in bisleri-backend, then reload this page.
      </Text>
    </View>
  );
}

// ── Alerts ───────────────────────────────────────────────────────────────────
function AlertsPanel({ onOpenUser, onCount }) {
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const d = await securityAPI.getAlerts(status);
      setData(d);
      onCount?.(d.open_count || 0);
    } catch (e) { setErr(handleAPIError(e)); setData({ alerts: [] }); }
  }, [status]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const r = await securityAPI.runCheckNow();
      if (r.skipped) showAlert('Alert check', `Not run: ${r.skipped}.`);
      else showAlert('Alert check', `${r.new} new alert(s), ${r.open} account(s) need attention, ${r.resolved} closed automatically. No account was disabled.`);
      load();
    } catch (e) { showAlert('Alert check', handleAPIError(e)); }
    finally { setRunning(false); }
  };

  const dismiss = (a) => confirmAction({
    title: 'Dismiss alert',
    message: `Dismiss the "${KIND[a.kind]?.label || a.kind}" alert for ${a.username}? The account is not changed. It will not be raised again unless the user uses the app and later goes quiet again.`,
    confirmText: 'Dismiss',
    onConfirm: async () => {
      try { await securityAPI.dismissAlert(a.id); load(); }
      catch (e) { showAlert('Dismiss', handleAPIError(e)); }
    },
  });

  if (data && data.ready === false) return <NotReady />;
  const counts = (data?.alerts || []).reduce((m, a) => ({ ...m, [a.kind]: (m[a.kind] || 0) + 1 }), {});

  return (
    <View style={{ gap: 14 }}>
      <View style={[CARD, { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }]}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Dormant-account alerts</Text>
          <Text style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 18 }}>
            Built every night at 01:40. Nothing is disabled automatically — open the user to disable or delete by hand, or dismiss the alert.
          </Text>
        </View>
        {['open', 'dismissed', 'resolved', 'all'].map((s) => (
          <TouchableOpacity key={s} onPress={() => setStatus(s)} accessibilityRole="button"
            style={[{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5,
              borderColor: status === s ? C.green : '#CFDDD7', backgroundColor: status === s ? C.green : '#fff' }, pointer]}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: status === s ? '#fff' : C.text, textTransform: 'capitalize' }}>{s}</Text>
          </TouchableOpacity>
        ))}
        <Btn label="Run check now" kind="outline" onPress={runNow} busy={running} small />
      </View>

      {data?.inapp === false && status === 'open' ? (
        <Text style={{ fontSize: 12.5, color: C.amber }}>In-app alerts are switched off in Settings — the list still fills, but the tab badge is hidden.</Text>
      ) : null}
      {err ? <Text style={{ color: C.red }}>{err}</Text> : null}
      {!data ? <ActivityIndicator color={C.green} /> : (
        <View style={[CARD, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: '#EEF3F1' }}>
            <Text style={{ fontSize: 12.5, color: C.sub, fontWeight: '600' }}>{data.alerts.length} alert(s)</Text>
            {Object.entries(counts).map(([k, n]) => (
              <View key={k} style={{ backgroundColor: KIND[k]?.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: KIND[k]?.color }}>{KIND[k]?.label || k}: {n}</Text>
              </View>
            ))}
          </View>
          {data.alerts.length === 0 ? (
            <Text style={{ padding: 24, textAlign: 'center', color: C.muted }}>
              {status === 'open' ? 'No open alerts — every active account has been used recently.' : 'Nothing here.'}
            </Text>
          ) : data.alerts.map((a) => {
            const k = KIND[a.kind] || { label: a.kind, color: C.text, bg: '#eee' };
            return (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF3F1', flexWrap: 'wrap' }}>
                <View style={{ width: 110 }}>
                  <View style={{ backgroundColor: k.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: k.color }}>{k.label}</Text>
                  </View>
                </View>
                <View style={{ flex: 1.2, minWidth: 160 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.text }} numberOfLines={1}>{a.name || a.username}</Text>
                  <Text style={{ fontSize: 12, color: C.sub }} numberOfLines={1}>{a.username}{a.role ? ` · ${a.role}` : ''}{a.exists ? (a.is_active ? '' : ' · disabled') : ' · deleted'}</Text>
                </View>
                <Text style={{ flex: 2, minWidth: 220, fontSize: 12.5, color: '#2B3A42' }}>{a.message}</Text>
                <Text style={{ width: 130, fontSize: 11.5, color: C.muted }}>
                  {a.status === 'open' ? `raised ${fmtStamp(a.created_at)}` : `${a.status} by ${a.handled_by || '—'}`}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {a.exists ? <Btn label="Open user" kind="outline" small onPress={() => onOpenUser(a.username)} /> : null}
                  {a.status === 'open' ? <Btn label="Dismiss" kind="outline" small onPress={() => dismiss(a)} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Audit trail ──────────────────────────────────────────────────────────────
const PAGE = 25;
function AuditPanel() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; });
  const [to, setTo] = useState(new Date());
  const [actions, setActions] = useState([]);
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const params = useMemo(() => ({
    date_from: iso(from), date_to: iso(to), action: actions.join(',') || undefined, q: q.trim() || undefined,
  }), [from, to, actions, q]);
  const dateErr = from && to && from > to ? "'To' date is before 'From' date" : '';

  useEffect(() => { setPage(1); }, [params]);
  useEffect(() => {
    if (dateErr) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true); setErr('');
      try {
        const d = await securityAPI.getAudit({ ...params, page, page_size: PAGE });
        if (!cancelled) { setData(d); setLabels(d.actions || {}); }
      } catch (e) { if (!cancelled) setErr(handleAPIError(e)); }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [params, page, dateErr]);

  const download = async () => {
    if (!canDownload()) { showAlert('Download', 'Excel download is available on the web version.'); return; }
    setBusy(true);
    try { saveBlob(await securityAPI.exportAudit(params), `Audit_Trail_${today()}.xlsx`); }
    catch (e) { showAlert('Download', await blobErrorMessage(e)); }
    finally { setBusy(false); }
  };

  if (data && data.ready === false) return <NotReady />;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const actionOptions = Object.entries(labels).map(([value, label]) => ({ value, label }));

  return (
    <View style={{ gap: 14 }}>
      <View style={[CARD, { zIndex: 20 }]}>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <View style={{ width: 170 }}><DateField label="From" value={from} onChange={setFrom} /></View>
          <View style={{ width: 170 }}><DateField label="To" value={to} onChange={setTo} /></View>
          <View style={{ width: 230, zIndex: 30 }}>
            <SearchMultiSelect title="Action" name="Action" options={actionOptions} selected={actions} onChange={setActions} allLabel="All actions" />
          </View>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>User / done by / reason</Text>
            <TextInput value={qDraft} onChangeText={(t) => { setQDraft(t); if (!t) setQ(''); }} onSubmitEditing={() => setQ(qDraft)}
              placeholder="Type and press Enter" placeholderTextColor={C.muted} autoCapitalize="none" style={INPUT} accessibilityLabel="Search audit trail" />
          </View>
          <Btn label="Download Excel" onPress={download} busy={busy} disabled={!data?.total || !!dateErr} />
        </View>
        {dateErr ? <Text style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{dateErr}</Text> : null}
      </View>

      <View>
        <ResultBar text={data ? `${data.total.toLocaleString()} event(s)${data.total > PAGE ? ` — page ${page} of ${pages}` : ''}` : ''} loading={loading}
          note="Add-only: entries are never edited or deleted" />
        <View style={[CARD, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#F4FAF7' }}>
            {[['WHEN', 150], ['ACTION', 170], ['USER', 120], ['WHAT CHANGED', null], ['DONE BY', 110]].map(([h, w]) => (
              <Text key={h} style={[{ fontSize: 11.5, fontWeight: '700', color: C.sub, letterSpacing: 0.6 }, w ? { width: w } : { flex: 1 }]}>{h}</Text>
            ))}
          </View>
          {err ? <Text style={{ color: C.red, padding: 16 }}>{err}</Text> : null}
          {!data && !err ? <ActivityIndicator style={{ margin: 24 }} color={C.green} /> : null}
          {data && data.results.length === 0 ? <Text style={{ padding: 24, textAlign: 'center', color: C.muted }}>No events for these filters.</Text> : null}
          {data && data.results.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#EEF3F1' }}>
              <Text style={{ width: 150, fontSize: 12, color: C.sub }}>{fmtStamp(a.at)}</Text>
              <Text style={{ width: 170, fontSize: 12.5, fontWeight: '700', color: ACTION_COLOR[a.action] || '#2B3A42' }}>{a.action_label}</Text>
              <Text style={{ width: 120, fontSize: 12.5, color: C.text }} numberOfLines={1}>{a.target_user || '—'}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 12.5, color: '#2B3A42' }}>{a.detail || '—'}</Text>
                {a.reason ? <Text style={{ fontSize: 11.5, color: C.muted }}>reason: {a.reason}</Text> : null}
              </View>
              <Text style={{ width: 110, fontSize: 12.5, color: C.sub }} numberOfLines={1}>{a.actor}</Text>
            </View>
          ))}
          {data && data.total > PAGE ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: '#EEF3F1' }}>
              <Btn label="Previous" kind="outline" small onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} />
              <Text style={{ fontSize: 12.5, color: C.sub }}>Page {page} of {pages}</Text>
              <Btn label="Next" kind="outline" small onPress={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, hint }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 180, minWidth: 170 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>{label}</Text>
      <TextInput value={String(value ?? '')} onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
        maxLength={4} style={INPUT} accessibilityLabel={label} />
      {hint ? <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}
function Toggle({ label, value, onChange, hint, disabled }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled} trackColor={{ true: '#7FC4A6', false: '#ccc' }} thumbColor={value ? C.green : '#f4f3f4'} accessibilityLabel={label} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, color: C.text, fontWeight: '600' }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 11.5, color: C.muted }}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function SettingsPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [userOptions, setUserOptions] = useState([]);

  const toForm = (v) => ({ ...v, alert_emails: (v.alert_emails || []).join(', '), exempt_users: v.exempt_users || [] });
  const load = async () => {
    setErr('');
    try { const d = await securityAPI.getSettings(); setData(d); setForm(toForm(d.values)); }
    catch (e) { if (e?.response?.status === 503) setData({ ready: false }); else setErr(handleAPIError(e)); }
  };
  useEffect(() => {
    load();
    adminAPI.getUsersOverview().then((list) => setUserOptions((list || []).map((u) => ({
      value: u.username, label: `${`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username} (${u.username})`,
    })))).catch(() => {});
  }, []);

  if (data && data.ready === false) return <NotReady />;
  if (err) return <Text style={{ color: C.red }}>{err}</Text>;
  if (!form) return <ActivityIndicator color={C.green} />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(data.values));

  const save = async () => {
    setSaving(true);
    try {
      const d = await securityAPI.saveSettings({
        ...form,
        inactive_days: Number(form.inactive_days), warning_days: Number(form.warning_days), never_used_days: Number(form.never_used_days),
        exempt_users: form.exempt_users.join(', '), reason: reason.trim() || null,
      });
      setData(d); setForm(toForm(d.values)); setReason('');
      showAlert('Saved', 'Security settings saved. They apply from the next alert check.');
    } catch (e) { showAlert('Settings', handleAPIError(e)); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={CARD}>
        <Text style={TITLE}>Dormant-account limits</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <NumField label="Inactive after (days)" value={form.inactive_days} onChange={(v) => set('inactive_days', v)} hint="Alert when an account has not been used this long" />
          <NumField label="Warn from (days)" value={form.warning_days} onChange={(v) => set('warning_days', v)} hint="Early warning before the limit" />
          <NumField label="Never used within (days)" value={form.never_used_days} onChange={(v) => set('never_used_days', v)} hint="Counted from when the account was created" />
        </View>
        <Text style={{ fontSize: 12, color: C.amber, marginTop: 10 }}>Accounts are never disabled automatically. Alerts only — the IT Admin decides.</Text>
      </View>

      <View style={[CARD, { zIndex: 20 }]}>
        <Text style={TITLE}>Alerts</Text>
        <Toggle label="Run the nightly alert check" value={form.alerts_enabled} onChange={(v) => set('alerts_enabled', v)} hint="Every night at 01:40" />
        <Toggle label="Show alerts in the app" value={form.alert_inapp} onChange={(v) => set('alert_inapp', v)} hint="Badge on the Security tab" disabled={!form.alerts_enabled} />
        <Toggle label="Send alert email" value={form.alert_email} onChange={(v) => set('alert_email', v)} disabled={!form.alerts_enabled}
          hint={data.email_configured ? `Sent from ${data.sender} for new alerts` : 'Email is not set up on the server yet (Microsoft Entra details in the backend .env) — alerts stay in the app'} />
        {form.alert_email ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>Alert email recipients</Text>
            <TextInput value={form.alert_emails} onChangeText={(t) => set('alert_emails', t)} placeholder="it.team@bisleri.co.in, someone@bisleri.co.in"
              placeholderTextColor={C.muted} autoCapitalize="none" style={INPUT} accessibilityLabel="Alert email recipients" />
          </View>
        ) : null}
        <View style={{ marginTop: 12, zIndex: 30 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>Exempt users (never alerted)</Text>
          <SearchMultiSelect name="Exempt users" options={userOptions} selected={form.exempt_users}
            onChange={(v) => set('exempt_users', v)} allLabel={null} placeholder="None" />
          <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>e.g. service accounts or users on long leave</Text>
        </View>
      </View>

      <View style={[CARD, { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }]}>
        <TextInput value={reason} onChangeText={setReason} maxLength={500} placeholder="Reason for the change (optional)"
          placeholderTextColor={C.muted} style={[INPUT, { flex: 1, minWidth: 240 }]} accessibilityLabel="Reason for the change" />
        <Btn label="Discard" kind="outline" onPress={() => { setForm(toForm(data.values)); setReason(''); }} disabled={!dirty || saving} />
        <Btn label="Save settings" onPress={save} busy={saving} disabled={!dirty} />
      </View>

      <View style={CARD}>
        <Text style={TITLE}>Change history</Text>
        {data.history.length === 0 ? <Text style={{ fontSize: 13, color: C.muted }}>No changes yet — the defaults agreed on 26 Nov 2026 are in use.</Text>
          : data.history.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: '#EEF3F1', flexWrap: 'wrap' }}>
              <Text style={{ width: 150, fontSize: 12, color: C.sub }}>{fmtStamp(h.at)}</Text>
              <Text style={{ width: 110, fontSize: 12.5, fontWeight: '700', color: C.text }}>{h.by}</Text>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Text style={{ fontSize: 12.5, color: '#2B3A42' }}>
                  {Object.entries(h.changes).map(([k, ch]) => `${data.labels[k] || k}: ${ch.from || '—'} → ${ch.to || '—'}`).join('; ')}
                </Text>
                {h.reason ? <Text style={{ fontSize: 11.5, color: C.muted }}>reason: {h.reason}</Text> : null}
              </View>
            </View>
          ))}
      </View>
    </View>
  );
}

const SUB = ['Alerts', 'Audit trail', 'Settings'];
export default function SecurityScreen({ onOpenUser, onAlertCount }) {
  const [tab, setTab] = useState('Alerts');
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#EEF5F2' }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {SUB.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} accessibilityRole="button" accessibilityState={{ selected: tab === t }}
            style={[{ borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5,
              borderColor: tab === t ? C.green : '#CFDDD7', backgroundColor: tab === t ? C.green : '#fff' }, pointer]}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: tab === t ? '#fff' : C.text }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'Alerts' && <AlertsPanel onOpenUser={onOpenUser} onCount={onAlertCount} />}
      {tab === 'Audit trail' && <AuditPanel />}
      {tab === 'Settings' && <SettingsPanel />}
    </ScrollView>
  );
}
