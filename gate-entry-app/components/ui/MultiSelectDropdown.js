// components/ui/MultiSelectDropdown.js - Compact checkbox dropdown for
// multi-select filters (Status, Pass Type, etc). Replaces a wrapping row of
// toggle chips with a single-line summary button + checkbox popover, modeled
// on the location filter already used in GatePassGuardTab.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { typography, spacing } from '../../utils/theme';

// options: array of strings, or array of { value, label }
const normalize = (opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt);

const MultiSelectDropdown = ({
  label,
  options,
  selected = [],
  onChange,
  allLabel = 'All',
  minWidth = 200,
  maxWidth = 320,
}) => {
  const [open, setOpen] = useState(false);
  const normOptions = options.map(normalize);

  const toggle = (value) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const labelFor = (value) => normOptions.find((o) => o.value === value)?.label || value;
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? labelFor(selected[0])
        : `${selected.length} selected`;

  return (
    <View style={{ minWidth, maxWidth }}>
      {label ? <Text style={{ ...typography.label, marginBottom: spacing.xs }}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderWidth: 1, borderColor: '#C8D4DE', borderRadius: 8,
          paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A2E22' }} numberOfLines={1}>
          {summary}
        </Text>
        <Text style={{ fontSize: 10, color: '#7A8A80', marginLeft: 8 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View
          style={{
            position: 'absolute', top: label ? 60 : 42, left: 0, right: 0,
            backgroundColor: '#fff', borderWidth: 1, borderColor: '#C8D4DE',
            borderRadius: 8, elevation: 6, zIndex: 100, maxHeight: 260,
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <TouchableOpacity
            onPress={() => onChange([])}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 15, width: 24 }}>{selected.length === 0 ? '☑' : '☐'}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A2E22' }}>{allLabel}</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#E5EDE8' }} />
          {normOptions.map((o) => {
            const on = selected.includes(o.value);
            return (
              <TouchableOpacity
                key={o.value}
                onPress={() => toggle(o.value)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ fontSize: 15, width: 24 }}>{on ? '☑' : '☐'}</Text>
                <Text style={{ fontSize: 13, color: '#1A2E22' }}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default MultiSelectDropdown;
