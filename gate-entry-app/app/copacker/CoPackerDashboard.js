// app/copacker/CoPackerDashboard.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, SafeAreaView,
  ScrollView, Modal, TextInput, ActivityIndicator, Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentUser } from '../../utils/jwtUtils';
import { copackerAPI, authAPI, handleAPIError } from '../../services/api';
import { showAlert } from '../../utils/customModal';
import { storage } from '../../utils/storage';
import { API_BASE_URL } from '../../services/api';
import { useCopackerStyles } from './styles/copackerStyles';

// ── Constants ──────────────────────────────────────────────────────────────────
const STEP_LABELS = {
  1: 'Blow Molder',
  2: 'Bottling',
  3: 'Labelling',
  4: 'Case Counter',
};

const STEP_COLORS = {
  1: '#2b6cb0',   // blue
  2: '#276749',   // green
  3: '#c05621',   // orange
  4: '#553c9a',   // purple
};

const CAPTURE_TYPE_COLOR = {
  blow_molder:  '#2b6cb0',
  bottling:     '#276749',
  labelling:    '#c05621',
  case_counter: '#553c9a',
};

const CAPTURE_TYPE_LABEL = {
  blow_molder:  'Blow Molder',
  bottling:     'Bottling',
  labelling:    'Labelling',
  case_counter: 'Case Counter',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const nowTimeISO = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

const fmtNum = (val) => {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-IN');
};

const toISTDateTimeStr = (utcStr) => {
  if (!utcStr) return { date: '—', time: '—' };
  const utcMs = new Date(utcStr).getTime();
  const istMs = utcMs + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const y = ist.getUTCFullYear();
  const hr = String(ist.getUTCHours()).padStart(2, '0');
  const mn = String(ist.getUTCMinutes()).padStart(2, '0');
  return { date: `${d}-${m}-${y}`, time: `${hr}:${mn}` };
};

const toISTDateOnly = (utcStr) => toISTDateTimeStr(utcStr).date;

const todayISTDateStr = () => {
  const utcMs = Date.now();
  const istMs = utcMs + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
};

const isCapturedToday = (capturedAt) => {
  if (!capturedAt) return false;
  const utcMs = new Date(capturedAt).getTime();
  const istMs = utcMs + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const capDate = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
  return capDate === todayISTDateStr();
};


// ── Main Component ─────────────────────────────────────────────────────────────
const CoPackerDashboard = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 600;
  const styles  = useCopackerStyles();

  const [userData, setUserData]                 = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [fieldEditEnabled, setFieldEditEnabled] = useState(false);

  // Sessions table
  const [sessions, setSessions]               = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedDate, setSelectedDate]       = useState(todayISO());
  const [expandedIds, setExpandedIds]         = useState(new Set()); // session IDs

  // ── Session creation modal ─────────────────────────────────────────────────
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [modalStep, setModalStep]     = useState(0); // 0=setup, 1-4=captures
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 0 setup
  const [sessionLineNo, setSessionLineNo]     = useState('');
  const [sessionSkuName, setSessionSkuName]   = useState('');
  const [sessionSkuItemId, setSessionSkuItemId] = useState('');

  // Created session
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Per-step capture state
  const [capturedImage, setCapturedImage]     = useState(null); // current step image
  const [currentAssetId, setCurrentAssetId]   = useState('');  // current step asset ID
  const [carryAssetId, setCarryAssetId]       = useState('');  // carried forward from step 1
  const [captureResults, setCaptureResults]   = useState([null, null, null, null]);

  // Asset ID history dropdown (proximity search)
  const [assetHistory, setAssetHistory]             = useState([]);
  const [assetHistoryVisible, setAssetHistoryVisible] = useState(false);

  // SKU search dropdowns
  const [skuNameOptions, setSkuNameOptions]               = useState([]);
  const [skuNameDropdownVisible, setSkuNameDropdownVisible] = useState(false);
  const [skuIdOptions, setSkuIdOptions]                   = useState([]);
  const [skuIdDropdownVisible, setSkuIdDropdownVisible]   = useState(false);

  // Edit state (asset ID editing in expanded rows)
  const [editingCapture, setEditingCapture]   = useState(null); // { captureId, currentValue }
  const [editAssetValue, setEditAssetValue]   = useState('');
  const [editConfirmVisible, setEditConfirmVisible] = useState(false);
  const [editTarget, setEditTarget]           = useState(null);

  // Image preview
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl]         = useState(null);

  // File input (web)
  const fileInputRef = useRef(null);

  // ── Load user + feature flags ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) { router.replace('/LoginScreen'); return; }
      setUserData(user);
      try {
        const status = await copackerAPI.featureStatus();
        setFieldEditEnabled(status.field_edit_enabled || false);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (userData?.copackerLocation) {
      loadSessions(userData.copackerLocation, selectedDate);
    }
  }, [userData]);

  // ── Load sessions ──────────────────────────────────────────────────────────
  const loadSessions = useCallback(async (location, dateStr) => {
    if (!location) return;
    setSessionsLoading(true);
    try {
      const data = await copackerAPI.getSessions(location, dateStr);
      setSessions(data);
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setSessionsLoading(false);
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
        },
      },
    ]);
  };

  // ── Expand / collapse session row ─────────────────────────────────────────
  const toggleExpand = (sessionId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  // ── Open new session modal ─────────────────────────────────────────────────
  const openSessionModal = () => {
    setModalStep(0);
    setSessionLineNo('');
    setSessionSkuName('');
    setSessionSkuItemId('');
    setActiveSessionId(null);
    setCapturedImage(null);
    setCurrentAssetId('');
    setCarryAssetId('');
    setCaptureResults([null, null, null, null]);
    setSkuNameOptions([]); setSkuNameDropdownVisible(false);
    setSkuIdOptions([]);   setSkuIdDropdownVisible(false);
    setAssetHistory([]); setAssetHistoryVisible(false);
    setSessionModalVisible(true);
  };

  const closeSessionModal = () => {
    setSessionModalVisible(false);
  };

  // ── SKU search ─────────────────────────────────────────────────────────────
  const handleSkuNameChange = async (val) => {
    setSessionSkuName(val);
    if (!val || val.length < 2) { setSkuNameOptions([]); setSkuNameDropdownVisible(false); return; }
    try {
      const results = await copackerAPI.skuSearch(val, 'name');
      setSkuNameOptions(results);
      setSkuNameDropdownVisible(results.length > 0);
    } catch (_) {}
  };

  const selectSkuByName = (item) => {
    setSessionSkuName(item.product_name);
    setSessionSkuItemId(item.item_number);
    setSkuNameOptions([]); setSkuNameDropdownVisible(false);
  };

  const handleSkuIdChange = async (val) => {
    setSessionSkuItemId(val);
    if (!val || val.length < 2) { setSkuIdOptions([]); setSkuIdDropdownVisible(false); return; }
    try {
      const results = await copackerAPI.skuSearch(val, 'itemid');
      setSkuIdOptions(results);
      setSkuIdDropdownVisible(results.length > 0);
    } catch (_) {}
  };

  const selectSkuById = (item) => {
    setSessionSkuItemId(item.item_number);
    setSessionSkuName(item.product_name);
    setSkuIdOptions([]); setSkuIdDropdownVisible(false);
  };

  // ── Asset ID proximity search ──────────────────────────────────────────────
  const loadAssetHistory = async (q = '') => {
    if (!userData?.copackerLocation) return;
    try {
      const results = await copackerAPI.getAssetHistory(userData.copackerLocation, q);
      setAssetHistory(results);
      setAssetHistoryVisible(results.length > 0);
    } catch (_) {}
  };

  const handleAssetIdChange = (val) => {
    setCurrentAssetId(val);
    if (val.length >= 1) loadAssetHistory(val);
    else { setAssetHistory([]); setAssetHistoryVisible(false); }
  };

  const selectAssetFromHistory = (assetId) => {
    setCurrentAssetId(assetId);
    setAssetHistory([]); setAssetHistoryVisible(false);
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const handleCameraCapture = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(file.type) && !['jpg', 'jpeg', 'png'].includes(ext)) {
      showAlert('Invalid File', 'Only JPEG, JPG, and PNG images are accepted.');
      e.target.value = '';
      return;
    }
    setCapturedImage({ uri: URL.createObjectURL(file), file });
    e.target.value = '';
  };

  // ── Step 0 → create session ────────────────────────────────────────────────
  const handleStartSession = async () => {
    const lineNum = parseInt(sessionLineNo, 10);
    if (!sessionLineNo || isNaN(lineNum) || lineNum < 1) {
      showAlert('Validation', 'Please enter a valid Line No.'); return;
    }
    setIsProcessing(true);
    try {
      const session = await copackerAPI.createSession(
        userData.copackerLocation,
        lineNum,
        sessionSkuName.trim() || null,
        sessionSkuItemId.trim() || null,
      );
      setActiveSessionId(session.id);
      // Reset capture state for step 1
      setCapturedImage(null);
      setCurrentAssetId('');
      setAssetHistory([]); setAssetHistoryVisible(false);
      setModalStep(1);
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Steps 1-4 → submit capture ────────────────────────────────────────────
  const handleSubmitCapture = async () => {
    if (!capturedImage) {
      showAlert('Validation', 'Please capture an image first.'); return;
    }
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('asset_model_id', currentAssetId.trim());
      if (Platform.OS === 'web' && capturedImage.file) {
        formData.append('image', capturedImage.file, capturedImage.file.name);
      } else {
        const filename = capturedImage.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('image', { uri: capturedImage.uri, name: filename, type });
      }

      const result = await copackerAPI.submitCapture(activeSessionId, formData);

      // Store result for this step
      const newResults = [...captureResults];
      newResults[modalStep - 1] = result;
      setCaptureResults(newResults);

      // Carry asset ID from step 1 to steps 2 and 3
      if (modalStep === 1) {
        setCarryAssetId(result.asset_model_id || currentAssetId.trim() || '');
      }

      if (modalStep === 4) {
        // Session complete
        setSessionModalVisible(false);
        showAlert('Success', 'Production session recorded successfully!', [
          { text: 'OK', onPress: () => loadSessions(userData.copackerLocation, selectedDate) },
        ]);
      } else {
        // Advance to next step
        const nextStep = modalStep + 1;
        setCapturedImage(null);
        // Pre-fill asset ID for steps 2 and 3 from carry-forward; step 4 starts blank (OCR will try)
        const nextAsset = nextStep <= 3 ? (carryAssetId || newResults[0]?.asset_model_id || '') : '';
        setCurrentAssetId(nextAsset);
        setAssetHistory([]); setAssetHistoryVisible(false);
        setModalStep(nextStep);
      }
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Asset ID inline edit (in expanded session rows) ───────────────────────
  const startEditAsset = (capture) => {
    setEditingCapture({ captureId: capture.id });
    setEditAssetValue(capture.asset_model_id || '');
  };

  const cancelEditAsset = () => {
    setEditingCapture(null);
    setEditAssetValue('');
  };

  const confirmAssetEdit = (capture) => {
    const val = editAssetValue.trim();
    if (!val) { showAlert('Validation', 'Asset ID cannot be empty.'); return; }
    setEditTarget({ captureId: capture.id, sessionId: capture.session_id, newValue: val, original: capture.asset_model_id });
    setEditConfirmVisible(true);
  };

  const handleEditConfirm = async () => {
    setEditConfirmVisible(false);
    if (!editTarget) return;
    try {
      await copackerAPI.editCaptureAsset(editTarget.captureId, editTarget.newValue);
      cancelEditAsset();
      // Update in-place
      setSessions(prev => prev.map(s => {
        if (s.id !== editTarget.sessionId) return s;
        return {
          ...s,
          captures: s.captures.map(c =>
            c.id === editTarget.captureId ? { ...c, asset_model_id: editTarget.newValue } : c
          ),
        };
      }));
      showAlert('Success', 'Asset ID updated.');
    } catch (e) {
      showAlert('Error', handleAPIError(e));
    } finally {
      setEditTarget(null);
    }
  };

  // ── Image preview ──────────────────────────────────────────────────────────
  const openImagePreview = (relativePath) => {
    if (!relativePath) return;
    setImagePreviewUrl(`${API_BASE_URL}/copacker-images/${relativePath}`);
    setImagePreviewVisible(true);
  };

  // ── Render: capture card (inside expanded session row) ─────────────────────
  const renderCaptureCard = (capture, sessionSubmittedBy) => {
    const color = CAPTURE_TYPE_COLOR[capture.capture_type] || '#4a5568';
    const label = CAPTURE_TYPE_LABEL[capture.capture_type] || capture.capture_type;
    const isOwner = sessionSubmittedBy === userData?.username;
    const isToday = isCapturedToday(capture.captured_at);
    const canEditAsset = isOwner && isToday;
    const isEditingThis = editingCapture?.captureId === capture.id;

    return (
      <View
        key={capture.id}
        style={{
          marginHorizontal: 8,
          marginBottom: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          borderLeftWidth: 4,
          borderLeftColor: color,
          backgroundColor: '#fafafa',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: color + '14',
          paddingHorizontal: 10, paddingVertical: 6,
          borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
        }}>
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: color, marginRight: 6,
          }} />
          <Text style={{ fontWeight: 'bold', fontSize: 12, color, flex: 1 }}>
            {label}
          </Text>
          {/* Thumbnail */}
          {capture.image_path ? (
            <TouchableOpacity onPress={() => openImagePreview(capture.image_path)}>
              <Image
                source={{ uri: `${API_BASE_URL}/copacker-images/${capture.image_path}` }}
                style={{ width: 40, height: 40, borderRadius: 4 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <View style={{
              width: 40, height: 40, borderRadius: 4,
              backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 16 }}>📷</Text>
            </View>
          )}
        </View>

        {/* Card body */}
        <View style={{ padding: 10 }}>
          {/* Asset ID row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 11, color: '#718096', width: 60 }}>Asset ID</Text>
            {isEditingThis ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <TextInput
                  style={{
                    flex: 1, borderWidth: 1, borderColor: '#3182ce',
                    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3,
                    fontSize: 12, color: '#1a365d', backgroundColor: '#ebf8ff',
                  }}
                  value={editAssetValue}
                  onChangeText={setEditAssetValue}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => confirmAssetEdit(capture)}
                  style={{ backgroundColor: '#38a169', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={cancelEditAsset}
                  style={{ backgroundColor: '#e53e3e', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#2d3748', flex: 1 }}>
                  {capture.asset_model_id || '—'}
                </Text>
                {canEditAsset && (
                  <TouchableOpacity
                    onPress={() => startEditAsset(capture)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ marginLeft: 6 }}
                  >
                    <Text style={{ fontSize: 12 }}>✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Machine-specific fields */}
          {capture.capture_type === 'blow_molder' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              <FieldChip label="Recipe" value={capture.bottle_recipe} wide />
              <FieldChip label="Pf Total"  value={fmtNum(capture.preform_total)} />
              <FieldChip label="Pf Shift"  value={fmtNum(capture.preform_shift)} />
              <FieldChip label="Bt Total"  value={fmtNum(capture.bottles_total)} />
              <FieldChip label="Bt Shift"  value={fmtNum(capture.bottles_shift)} />
              <FieldChip label="Op Hours"  value={capture.operating_hours != null ? `${fmtNum(capture.operating_hours)} h` : '—'} />
            </View>
          )}

          {capture.capture_type === 'bottling' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              <FieldChip label="Bottles Total" value={fmtNum(capture.bottles_total)} />
              <FieldChip label="Speed (BPH)"   value={fmtNum(capture.production_speed_bph)} />
            </View>
          )}

          {capture.capture_type === 'labelling' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              <FieldChip label="Labels Count" value={fmtNum(capture.labels_count)} />
              <FieldChip label="Format"       value={capture.label_format} />
            </View>
          )}

          {capture.capture_type === 'case_counter' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              <FieldChip label="Packs Counter" value={fmtNum(capture.packs_counter)} />
              <FieldChip label="Format"        value={capture.pack_format} />
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Render: session row ────────────────────────────────────────────────────
  const renderSessionRow = (session, index) => {
    const isExpanded = expandedIds.has(session.id);
    const { date: dtDate, time: dtTime } = toISTDateTimeStr(session.created_at);
    const captureCount = session.captures?.length || 0;
    const isComplete   = session.status === 'completed';

    return (
      <View key={session.id} style={{
        borderBottomWidth: 1, borderColor: '#e2e8f0',
        backgroundColor: index % 2 === 0 ? '#f7fafc' : '#fff',
      }}>
        {/* Session summary row */}
        <TouchableOpacity
          onPress={() => toggleExpand(session.id)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 }}>
            {/* Sr */}
            <Text style={{ width: 36, fontSize: 12, color: '#718096', textAlign: 'center' }}>{index + 1}</Text>

            {/* Date + Time */}
            <View style={{ width: 130, alignItems: 'flex-start', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#2d3748' }}>{dtDate}</Text>
              <Text style={{ fontSize: 11, color: '#718096' }}>{dtTime}</Text>
            </View>

            {/* Line No */}
            <Text style={{ width: 44, fontSize: 12, color: '#2d3748', textAlign: 'center' }}>
              {session.line_no}
            </Text>

            {/* SKU */}
            <Text
              style={{ flex: 1, fontSize: 12, color: '#2d3748', paddingHorizontal: 4 }}
              numberOfLines={1}
            >
              {session.sku_name || '—'}
            </Text>

            {/* Status badge */}
            <View style={{
              width: 90,
              backgroundColor: isComplete ? '#c6f6d5' : '#feebc8',
              borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3,
              alignItems: 'center', marginHorizontal: 4,
            }}>
              <Text style={{
                fontSize: 10, fontWeight: '700',
                color: isComplete ? '#276749' : '#c05621',
              }}>
                {isComplete ? `✓ Complete` : `⏳ ${captureCount}/4`}
              </Text>
            </View>

            {/* Expand toggle */}
            <Text style={{ width: 28, fontSize: 14, textAlign: 'center', color: '#4a5568' }}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Expanded capture cards */}
        {isExpanded && (
          <View style={{ paddingBottom: 8, backgroundColor: '#f0f4f8' }}>
            {session.captures && session.captures.length > 0 ? (
              session.captures.map(cap => renderCaptureCard(cap, session.submitted_by))
            ) : (
              <Text style={{ fontSize: 12, color: '#a0aec0', textAlign: 'center', padding: 12 }}>
                No captures yet for this session.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Render: step progress bar ─────────────────────────────────────────────
  const renderProgress = (currentStep) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
      {[1, 2, 3, 4].map(s => (
        <React.Fragment key={s}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: s < currentStep ? '#38a169' : s === currentStep ? STEP_COLORS[s] : '#e2e8f0',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: s < currentStep || s === currentStep ? '#fff' : '#a0aec0', fontSize: 11, fontWeight: 'bold' }}>
                {s < currentStep ? '✓' : s}
              </Text>
            </View>
            <Text style={{ fontSize: 9, color: s === currentStep ? STEP_COLORS[s] : '#718096', marginTop: 2, textAlign: 'center' }}>
              {STEP_LABELS[s]}
            </Text>
          </View>
          {s < 4 && (
            <View style={{
              height: 2, flex: 0.5,
              backgroundColor: s < currentStep ? '#38a169' : '#e2e8f0',
              marginBottom: 12,
            }} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // ── Render: OCR results after capture ────────────────────────────────────
  const renderOcrResult = (result) => {
    if (!result) return null;
    const lines = [];
    if (result.capture_type === 'blow_molder') {
      lines.push(['Recipe', result.bottle_recipe]);
      lines.push(['Preform Total', fmtNum(result.preform_total)]);
      lines.push(['Preform Shift', fmtNum(result.preform_shift)]);
      lines.push(['Bottles Total', fmtNum(result.bottles_total)]);
      lines.push(['Bottles Shift', fmtNum(result.bottles_shift)]);
      lines.push(['Op Hours', result.operating_hours != null ? `${fmtNum(result.operating_hours)} h` : '—']);
    } else if (result.capture_type === 'bottling') {
      lines.push(['Bottles Total', fmtNum(result.bottles_total)]);
      lines.push(['Speed (BPH)', fmtNum(result.production_speed_bph)]);
    } else if (result.capture_type === 'labelling') {
      lines.push(['Labels Count', fmtNum(result.labels_count)]);
      lines.push(['Format', result.label_format]);
    } else if (result.capture_type === 'case_counter') {
      lines.push(['Packs Counter', fmtNum(result.packs_counter)]);
      lines.push(['Format', result.pack_format]);
    }

    return (
      <View style={{
        backgroundColor: '#f0fff4', borderRadius: 8, padding: 10,
        borderWidth: 1, borderColor: '#c6f6d5', marginTop: 8,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#276749', marginBottom: 6 }}>
          ✓ OCR Extracted — Step {result.step_order} of 4
        </Text>
        <Text style={{ fontSize: 11, color: '#4a5568', marginBottom: 4 }}>
          Asset ID: <Text style={{ fontWeight: '700' }}>{result.asset_model_id || '—'}</Text>
        </Text>
        {lines.map(([label, val], i) => (
          <Text key={i} style={{ fontSize: 11, color: '#4a5568' }}>
            {label}: <Text style={{ fontWeight: '600' }}>{val ?? '—'}</Text>
          </Text>
        ))}
      </View>
    );
  };

  // ── Render: capture step content (steps 1-4) ──────────────────────────────
  const renderCaptureStepContent = () => {
    const stepIdx   = modalStep - 1;
    const stepColor = STEP_COLORS[modalStep];
    const stepLabel = STEP_LABELS[modalStep];
    const result    = captureResults[stepIdx];

    return (
      <View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: stepColor, marginBottom: 12 }}>
          Step {modalStep} of 4 — {stepLabel}
        </Text>

        {/* Asset ID with proximity search */}
        <Text style={styles.fieldLabel}>Asset Model ID</Text>
        <View style={styles.dropdownContainer}>
          <TextInput
            style={styles.fieldInput}
            placeholder="Type or search previously used asset IDs..."
            value={currentAssetId}
            onChangeText={handleAssetIdChange}
            onFocus={() => { if (currentAssetId.length >= 1) loadAssetHistory(currentAssetId); }}
          />
          {assetHistoryVisible && assetHistory.length > 0 && (
            <View style={styles.dropdown}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
                {assetHistory.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.dropdownItem}
                    onPress={() => selectAssetFromHistory(item.asset_model_id)}
                  >
                    <Text style={styles.dropdownItemText}>{item.asset_model_id}</Text>
                    <Text style={styles.dropdownItemSub}>Last used: {toISTDateOnly(item.last_used)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 10, color: '#718096', marginTop: 3, marginBottom: 10 }}>
          {modalStep <= 3 && carryAssetId && modalStep > 1
            ? `💡 Carried forward from Blow Molder: ${carryAssetId}`
            : 'Leave blank to use OCR-extracted value.'}
        </Text>

        {/* Camera capture */}
        <Text style={styles.fieldLabel}>Machine Image *</Text>
        <TouchableOpacity
          style={[styles.cameraButton, { backgroundColor: stepColor }, isProcessing && styles.cameraButtonDisabled]}
          onPress={handleCameraCapture}
          disabled={isProcessing}
        >
          <Text style={styles.cameraButtonText}>📷 Capture Image</Text>
        </TouchableOpacity>

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

        {/* OCR results from previous submit of this step */}
        {result && renderOcrResult(result)}
      </View>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════════════════════════════════════════
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
          <>
            {isSmall && (
              <TouchableOpacity
                onPress={() => setIsSidebarVisible(false)}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 99,
                }}
                activeOpacity={1}
              />
            )}
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
          </>
        )}

        {/* ── Main content ── */}
        <View style={styles.mainContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>

            {/* Title row */}
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>Co Packer Sessions</Text>
              <TouchableOpacity style={styles.addButton} onPress={openSessionModal}>
                <Text style={styles.addButtonText}>+ New Session</Text>
              </TouchableOpacity>
            </View>

            {/* Date filter */}
            <View style={[styles.dateRow, { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }]}>
              <Text style={styles.dateLabel}>Date:</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={selectedDate}
                  max={todayISO()}
                  onChange={e => {
                    setSelectedDate(e.target.value);
                    if (userData?.copackerLocation) loadSessions(userData.copackerLocation, e.target.value);
                  }}
                  style={{
                    border: '1px solid #cbd5e0', borderRadius: 6,
                    padding: '4px 8px', fontSize: 13, color: '#2d3748',
                  }}
                />
              ) : (
                <TextInput
                  style={[styles.fieldInput, { width: 130, marginBottom: 0 }]}
                  value={selectedDate}
                  onChangeText={v => {
                    setSelectedDate(v);
                    if (userData?.copackerLocation) loadSessions(userData.copackerLocation, v);
                  }}
                  placeholder="YYYY-MM-DD"
                />
              )}
              <Text style={styles.dateLabel}>— Location: {userData?.copackerLocation || '—'}</Text>
            </View>

            {/* Sessions table */}
            <View style={[styles.tableWrapper, { borderRadius: 8 }]}>

              {/* Table header */}
              <View style={[styles.tableHeader, { paddingHorizontal: 8 }]}>
                <Text style={[styles.tableHeaderCell, { width: 36 }]}>Sr.</Text>
                <Text style={[styles.tableHeaderCell, { width: 130 }]}>Date / Time</Text>
                <Text style={[styles.tableHeaderCell, { width: 44 }]}>Line</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>SKU</Text>
                <Text style={[styles.tableHeaderCell, { width: 90 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { width: 28 }]}> </Text>
              </View>

              {/* Rows */}
              {sessionsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2b6cb0" />
                </View>
              ) : sessions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.thumbnailPlaceholderText}>📋</Text>
                  <Text style={styles.emptyText}>No sessions for this date</Text>
                </View>
              ) : (
                sessions.map((session, index) => renderSessionRow(session, index))
              )}
            </View>

          </ScrollView>
        </View>
      </View>

      {/* ════════════════════════════════════════════════════════════════════
          New Session Modal
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={sessionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSessionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>

            {/* Modal header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>
                {modalStep === 0 ? 'New Production Session' : `Session Capture — Step ${modalStep} of 4`}
              </Text>
              <TouchableOpacity onPress={closeSessionModal} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#718096', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Progress (shown for steps 1-4) */}
            {modalStep >= 1 && renderProgress(modalStep)}

            <ScrollView style={styles.modalScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">

              {/* ── Step 0: Setup ── */}
              {modalStep === 0 && (
                <View>
                  <Text style={styles.fieldLabel}>Location</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldInputDisabled]}
                    value={userData?.copackerLocation || ''}
                    editable={false}
                  />

                  <Text style={styles.fieldLabel}>Line No *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Enter production line number..."
                    value={sessionLineNo}
                    onChangeText={v => setSessionLineNo(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                  />

                  <Text style={styles.fieldLabel}>SKU Name</Text>
                  <View style={styles.dropdownContainer}>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Search SKU name..."
                      value={sessionSkuName}
                      onChangeText={handleSkuNameChange}
                      onFocus={() => skuNameOptions.length > 0 && setSkuNameDropdownVisible(true)}
                    />
                    {skuNameDropdownVisible && skuNameOptions.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
                          {skuNameOptions.map((item, i) => (
                            <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => selectSkuByName(item)}>
                              <Text style={styles.dropdownItemText}>{item.product_name}</Text>
                              <Text style={styles.dropdownItemSub}>{item.item_number}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <Text style={styles.fieldLabel}>SKU Item ID</Text>
                  <View style={styles.dropdownContainer}>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Search SKU item ID..."
                      value={sessionSkuItemId}
                      onChangeText={handleSkuIdChange}
                      onFocus={() => skuIdOptions.length > 0 && setSkuIdDropdownVisible(true)}
                    />
                    {skuIdDropdownVisible && skuIdOptions.length > 0 && (
                      <View style={styles.dropdown}>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
                          {skuIdOptions.map((item, i) => (
                            <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => selectSkuById(item)}>
                              <Text style={styles.dropdownItemText}>{item.item_number}</Text>
                              <Text style={styles.dropdownItemSub}>{item.product_name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <Text style={{ fontSize: 11, color: '#718096', marginTop: 8 }}>
                    You will capture 4 machine images in sequence after this.
                  </Text>
                  <View style={{ height: 16 }} />
                </View>
              )}

              {/* ── Steps 1-4: Capture ── */}
              {modalStep >= 1 && renderCaptureStepContent()}

              <View style={{ height: 12 }} />
            </ScrollView>

            {/* Modal buttons */}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeSessionModal}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {modalStep === 0 && (
                <TouchableOpacity
                  style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
                  onPress={handleStartSession}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitButtonText}>Start →</Text>
                  }
                </TouchableOpacity>
              )}

              {modalStep >= 1 && (
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { backgroundColor: STEP_COLORS[modalStep] },
                    isProcessing && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmitCapture}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitButtonText}>
                        {modalStep === 4 ? '✓ Complete Session' : `Submit & Next →`}
                      </Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          Edit Asset Confirm Popup
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={editConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setEditConfirmVisible(false); cancelEditAsset(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm Asset ID Edit</Text>
            <Text style={styles.confirmRemark}>
              {`Change Asset ID from "${editTarget?.original || '—'}" to "${editTarget?.newValue}"?`}
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setEditConfirmVisible(false); cancelEditAsset(); }}
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

      {/* ════════════════════════════════════════════════════════════════════
          Image Full-Screen Preview Modal
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setImagePreviewVisible(false)}
            style={{
              position: 'absolute', top: 20, right: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 20, width: 40, height: 40,
              alignItems: 'center', justifyContent: 'center', zIndex: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
          {imagePreviewUrl && (
            <Image
              source={{ uri: imagePreviewUrl }}
              style={{ width: '92%', height: '82%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
};

// ── Small reusable field display chip ─────────────────────────────────────────
const FieldChip = ({ label, value, wide }) => (
  <View style={{
    backgroundColor: '#edf2f7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...(wide ? { width: '100%', marginBottom: 2 } : { minWidth: 100 }),
  }}>
    <Text style={{ fontSize: 9, color: '#718096', marginBottom: 1 }}>{label}</Text>
    <Text style={{ fontSize: 11, fontWeight: '600', color: '#2d3748' }} numberOfLines={wide ? 2 : 1}>
      {value ?? '—'}
    </Text>
  </View>
);

export default CoPackerDashboard;
