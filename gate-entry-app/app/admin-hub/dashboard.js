// app/admin-hub/dashboard.js
// Platform-aware embed of the Vehicle/Load Dashboard (React SPA, served by
// bisleri-backend at /dashboard — replaces the old Streamlit-over-iframe
// setup). The gate-entry app's own JWT is forwarded once via ?token=... so
// the dashboard doesn't need a second login; the backend still validates
// that token (itadmin-only) on every /dashboard-api/* call.
//   Web    → native <iframe> (react-native-webview's iframe wrapper doesn't
//             fire onLoadEnd reliably when CSP headers are active)
//   Mobile → react-native-webview (full native WebView)

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AppShell from '../../components/ui/AppShell';
import { API_BASE_URL } from '../../services/api';
import { storage } from '../../utils/storage';

const DASHBOARD_URL = `${API_BASE_URL}/dashboard`;

// ── Lazy-load WebView only on native to avoid web bundle issues ───────────────
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

export default function DashboardScreen() {
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(false);
  const [src,     setSrc]       = useState(null);
  const iframeRef                = useRef(null);

  const buildSrc = async () => {
    const token = await storage.getItem('access_token');
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    setSrc(`${DASHBOARD_URL}?token=${encodeURIComponent(token)}`);
  };

  useEffect(() => {
    buildSrc();
  }, []);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    buildSrc().then(() => {
      // Force iframe reload on web
      if (Platform.OS === 'web' && iframeRef.current && src) {
        iframeRef.current.src = src;
      }
    });
  };

  // ── Error state ─────────────────────────────────────────────────────────────
  const ErrorScreen = () => (
    <View style={styles.overlay}>
      <MaterialIcons name="wifi-off" size={48} color="#718096" />
      <Text style={styles.errorTitle}>Could not reach the dashboard</Text>
      <Text style={styles.errorSub}>
        Make sure the backend is running and reachable at:{'\n'}{DASHBOARD_URL}
      </Text>
      <Pressable style={styles.retryBtn} onPress={handleRetry}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );

  // ── Loading overlay ─────────────────────────────────────────────────────────
  const LoadingOverlay = () => (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color="#007bff" />
      <Text style={styles.overlayText}>Loading dashboards…</Text>
    </View>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // WEB — render a real <iframe> so browser load/error events fire correctly
  // ════════════════════════════════════════════════════════════════════════════
  if (Platform.OS === 'web') {
    return (
      <AppShell title="Dashboards" backLabel="Admin Hub">
      <View style={styles.container}>
        {error   && <ErrorScreen />}
        {loading && !error && <LoadingOverlay />}

        {!error && src && (
          <iframe
            ref={iframeRef}
            src={src}
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              border: 'none',
              opacity: loading ? 0 : 1,
              display: 'block',
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            allow="fullscreen"
            title="Bisleri Dashboards"
          />
        )}
      </View>
      </AppShell>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE / TABLET — use react-native-webview
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <AppShell title="Dashboards" backLabel="Admin Hub">
    <View style={styles.container}>
      {error   && <ErrorScreen />}
      {loading && !error && <LoadingOverlay />}

      {!error && WebView && src && (
        <WebView
          source={{ uri: src }}
          style={[styles.webview, loading && { opacity: 0 }]}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={()  => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 400) {
              setLoading(false);
              setError(true);
            }
          }}
          mixedContentMode="always"
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      )}
    </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F7FA',
  },

  webview: { flex: 1 },

  // ── Overlay shared by loading + error ─────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    backgroundColor: '#E0F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
    paddingHorizontal: 32,
  },
  overlayText:  { fontSize: 15, color: '#4a5568' },
  errorTitle:   { fontSize: 16, fontWeight: '600', color: '#2d3748', textAlign: 'center', marginTop: 8 },
  errorSub:     { fontSize: 13, color: '#718096', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
