// components/ui/MultiSelectDropdown.js - Compact checkbox dropdown for
// multi-select filters (Status, Pass Type, etc). Replaces a wrapping row of
// toggle chips with a single-line summary button + checkbox popover, modeled
// on the location filter already used in GatePassGuardTab.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
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
  // Optional controlled-open mode: when the parent screen has several of
  // these (plus other popovers like the FY picker) in one filter bar, it
  // can pass isOpen/onOpenChange so only one is ever open at a time instead
  // of each managing its own state and visually colliding. Omit both to
  // keep the old fully-uncontrolled behaviour.
  isOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = typeof onOpenChange === 'function';
  const open = controlled ? isOpen : internalOpen;
  const setOpen = (updater) => {
    const next = typeof updater === 'function' ? updater(open) : updater;
    if (controlled) onOpenChange(next);
    else setInternalOpen(next);
  };
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
        // IMPORTANT: the outer popover box must stay a plain View, not a
        // ScrollView. Putting position:'absolute' directly on a ScrollView's
        // own style collapses it to zero height on React Native Web (its
        // outer container needs an explicit/inherited height to compute a
        // scroll area — "top" alone isn't enough, unlike a plain View, which
        // sizes to its content). That's what made every dropdown render as
        // an empty box with nothing visible underneath it. Fix: keep the
        // outer View absolutely positioned and sized by content (maxHeight +
        // overflow:hidden as the cap), and nest the actual ScrollView inside
        // it for the scrolling — the same two-layer pattern already used for
        // the Item Type / UOM pickers in GatePassForm.js.
        <View
          style={{
            position: 'absolute', top: label ? 60 : 42, left: 0, right: 0,
            backgroundColor: '#fff', borderWidth: 1, borderColor: '#C8D4DE',
            borderRadius: 8, elevation: 6, zIndex: 100, maxHeight: 260,
            overflow: 'hidden',
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default MultiSelectDropdown;
