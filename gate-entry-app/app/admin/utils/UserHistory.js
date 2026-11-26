// app/admin/utils/UserHistory.js - "History" card in Assign Access (26 Nov 2026).
// The latest audit-trail rows about one user (access changes, disable /
// enable, password resets, failed logins ...) + a full Excel download.
// Before the security migration is applied it just says so.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { securityAPI, handleAPIError } from '../../../services/api';
import { saveBlob, blobErrorMessage, canDownload, today } from '../../../utils/download';
import { showAlert } from '../../../utils/customModal';

export const fmtStamp = (iso) => {
  if (!iso) return '—';
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

export const ACTION_COLOR = {
  user_deleted: '#A32D2D', user_deactivated: '#A32D2D', login_failed: '#A35F00',
  user_activated: '#0F6B46', user_created: '#0F6B46', password_reset: '#534AB7',
};

export default function UserHistory({ username, refreshKey, cardStyle, titleStyle }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setData(null); setErr('');
    securityAPI.getAudit({ username, page_size: 8 })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(handleAPIError(e)); });
    return () => { cancelled = true; };
  }, [username, refreshKey]);

  const download = async () => {
    if (!canDownload()) { showAlert('Download', 'Excel download is available on the web version.'); return; }
    setBusy(true);
    try { saveBlob(await securityAPI.exportAudit({ username }), `Audit_Trail_${username}_${today()}.xlsx`); }
    catch (e) { showAlert('Download', await blobErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[titleStyle, { marginBottom: 0, flex: 1 }]}>History</Text>
        {data?.ready && data.total > 0 ? (
          <TouchableOpacity onPress={download} disabled={busy} accessibilityRole="button" accessibilityLabel="Download full history">
            {busy ? <ActivityIndicator size="small" color="#0F6B46" />
              : <Text style={{ color: '#0F6B46', fontWeight: '700', fontSize: 12.5 }}>⬇ Download full history ({data.total})</Text>}
          </TouchableOpacity>
        ) : null}
      </View>
      {err ? <Text style={{ fontSize: 13, color: '#C62828' }}>{err}</Text>
        : !data ? <ActivityIndicator color="#0F6B46" />
          : !data.ready ? (
            <Text style={{ fontSize: 13, color: '#8B99A3' }}>
              History starts once the security database update is applied (alembic upgrade b9e4d2a7c1f5).
            </Text>
          ) : data.results.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#8B99A3' }}>No changes recorded for this user yet.</Text>
          ) : data.results.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#EEF3F1', flexWrap: 'wrap' }}>
              <Text style={{ width: 150, fontSize: 12, color: '#5B6B75' }}>{fmtStamp(a.at)}</Text>
              <Text style={{ width: 160, fontSize: 12.5, fontWeight: '700', color: ACTION_COLOR[a.action] || '#2B3A42' }}>{a.action_label}</Text>
              <View style={{ flex: 1, minWidth: 220 }}>
                {a.detail ? <Text style={{ fontSize: 12.5, color: '#2B3A42' }}>{a.detail}</Text> : null}
                <Text style={{ fontSize: 11.5, color: '#8B99A3' }}>
                  by {a.actor}{a.reason ? ` · reason: ${a.reason}` : ''}
                </Text>
              </View>
            </View>
          ))}
    </View>
  );
}
