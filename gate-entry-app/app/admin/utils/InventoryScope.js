// app/admin/utils/InventoryScope.js - Scope fields for the two Blinkit
// Inventory Portal roles (26 Nov 2026), shared by Register and Assign Access.
//
//   Bisleri Inventory Operator : Warehouses (many) + Blinkit users (many)
//   Blinkit Inventory Viewer   : Customer code (one) + Warehouses (many)
//
// value = { warehouses: [], viewers: [], customer_code: '' }
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { SearchMultiSelect } from '../../../components/ui/SearchSelect';
import { adminAPI } from '../../../services/api';

export const INV_OPERATOR = 'Bisleri Inventory Operator';
export const INV_VIEWER = 'Blinkit Inventory Viewer';
export const EMPTY_INV_SCOPE = { warehouses: [], viewers: [], customer_code: '' };

const norm = (r) => (r || '').toLowerCase().replace(/\s+/g, '');
const isViewerRole = (roleString) =>
  (roleString || '').split(',').map(norm).includes('blinkitinventoryviewer');

export const needsInventoryScope = (roles) => roles.includes(INV_OPERATOR) || roles.includes(INV_VIEWER);

// Client-side check before saving; server repeats it (inventory_access.py).
export function inventoryScopeError(roles, v) {
  if (!needsInventoryScope(roles)) return null;
  if (!v.warehouses.length) return 'Select at least one warehouse for the Inventory Portal';
  if (roles.includes(INV_OPERATOR) && !v.viewers.length) return 'Select at least one Blinkit user for this operator';
  if (roles.includes(INV_VIEWER) && !v.customer_code.trim()) return 'Customer code is required for a Blinkit Inventory Viewer';
  return null;
}

export const inventoryScopeKey = (v) =>
  `${[...v.warehouses].sort().join(',')}|${[...v.viewers].sort().join(',')}|${(v.customer_code || '').trim().toUpperCase()}`;

export default function InventoryScope({ roles, value, onChange, warehouses = [], selfUsername }) {
  const operator = roles.includes(INV_OPERATOR);
  const viewer = roles.includes(INV_VIEWER);
  const [viewerUsers, setViewerUsers] = useState([]);

  useEffect(() => {
    if (!operator) return;
    adminAPI.getUsersOverview()
      .then((list) => setViewerUsers((list || []).filter((u) => isViewerRole(u.role) && u.username !== selfUsername)))
      .catch(() => setViewerUsers([]));
  }, [operator, selfUsername]);

  if (!operator && !viewer) return null;
  const whOptions = warehouses.map((w) => ({
    value: w.warehouse_code, label: w.warehouse_name ? `${w.warehouse_code} — ${w.warehouse_name}` : w.warehouse_code,
  }));
  const set = (k, v) => onChange({ ...value, [k]: v });
  const label = { fontSize: 12.5, fontWeight: '600', color: '#2B3A42', marginBottom: 6, marginTop: 4 };

  return (
    <View style={{ marginBottom: 16, zIndex: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F6B46', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' }}>
        Blinkit Inventory Portal
      </Text>
      {viewer && (
        <View style={{ marginBottom: 12 }}>
          <Text style={label}>Customer code *</Text>
          <TextInput
            value={value.customer_code}
            onChangeText={(t) => set('customer_code', t.toUpperCase().replace(/\s/g, ''))}
            placeholder="e.g. BLK001" placeholderTextColor="#aaa" maxLength={50} autoCapitalize="characters"
            accessibilityLabel="Customer code"
            style={{ borderWidth: 1.5, borderColor: '#CFDDD7', borderRadius: 10, paddingHorizontal: 12, minHeight: 44, fontSize: 14, color: '#12202A', backgroundColor: '#fff' }}
          />
          <Text style={{ fontSize: 11.5, color: '#8B99A3', marginTop: 4 }}>The one customer code this Blinkit user sees.</Text>
        </View>
      )}
      <View style={{ marginBottom: 12, zIndex: 20 }}>
        <Text style={label}>Warehouses *</Text>
        <SearchMultiSelect options={whOptions} selected={value.warehouses} onChange={(v) => set('warehouses', v)}
          allLabel={null} placeholder="Select warehouses" name="Inventory warehouses" />
      </View>
      {operator && (
        <View style={{ zIndex: 10 }}>
          <Text style={label}>Blinkit users *</Text>
          <SearchMultiSelect
            options={viewerUsers.map((u) => ({
              value: u.username,
              label: `${`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username} (${u.username})`,
            }))}
            name="Blinkit users" selected={value.viewers} onChange={(v) => set('viewers', v)}
            allLabel={null} placeholder={viewerUsers.length ? 'Select Blinkit users' : 'No Blinkit users yet — register them first'}
          />
          <Text style={{ fontSize: 11.5, color: '#8B99A3', marginTop: 4 }}>
            The operator enters stock for these users' customer codes.
          </Text>
        </View>
      )}
    </View>
  );
}
