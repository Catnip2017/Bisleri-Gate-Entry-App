// components/ui/SearchSelect.js - Dropdowns with a search box (26 Nov 2026).
//
//   <SearchMultiSelect>  checkbox list; selected = [] means "all" (filters)
//                        or "none yet" (forms — pass allLabel=null).
//   <SearchSelect>       pick exactly one value.
//
// options: [{ value, label }] (or plain strings). Same look as the
// User Management filters (teal border when something is chosen).
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';

const norm = (o) => (typeof o === 'string' ? { value: o, label: o } : o);

const S = {
  box: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    borderWidth: 1.5, borderColor: '#CFDDD7', borderRadius: 10, paddingHorizontal: 12,
    minHeight: 44, backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  boxTxt: { fontSize: 13.5, color: '#12202A', flex: 1 },
  menu: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E0E9E5', borderRadius: 10, paddingTop: 6, paddingBottom: 4,
    zIndex: 100, elevation: 8, minWidth: 220,
    ...(Platform.OS === 'web' ? { boxShadow: '0px 6px 18px rgba(0,0,0,0.12)' } : {}),
  },
  search: {
    marginHorizontal: 8, marginBottom: 4, borderWidth: 1, borderColor: '#CFDDD7', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: '#12202A',
  },
  item: { paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#12202A', marginBottom: 6 },
};

function Check({ on }) {
  return (
    <View style={{
      width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
      borderColor: on ? '#0F6B46' : '#9AA8AF', backgroundColor: on ? '#0F6B46' : '#fff',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {on ? <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 12 }}>✓</Text> : null}
    </View>
  );
}

function useMenu(options) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const all = (options || []).map(norm);
  const term = search.trim().toLowerCase();
  const shown = term ? all.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(term)) : all;
  return { open, setOpen, search, setSearch, all, shown };
}

export function SearchMultiSelect({
  label, title, name, options, selected = [], onChange, allLabel = 'All', placeholder = 'Select…',
  width, error, testID,
}) {
  const m = useMenu(options);
  const labelOf = (v) => m.all.find((o) => o.value === v)?.label || v;
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const summary = selected.length === 0 ? (allLabel || placeholder)
    : selected.length === 1 ? labelOf(selected[0]) : `${selected.length} selected`;
  return (
    <View style={[{ zIndex: m.open ? 60 : 1 }, width ? { width } : null]} testID={testID}>
      {title ? <Text style={S.label}>{title}</Text> : null}
      <TouchableOpacity
        onPress={() => { m.setOpen((o) => !o); m.setSearch(''); }}
        style={[S.box, selected.length > 0 && { borderColor: '#0F6B46' }, error && { borderColor: '#C62828' }]}
        accessibilityRole="button"
        accessibilityLabel={`${name || label || title || 'Select'}: ${summary}`}
      >
        <Text style={[S.boxTxt, selected.length === 0 && !allLabel && { color: '#8B99A3' }]} numberOfLines={1}>
          {label ? <Text style={{ color: '#8B99A3' }}>{label}: </Text> : null}{summary}
        </Text>
        <Text style={{ color: '#8B99A3', fontSize: 10 }}>{m.open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {m.open && (
        <View style={S.menu}>
          <TextInput
            value={m.search} onChangeText={m.setSearch} autoFocus autoCapitalize="none"
            placeholder="Search…" placeholderTextColor="#8B99A3" style={S.search}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 }}>
            {allLabel ? (
              <TouchableOpacity onPress={() => onChange([])}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F6B46' }}>{allLabel}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => onChange(Array.from(new Set([...selected, ...m.shown.map((o) => o.value)])))}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F6B46' }}>Select all{m.search ? ' shown' : ''}</Text>
              </TouchableOpacity>
            )}
            {selected.length > 0 && (
              <TouchableOpacity onPress={() => onChange([])}>
                <Text style={{ fontSize: 12, color: '#C62828' }}>Clear ({selected.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {m.shown.map((o) => {
              const on = selected.includes(o.value);
              return (
                <TouchableOpacity key={o.value} onPress={() => toggle(o.value)}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={o.label}
                  style={[S.item, on && { backgroundColor: '#EAF5F0' }]}>
                  <Check on={on} />
                  <Text style={{ fontSize: 13, color: '#12202A', fontWeight: on ? '700' : '400', flex: 1 }}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
            {m.shown.length === 0 && <Text style={{ padding: 12, fontSize: 12.5, color: '#8B99A3' }}>No matches</Text>}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export function SearchSelect({
  title, name, options, value, onChange, placeholder = 'Select…', width, error, disabled, testID,
}) {
  const m = useMenu(options);
  const current = m.all.find((o) => o.value === value);
  return (
    <View style={[{ zIndex: m.open ? 60 : 1 }, width ? { width } : null]} testID={testID}>
      {title ? <Text style={S.label}>{title}</Text> : null}
      <TouchableOpacity
        disabled={disabled}
        onPress={() => { m.setOpen((o) => !o); m.setSearch(''); }}
        style={[S.box, value && { borderColor: '#0F6B46' }, error && { borderColor: '#C62828' },
          disabled && { backgroundColor: '#F4F5F5' }]}
        accessibilityRole="button"
        accessibilityLabel={`${name || title || 'Select'}: ${current ? current.label : placeholder}`}
      >
        <Text style={[S.boxTxt, !current && { color: '#8B99A3' }]} numberOfLines={1}>
          {current ? current.label : placeholder}
        </Text>
        <Text style={{ color: '#8B99A3', fontSize: 10 }}>{m.open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {m.open && (
        <View style={S.menu}>
          {m.all.length > 6 && (
            <TextInput
              value={m.search} onChangeText={m.setSearch} autoFocus autoCapitalize="none"
              placeholder="Search…" placeholderTextColor="#8B99A3" style={S.search}
            />
          )}
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {m.shown.map((o) => (
              <TouchableOpacity key={o.value} onPress={() => { onChange(o.value); m.setOpen(false); }}
                accessibilityRole="button" accessibilityLabel={o.label}
                style={[S.item, o.value === value && { backgroundColor: '#EAF5F0' }]}>
                <Text style={{ fontSize: 13, color: '#12202A', fontWeight: o.value === value ? '700' : '400' }}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            {m.shown.length === 0 && <Text style={{ padding: 12, fontSize: 12.5, color: '#8B99A3' }}>No matches</Text>}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default SearchMultiSelect;
