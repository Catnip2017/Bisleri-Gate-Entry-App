// components/ui/DocumentLibrary.js - One Documents page (27 Nov 2026):
// lists the PDFs the server finds in its folder (PSD_FOLDER / GUIDES_FOLDER
// in the backend .env) and downloads them through the signed-in session.
//   kind 'psd'    -> Process Solution Documents (IT Admin only)
//   kind 'guides' -> User Guides (every signed-in user)
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from './AppShell';
import DocumentList from './DocumentList';
import { libraryAPI, handleAPIError } from '../../services/api';
import { getCurrentUser, goToMyHome } from '../../utils/jwtUtils';
import { showAlert } from '../../utils/customModal';
import { saveBlob, blobErrorMessage } from '../../utils/download';

const fmtDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function DocumentLibrary({ kind, title, itAdminOnly = false }) {
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) return;                       // AppShell sends signed-out visitors to login
      if (itAdminOnly && !(u.roles || []).includes('itadmin')) {
        showAlert('Access Denied', `${title} are available to IT Admin only.`);
        goToMyHome(router);
        return;
      }
      try {
        const res = await libraryAPI.list(kind);
        setRows((res.documents || []).map((d) => ({
          key: d.file, file: d.file, name: d.name, version: d.version,
          updatedLabel: `Updated ${fmtDate(d.updated)} · ${Math.max(1, Math.round(d.size / 1024))} KB`,
        })));
      } catch (e) {
        setError(handleAPIError(e));
        setRows([]);
      }
    })();
  }, [kind]);

  const download = async (row) => {
    if (Platform.OS !== 'web') { showAlert('Download', 'Downloads are available on the web version.'); return; }
    setBusy(row.key);
    try { saveBlob(await libraryAPI.download(kind, row.file), row.file); }
    catch (e) { showAlert('Download', await blobErrorMessage(e)); }
    finally { setBusy(null); }
  };

  return (
    <AppShell title={title} backLabel="Back">
      <View style={{ flex: 1, padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        {rows === null ? <ActivityIndicator color="#0F6B46" style={{ marginTop: 30 }} /> : (
          <>
            {error ? <Text style={{ color: '#C62828', marginBottom: 10 }}>{error}</Text> : null}
            {rows.length > 0 ? (
              <Text style={{ fontSize: 12.5, color: '#5B6B75', marginBottom: 10 }}>
                {rows.length} document{rows.length === 1 ? '' : 's'} · latest version of each
              </Text>
            ) : null}
            <DocumentList rows={rows} onDownload={download} busyKey={busy}
              emptyText={error ? 'Documents could not be loaded.' : 'No documents yet.'} />
          </>
        )}
      </View>
    </AppShell>
  );
}
