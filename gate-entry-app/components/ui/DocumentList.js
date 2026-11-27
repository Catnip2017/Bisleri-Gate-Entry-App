// components/ui/DocumentList.js - Flat, download-only document list.
// Shared by every screen behind the Documents accordion (Process Solution
// Documents, User Guides, and any future category) — 30 Oct 2026. Each row
// is just a filename + an updated label + a download icon; no preview, no
// nesting. `rows` is empty today everywhere (no backend/storage wired up
// yet) so this mainly renders the empty state until that's built.
import React from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { showError } from '../../utils/customModal';

// rows: [{ key, name, version, updatedLabel, url }]
// onDownload(row): optional — used instead of opening row.url (27 Nov 2026:
// files come from the server through an authenticated download).
const DocumentList = ({ rows = [], onDownload, busyKey, emptyText = 'No documents yet.' }) => {
  const { colors } = useTheme();

  const handleDownload = async (row) => {
    if (onDownload) { onDownload(row); return; }
    if (!row.url) return; // no file wired up yet — button renders disabled below
    try {
      await Linking.openURL(row.url);
    } catch (e) {
      showError('Could not open this document. Please try again.');
    }
  };

  if (rows.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
        <MaterialIcons name="folder-open" size={34} color={colors.textMuted} />
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 10, textAlign: 'center' }}>
          {emptyText}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <View
          key={row.key || row.name}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <View style={{
            width: 32, height: 32, borderRadius: 6, backgroundColor: '#FCEBEB',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#C0392B' }}>PDF</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
              {row.name}
              {row.version ? <Text style={{ fontWeight: '400', color: colors.textMuted }}>{`  ·  ${row.version}`}</Text> : null}
            </Text>
            {row.updatedLabel ? (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{row.updatedLabel}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => handleDownload(row)}
            disabled={!(onDownload || row.url) || busyKey === (row.key || row.name)}
            style={{
              width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center',
              opacity: (onDownload || row.url) ? 1 : 0.4,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Download ${row.name}`}
          >
            {busyKey === (row.key || row.name)
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <MaterialIcons name="file-download" size={18} color={colors.accent} />}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

export default DocumentList;
