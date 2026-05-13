// app/copacker/CoPackerDashboard.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { copackerAPI, authAPI, handleAPIError } from '../../services/api';
import { showAlert } from '../../utils/customModal';
import { storage } from '../../utils/storage';
import { API_BASE_URL } from '../../services/api';
import styles from './styles/copackerStyles';

// ── Helpers ───────────────────────────────────────────────────────────────────
const toDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
};

const todayISO = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

const nowTimeISO = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

// ── Main component ─────────────────────────────────────────────────────────────
const CoPackerDashboard = () => {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // Table state
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  // Add New Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal form fields
  const [assets, setAssets] = useState([]);               // line mappings for location
  const [lineNo, setLineNo] = useState('');
  const [assetModelId, setAssetModelId] = useState('');
  const [assetModelIdManual, setAssetModelIdManual] = useState(false);
  const [entryDate, setEntryDate] = useState(todayISO());
  const [entryTime, setEntryTime] = useState('');
  const [skuName, setSkuName] = useState('');
  const [skuItemId, setSkuItemId] = useState('');
  const [capturedImage, setCapturedImage] = useState(null); // { uri, file }

  // Dropdowns
  const [skuNameOptions, setSkuNameOptions] = useState([]);
  const [skuNameDropdownVisible, setSkuNameDropdownVisible] = useState(false);
  const [skuIdOptions, setSkuIdOptions] = useState([]);
  const [skuIdDropdownVisible, setSkuIdDropdownVisible] = useState(false);

  // Asset Model ID duplicate-on-different-line popup
  const [assetExistsPopupVisible, setAssetExistsPopupVisible] = useState(false);
  const [assetExistsMessage, setAssetExistsMessage] = useState('');

  // Confirm edit popup
  const [editPopupVisible, setEditPopupVisible] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { entryId, originalQty, newQty, remark }
  const [editInputValue, setEditInputValue] = useState('');
  const [editingEntryId, setEditingEntryId] = useState(null);

  // Register new asset popup
  const [registerAssetPopupVisible, setRegisterAssetPopupVisible] = useState(false);
  const [pendingNewAsset, setPendingNewAsset] = useState(null);

  // File input ref (web)
  const fileInputRef = useRef(null);

  // ── Load user + initial data ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/LoginScreen'); return; }
      setUserData(user);
    })();
  }, []);

  useEffect(() => {
    if (userData?.copackerLocation) {
      loadAssets(userData.copackerLocation);
      loadEntries(userData.copackerLocation, selectedDate);
    }
  }, [userData]);

  const loadAssets = async (location) => {
    try {
      const data = await copackerAPI.getAssets(location);
      setAssets(data);
    } catch (e) {
      console.warn('Failed to load assets:', e);
    }
  };

  const loadEntries = useCallback(async (location, dateStr) => {
    if (!location) return;
    setEntriesLoading(true);
    try {
      const data = await copackerAPI.getEntries(location, dateStr);
      setEntries(data);
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          try { await authAPI.logout(); } catch (_) {}
          await storage.removeItem('access_token');
          router.replace('/LoginScreen');
        }
      },
    ]);
  };

  // ── Open modal ─────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setLineNo('');
    setAssetModelId('');
    setAssetModelIdManual(false);
    setEntryDate(todayISO());
    setEntryTime('');
    setSkuName('');
    setSkuItemId('');
    setCapturedImage(null);
    setSkuNameOptions([]);
    setSkuIdOptions([]);
    setSkuNameDropdownVisible(false);
    setSkuIdDropdownVisible(false);
    setModalVisible(true);
  };

  // ── Line No — free integer input with auto-lookup ──────────────────────────
  const handleLineNoChange = (val) => {
    // Only allow digits
    const cleaned = val.replace(/[^0-9]/g, '');
    setLineNo(cleaned);

    if (!cleaned) {
      setAssetModelId('');
      setAssetModelIdManual(false);
      return;
    }

    const num = parseInt(cleaned, 10);
    const existingAsset = assets.find(a => a.line_no === num);
    if (existingAsset) {
      // Auto-fill Asset Model ID from registered mapping
      setAssetModelId(existingAsset.asset_model_id);
      setAssetModelIdManual(false);
    } else {
      // New line — clear asset model ID so user can type one
      setAssetModelId('');
      setAssetModelIdManual(false);
    }
  };

  // ── Asset Model ID — change + blur validation ──────────────────────────────
  const handleAssetModelChange = (val) => {
    setAssetModelId(val);
    setAssetModelIdManual(true);
  };

  const handleAssetModelBlur = () => {
    if (!assetModelId.trim()) return;

    const lineNum = parseInt(lineNo, 10);
    const trimmedAsset = assetModelId.trim();

    // 1. Exact match for this line → already registered, nothing to do
    const exactMatch = assets.find(
      a => a.line_no === lineNum && a.asset_model_id === trimmedAsset
    );
    if (exactMatch) {
      setAssetModelIdManual(false);
      return;
    }

    // 2. Asset Model ID exists but on a DIFFERENT line → warn user
    const differentLineMatch = assets.find(
      a => a.asset_model_id === trimmedAsset && a.line_no !== lineNum
    );
    if (differentLineMatch) {
      setAssetExistsMessage(
        `Asset Model ID "${trimmedAsset}" is already registered for Line ${differentLineMatch.line_no} at this location. Please use a different Asset Model ID or select Line ${differentLineMatch.line_no}.`
      );
      setAssetExistsPopupVisible(true);
      return;
    }

    // 3. Completely new Asset Model ID for this line → ask to register
    if (!isNaN(lineNum) && lineNo.trim()) {
      setPendingNewAsset({
        location: userData.copackerLocation,
        lineNo: lineNum,
        assetModelId: trimmedAsset,
      });
      setRegisterAssetPopupVisible(true);
    }
  };

  const handleRegisterNewAsset = async (confirm) => {
    setRegisterAssetPopupVisible(false);
    if (!confirm || !pendingNewAsset) return;
    try {
      await copackerAPI.registerAsset(
        pendingNewAsset.location,
        pendingNewAsset.lineNo,
        pendingNewAsset.assetModelId
      );
      showAlert('Success', 'New asset registered successfully.');
      loadAssets(userData.copackerLocation);
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    }
    setPendingNewAsset(null);
  };

  // ── SKU search (name) — substring search, auto-populates Item ID ──────────
  const handleSkuNameChange = async (val) => {
    setSkuName(val);
    // Only clear the paired field if user is actively clearing/retyping
    if (!val || val.length === 0) {
      setSkuItemId('');
      setSkuNameOptions([]);
      setSkuNameDropdownVisible(false);
      return;
    }
    if (val.length < 2) { setSkuNameOptions([]); setSkuNameDropdownVisible(false); return; }
    try {
      // Backend uses ILIKE %val% so "20Ltr" matches "Bis-20Ltr-567"
      const results = await copackerAPI.skuSearch(val, 'name');
      setSkuNameOptions(results);
      setSkuNameDropdownVisible(results.length > 0);
    } catch (_) {}
  };

  const selectSkuByName = (item) => {
    // Selecting from dropdown populates BOTH fields — they stay in sync
    setSkuName(item.product_name);
    setSkuItemId(item.item_number);
    setSkuNameOptions([]);
    setSkuNameDropdownVisible(false);
  };

  // ── SKU search (itemid) — substring search, auto-populates Name ───────────
  const handleSkuIdChange = async (val) => {
    setSkuItemId(val);
    if (!val || val.length === 0) {
      setSkuName('');
      setSkuIdOptions([]);
      setSkuIdDropdownVisible(false);
      return;
    }
    if (val.length < 2) { setSkuIdOptions([]); setSkuIdDropdownVisible(false); return; }
    try {
      // Backend uses ILIKE %val% so partial item numbers are matched
      const results = await copackerAPI.skuSearch(val, 'itemid');
      setSkuIdOptions(results);
      setSkuIdDropdownVisible(results.length > 0);
    } catch (_) {}
  };

  const selectSkuById = (item) => {
    // Selecting from dropdown populates BOTH fields — they stay in sync
    setSkuItemId(item.item_number);
    setSkuName(item.product_name);
    setSkuIdOptions([]);
    setSkuIdDropdownVisible(false);
  };

  // ── Camera capture ─────────────────────────────────────────────────────────
  const handleCameraCapture = () => {
    // Set time at moment of capture
    setEntryTime(nowTimeISO());

    if (Platform.OS === 'web') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else {
      // On native, use a file input with capture attribute
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(file.type) && !['jpg', 'jpeg', 'png'].includes(ext)) {
      showAlert('Invalid File', 'Only JPEG, JPG, and PNG images are accepted. Please capture again.');
      e.target.value = '';
      return;
    }

    const uri = URL.createObjectURL(file);
    setCapturedImage({ uri, file });
    setEntryTime(nowTimeISO()); // refresh time at actual file selection
  };

  // ── Submit entry ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!lineNo) { showAlert('Validation', 'Please enter a Line No.'); return; }
    if (!assetModelId.trim()) { showAlert('Validation', 'Asset Model ID is required.'); return; }
    if (!capturedImage) { showAlert('Validation', 'Please capture an image.'); return; }
    if (!skuName.trim() && !skuItemId.trim()) { showAlert('Validation', 'Please select a SKU.'); return; }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('copacker_location', userData.copackerLocation || '');
      formData.append('line_no', lineNo);
      formData.append('asset_model_id', assetModelId.trim());
      formData.append('entry_date', entryDate);
      formData.append('entry_time', entryTime || nowTimeISO());
      formData.append('sku_name', skuName.trim());
      formData.append('sku_itemid', skuItemId.trim());

      if (Platform.OS === 'web' && capturedImage.file) {
        formData.append('image', capturedImage.file, capturedImage.file.name);
      } else {
        // Native: append as URI
        const filename = capturedImage.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('image', { uri: capturedImage.uri, name: filename, type });
      }

      await copackerAPI.submitEntry(formData);
      setModalVisible(false);
      showAlert('Success', 'Entry submitted successfully!', [
        {
          text: 'OK',
          onPress: () => loadEntries(userData.copackerLocation, selectedDate),
        },
      ]);
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Inline quantity edit ───────────────────────────────────────────────────
  const startEditQty = (entry) => {
    setEditingEntryId(entry.id);
    setEditInputValue(String(entry.extracted_quantity ?? ''));
  };

  const confirmEditQty = (entry) => {
    const newQty = parseInt(editInputValue, 10);
    if (isNaN(newQty)) { showAlert('Validation', 'Please enter a valid integer.'); return; }

    const remark = `Extracted value was ${entry.extracted_quantity ?? 'null'}, user ${userData.username} edited it to ${newQty}.`;
    setEditTarget({ entryId: entry.id, originalQty: entry.extracted_quantity, newQty, remark });
    setEditPopupVisible(true);
  };

  const handleEditConfirm = async () => {
    setEditPopupVisible(false);
    if (!editTarget) return;
    try {
      await copackerAPI.editQuantity(editTarget.entryId, editTarget.newQty);
      setEditingEntryId(null);
      // Update row in place
      setEntries(prev => prev.map(e =>
        e.id === editTarget.entryId ? { ...e, extracted_quantity: editTarget.newQty } : e
      ));
      showAlert('Success', 'Quantity updated successfully.');
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setEditTarget(null);
    }
  };

  const cancelEditQty = () => {
    setEditingEntryId(null);
    setEditInputValue('');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isEntryOwner = (entry) => entry.username === userData?.username;
  const isToday = (entry) => entry.entry_date === todayISO();
  const canEdit = (entry) => isEntryOwner(entry) && isToday(entry);

  const getImageUrl = (relativePath) => {
    if (!relativePath) return null;
    return `${API_BASE_URL}/copacker-images/${relativePath}`;
  };

  // ── Render table row ──────────────────────────────────────────────────────
  const renderTableRow = (entry, index) => {
    const rowStyle = [styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd];
    const imageUrl = getImageUrl(entry.image_path);
    const isEditing = editingEntryId === entry.id;

    return (
      <View key={entry.id} style={rowStyle}>
        <Text style={[styles.tableCell, styles.colSr]}>{index + 1}</Text>
        <Text style={[styles.tableCell, styles.colLine]}>{entry.line_no}</Text>
        <Text style={[styles.tableCell, styles.colAsset]}>{entry.asset_model_id}</Text>
        <Text style={[styles.tableCell, styles.colDate]}>{toDisplayDate(String(entry.entry_date))}</Text>
        <Text style={[styles.tableCell, styles.colTime]}>{String(entry.entry_time).substring(0, 5)}</Text>

        {/* Image thumbnail */}
        <View style={[styles.colImage, { alignItems: 'center' }]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Text style={styles.thumbnailPlaceholderText}>📷</Text>
            </View>
          )}
        </View>

        <Text style={[styles.tableCell, styles.colSku]} numberOfLines={2}>{entry.sku_name || '—'}</Text>
        <Text style={[styles.tableCell, styles.colSkuId]} numberOfLines={1}>{entry.sku_itemid || '—'}</Text>

        {/* Extracted quantity — editable for owner same day */}
        <View style={[styles.colQty, { alignItems: 'center' }]}>
          {isEditing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TextInput
                style={[styles.fieldInput, { width: 55, textAlign: 'center', paddingVertical: 2, fontSize: 12 }]}
                value={editInputValue}
                onChangeText={setEditInputValue}
                keyboardType="number-pad"
                autoFocus
              />
              <TouchableOpacity onPress={() => confirmEditQty(entry)}>
                <Text style={{ color: '#38a169', fontSize: 16 }}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEditQty}>
                <Text style={{ color: '#e53e3e', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyText}>{entry.extracted_quantity ?? '—'}</Text>
              {canEdit(entry) && (
                <TouchableOpacity onPress={() => startEditQty(entry)}>
                  <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <Text style={[styles.tableCell, styles.colUser]} numberOfLines={1}>{entry.username}</Text>
      </View>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.flex1}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setIsSidebarVisible(v => !v)}>
          <Text style={styles.menuText}>☰</Text>
        </TouchableOpacity>
        <Image
          source={require('../../assets/images/bisleri-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/landing/')}>
          <Text style={styles.homeText}>Home</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* ── Sidebar ── */}
        {isSidebarVisible && (
          <View style={styles.sidebar}>
            <Text style={styles.sidebarTitle}>User Info</Text>
            <Text style={styles.sidebarLabel}>Username</Text>
            <Text style={styles.sidebarValue}>{userData?.username || '—'}</Text>
            <Text style={styles.sidebarLabel}>Full Name</Text>
            <Text style={styles.sidebarValue}>{userData?.fullName || '—'}</Text>
            <Text style={styles.sidebarLabel}>Role</Text>
            <Text style={styles.sidebarValue}>Co Packer</Text>
            <Text style={styles.sidebarLabel}>Location</Text>
            <Text style={styles.sidebarValue}>{userData?.copackerLocation || '—'}</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Main content ── */}
        <View style={styles.mainContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Title row */}
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>Co Packer Entries</Text>
              <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                <Text style={styles.addButtonText}>+ Add New</Text>
              </TouchableOpacity>
            </View>

            {/* Date label */}
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>
                Showing entries for: {toDisplayDate(selectedDate)} — Location: {userData?.copackerLocation || '—'}
              </Text>
            </View>

            {/* Table (horizontally scrollable) */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.tableWrapper}>
                {/* Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colSr]}>Sr.</Text>
                  <Text style={[styles.tableHeaderCell, styles.colLine]}>Line No</Text>
                  <Text style={[styles.tableHeaderCell, styles.colAsset]}>Asset Model ID</Text>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTime]}>Time</Text>
                  <Text style={[styles.tableHeaderCell, styles.colImage]}>Image</Text>
                  <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU Name</Text>
                  <Text style={[styles.tableHeaderCell, styles.colSkuId]}>SKU Item ID</Text>
                  <Text style={[styles.tableHeaderCell, styles.colQty]}>Ext. Qty</Text>
                  <Text style={[styles.tableHeaderCell, styles.colUser]}>Username</Text>
                </View>

                {/* Rows */}
                {entriesLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#2b6cb0" />
                  </View>
                ) : entries.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.thumbnailPlaceholderText}>📋</Text>
                    <Text style={styles.emptyText}>No entries for today</Text>
                  </View>
                ) : (
                  entries.map((entry, index) => renderTableRow(entry, index))
                )}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>

      {/* ── Add New Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Entry</Text>

            <ScrollView style={styles.modalScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">

              {/* Line No — free integer input with auto-lookup */}
              <Text style={styles.fieldLabel}>Line No *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter line number (e.g. 1, 2, 3...)"
                value={lineNo}
                onChangeText={handleLineNoChange}
                keyboardType="number-pad"
              />
              {/* Hint: show existing lines for reference */}
              {assets.length > 0 && (
                <Text style={{ fontSize: 11, color: '#718096', marginTop: 3, marginBottom: 2 }}>
                  Registered lines: {assets.map(a => `${a.line_no} (${a.asset_model_id})`).join('  ·  ')}
                </Text>
              )}

              {/* Asset Model ID — auto-filled when line matched, editable for new */}
              <Text style={styles.fieldLabel}>Asset Model ID *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={lineNo ? 'Auto-filled or type new asset model ID...' : 'Enter Line No first'}
                value={assetModelId}
                onChangeText={handleAssetModelChange}
                onBlur={handleAssetModelBlur}
                editable={!!lineNo}
              />

              {/* Date picker */}
              <Text style={styles.fieldLabel}>Date *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={entryDate}
                  max={todayISO()}
                  onChange={e => setEntryDate(e.target.value)}
                  style={{
                    borderWidth: 1, border: '1px solid #cbd5e0', borderRadius: 6,
                    padding: '8px 10px', fontSize: 14, color: '#2d3748',
                    width: '100%', boxSizing: 'border-box', marginBottom: 2,
                  }}
                />
              ) : (
                <TextInput
                  style={styles.fieldInput}
                  placeholder="YYYY-MM-DD"
                  value={entryDate}
                  onChangeText={v => {
                    if (v <= todayISO()) setEntryDate(v);
                    else showAlert('Validation', 'Future dates are not allowed.');
                  }}
                />
              )}

              {/* Time — auto-set on camera click, read-only */}
              <Text style={styles.fieldLabel}>Time (auto-set on capture)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputDisabled]}
                value={entryTime ? entryTime.substring(0, 5) : '—'}
                editable={false}
              />

              {/* SKU Name search */}
              <Text style={styles.fieldLabel}>SKU Name</Text>
              <View style={styles.dropdownContainer}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Search SKU name..."
                  value={skuName}
                  onChangeText={handleSkuNameChange}
                  onFocus={() => skuNameOptions.length > 0 && setSkuNameDropdownVisible(true)}
                />
                {skuNameDropdownVisible && skuNameOptions.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 140 }}>
                      {skuNameOptions.map((item, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.dropdownItem}
                          onPress={() => selectSkuByName(item)}
                        >
                          <Text style={styles.dropdownItemText}>{item.product_name}</Text>
                          <Text style={styles.dropdownItemSub}>{item.item_number}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* SKU Item ID search */}
              <Text style={styles.fieldLabel}>SKU Item ID</Text>
              <View style={styles.dropdownContainer}>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Search SKU item ID..."
                  value={skuItemId}
                  onChangeText={handleSkuIdChange}
                  onFocus={() => skuIdOptions.length > 0 && setSkuIdDropdownVisible(true)}
                />
                {skuIdDropdownVisible && skuIdOptions.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 140 }}>
                      {skuIdOptions.map((item, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.dropdownItem}
                          onPress={() => selectSkuById(item)}
                        >
                          <Text style={styles.dropdownItemText}>{item.item_number}</Text>
                          <Text style={styles.dropdownItemSub}>{item.product_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Username — read only */}
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputDisabled]}
                value={userData?.username || ''}
                editable={false}
              />

              {/* Camera capture */}
              <Text style={styles.fieldLabel}>Image (Camera Only) *</Text>
              <TouchableOpacity
                style={[styles.cameraButton, isSubmitting && styles.cameraButtonDisabled]}
                onPress={handleCameraCapture}
                disabled={isSubmitting}
              >
                <Text style={styles.cameraButtonText}>📷 Capture Image</Text>
              </TouchableOpacity>

              {/* Web hidden file input — camera only */}
              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              )}

              {capturedImage && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: capturedImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <Text style={styles.imagePreviewLabel}>Image captured ✓</Text>
                </View>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitButtonText}>Submit</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Quantity Confirm Popup ── */}
      <Modal
        visible={editPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setEditPopupVisible(false); cancelEditQty(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Quantity Edit</Text>
            <Text style={styles.confirmRemark}>{editTarget?.remark}</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setEditPopupVisible(false); cancelEditQty(); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleEditConfirm}>
                <Text style={styles.submitButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Register New Asset Popup ── */}
      <Modal
        visible={registerAssetPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => handleRegisterNewAsset(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Register New Asset?</Text>
            <Text style={styles.confirmRemark}>
              {`Asset Model ID "${pendingNewAsset?.assetModelId}" is not registered for Line ${pendingNewAsset?.lineNo} at ${pendingNewAsset?.location}.\n\nDo you want to register it as a new asset?`}
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleRegisterNewAsset(false)}
              >
                <Text style={styles.cancelButtonText}>NO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => handleRegisterNewAsset(true)}
              >
                <Text style={styles.submitButtonText}>YES</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Asset Model ID Already Exists on Different Line Popup ── */}
      <Modal
        visible={assetExistsPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAssetExistsPopupVisible(false);
          setAssetModelId('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Asset Model ID Exists</Text>
            <Text style={styles.confirmRemark}>{assetExistsMessage}</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => {
                  setAssetExistsPopupVisible(false);
                  setAssetModelId('');
                }}
              >
                <Text style={styles.submitButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CoPackerDashboard;
