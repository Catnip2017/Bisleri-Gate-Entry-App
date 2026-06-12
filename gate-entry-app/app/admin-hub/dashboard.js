// app/admin-hub/dashboard.js
// Platform-aware Streamlit embed:
//   Web    → native <iframe> (react-native-webview's iframe wrapper doesn't
//             fire onLoadEnd reliably when Streamlit's CSP headers are active)
//   Mobile → react-native-webview (full native WebView)

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

// ── Use your machine's LAN IP — NOT localhost ─────────────────────────────────
// localhost resolves to the device/browser itself, not your PC.
// Same IP as EXPO_PUBLIC_API_URL in .env, but port 8501.
// Run Streamlit with:
//   streamlit run streamlit-dashboards/hello.py \
//     --server.enableCORS=false --server.enableXsrfProtection=false
const STREAMLIT_URL = 'http://192.168.1.8:8501';

// ── Lazy-load WebView only on native to avoid web bundle issues ───────────────
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(false);
  const iframeRef               = useRef(null);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    // Force iframe reload on web
    if (Platform.OS === 'web' && iframeRef.current) {
      iframeRef.current.src = STREAMLIT_URL;
    }
  };

  // ── Shared top bar ──────────────────────────────────────────────────────────
  const TopBar = () => (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      >
        <MaterialIcons name="arrow-back" size={22} color="#1a365d" />
        <Text style={styles.backText}>Admin Hub</Text>
      </Pressable>
      <Text style={styles.topTitle}>Dashboards</Text>
      <View style={{ width: 90 }} />
    </View>
  );

  // ── Error state ─────────────────────────────────────────────────────────────
  const ErrorScreen = () => (
    <View style={styles.overlay}>
      <MaterialIcons name="wifi-off" size={48} color="#718096" />
      <Text style={styles.errorTitle}>Could not reach the dashboard server</Text>
      <Text style={styles.errorSub}>
        Make sure Streamlit is running:{'\n'}{STREAMLIT_URL}
        {'\n\n'}Start it with:{'\n'}
        <Text style={styles.codeText}>
          streamlit run streamlit-dashboards/hello.py{'\n'}
          --server.enableCORS=false{'\n'}
          --server.enableXsrfProtection=false
        </Text>
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
      <View style={styles.container}>
        <TopBar />

        {error   && <ErrorScreen />}
        {loading && !error && <LoadingOverlay />}

        {/* Always mount iframe so it starts loading immediately.
            Hide it (opacity 0, pointer-events none) while loading so the
            overlay sits on top cleanly. */}
        {!error && (
          <iframe
            ref={iframeRef}
            src={STREAMLIT_URL}
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              border: 'none',
              opacity: loading ? 0 : 1,
              // Streamlit needs these to render correctly inside an iframe
              display: 'block',
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            // Allow Streamlit's internal scripts to run
            allow="fullscreen"
            title="Bisleri Dashboards"
          />
        )}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MOBILE / TABLET — use react-native-webview
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <TopBar />

      {error   && <ErrorScreen />}
      {loading && !error && <LoadingOverlay />}

      {!error && WebView && (
        <WebView
          source={{ uri: STREAMLIT_URL }}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F7FA',
  },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    height: 52,
    backgroundColor: '#E0F7FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#b2ebf2',
    ...Platform.select({
      web:     { boxShadow: '0px 2px 4px rgba(0,0,0,0.08)' },
      android: { elevation: 3 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
    }),
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 90,
  },
  backText:  { fontSize: 14, color: '#1a365d', fontWeight: '500' },
  topTitle:  { fontSize: 16, fontWeight: '700', color: '#1a365d' },

  webview: { flex: 1 },

  // ── Overlay shared by loading + error ─────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: 52,
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
  codeText:     { fontFamily: Platform.OS === 'web' ? 'monospace' : 'SpaceMono-Regular', fontSize: 11, color: '#2b6cb0' },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
