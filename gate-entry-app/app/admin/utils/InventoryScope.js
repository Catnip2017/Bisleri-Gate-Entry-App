// app/admin/utils/InventoryScope.js - Scope fields for the two Blinkit
// Inventory Portal roles (26 Nov 2026), shared by Register and Assign Access.
//
//   Bisleri Inventory Operator : Warehouses (many) + Blinkit stores (many) — 27 Nov 2026
//   Blinkit Inventory Viewer   : Blinkit store (one, from blinkit_stores) + Warehouses (many)
//
// value = { warehouses: [], stores: [], store_code: '' }
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SearchMultiSelect, SearchSelect } from '../../../components/ui/SearchSelect';
import { inventoryAPI } from '../../../services/api';

export const INV_OPERATOR = 'Bisleri Inventory Operator';
export const INV_VIEWER = 'Blinkit Inventory Viewer';
export const EMPTY_INV_SCOPE = { warehouses: [], stores: [], store_code: '' };


export const needsInventoryScope = (roles) => roles.includes(INV_OPERATOR) || roles.includes(INV_VIEWER);

// Client-side check before saving; server repeats it (inventory_access.py).
export function inventoryScopeError(roles, v) {
  if (!needsInventoryScope(roles)) return null;
  if (!v.warehouses.length) return 'Select at least one warehouse for the Inventory Portal';
  if (roles.includes(INV_OPERATOR) && !(v.stores || []).length) return 'Select at least one Blinkit store for this operator';
  if (roles.includes(INV_VIEWER) && !(v.store_code || '').trim()) return 'Select the Blinkit store for this Blinkit Inventory Viewer';
  return null;
}

export const inventoryScopeKey = (v) =>
  `${[...v.warehouses].sort().join(',')}|${[...(v.stores || [])].sort().join(',')}|${(v.store_code || '').trim().toUpperCase()}`;

export default function InventoryScope({ roles, value, onChange, warehouses = [], selfUsername }) {
  const operator = roles.includes(INV_OPERATOR);
  const viewer = roles.includes(INV_VIEWER);
  const [stores, setStores] = useState(null);       // null = loading
  const [storeErr, setStoreErr] = useState('');

  useEffect(() => {
    if (!viewer && !operator) return;
    inventoryAPI.getStores()
      .then((list) => { setStores(list || []); setStoreErr(''); })
      .catch((e) => {
        setStores([]);
        setStoreErr(e?.response?.status === 503
          ? 'The Inventory Portal tables are not set up on this database yet.'
          : 'Could not load the Blinkit store list.');
      });
  }, [viewer, operator]);

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
        <View style={{ marginBottom: 12, zIndex: 30 }}>
          <Text style={label}>Blinkit store *</Text>
          <SearchSelect
            name="Blinkit store"
            options={(stores || []).map((st) => ({ value: st.code, label: st.label }))
              .concat(value.store_code && stores && !stores.some((st) => st.code === value.store_code)
                ? [{ value: value.store_code, label: value.store_code }] : [])}
            value={value.store_code || null}
            onChange={(v) => set('store_code', v)}
            placeholder={stores === null ? 'Loading stores…' : stores.length ? 'Select store' : 'No stores in the store master yet'}
            disabled={stores === null}
          />
          <Text style={{ fontSize: 11.5, color: storeErr ? '#C62828' : '#8B99A3', marginTop: 4 }}>
            {storeErr || 'The one Blinkit store this user sees (from the Blinkit stores master).'}
          </Text>
        </View>
      )}
      <View style={{ marginBottom: 12, zIndex: 20 }}>
        <Text style={label}>Warehouses *</Text>
        <SearchMultiSelect options={whOptions} selected={value.warehouses} onChange={(v) => set('warehouses', v)}
          allLabel={null} placeholder="Select warehouses" name="Inventory warehouses" />
      </View>
      {operator && (
        <View style={{ zIndex: 10 }}>
          <Text style={label}>Blinkit stores *</Text>
          <SearchMultiSelect
            options={(stores || []).map((st) => ({ value: st.code, label: st.label }))}
            name="Blinkit stores" selected={value.stores || []} onChange={(v) => set('stores', v)}
            allLabel={null}
            placeholder={stores === null ? 'Loading stores…' : stores.length ? 'Select Blinkit stores' : 'No stores in the store master yet'}
          />
          <Text style={{ fontSize: 11.5, color: storeErr ? '#C62828' : '#8B99A3', marginTop: 4 }}>
            {storeErr || 'The operator enters stock for these stores (from the Blinkit stores master).'}
          </Text>
        </View>
      )}
    </View>
  );
}
