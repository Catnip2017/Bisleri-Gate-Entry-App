// components/ui/ResultBar.js - The line above a results table (26 Nov 2026):
// "2,394 invoices — page 1 of 96" + one chip per active quick filter
// (e.g. "Status: PENDING ✕"). It is always on screen, so selecting a KPI
// card never pushes the filters or the table down.
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ResultBar({ text, note, chips = [], loading }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 30, marginBottom: 8 }}>
      <Text style={{ fontSize: 12.5, color: '#3E4F47', fontWeight: '600' }}>{text}</Text>
      {chips.map((c) => (
        <TouchableOpacity
          key={c.label}
          onPress={c.onClear}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter ${c.label}`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14,
            paddingLeft: 10, paddingRight: 6, paddingVertical: 4,
            backgroundColor: c.color || '#0F6B46',
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{c.label}</Text>
          <MaterialIcons name="close" size={14} color="#fff" />
        </TouchableOpacity>
      ))}
      {loading ? <ActivityIndicator size="small" color="#0F6B46" /> : null}
      {note ? <Text style={{ fontSize: 11.5, color: '#7A8A82' }}>{note}</Text> : null}
    </View>
  );
}
