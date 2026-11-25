import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { adminAPI, handleAPIError } from '../../../services/api';
import { showAlert } from '../../../utils/customModal';
import { UserResultRow, generatePassword, passwordStrength, shortLastLogin, initialsOf } from '../utils/userUi';

const ResetPasswordScreen = () => {
  const [searchQuery, setSearchQuery]   = useState('');
  const [matchingUsers, setMatching]    = useState([]);
  const [userFound, setUserFound]       = useState(null);
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPwd, setConfirmPwd]     = useState('');
  const [strength, setStrength]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [searching, setSearching]       = useState(false);
  const [showPwd, setShowPwd]           = useState(false);
  const [copied, setCopied]             = useState(false);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setUserFound(null); setMatching([]); resetPwdFields();
    if (!query.trim()) return;
    setSearching(true);
    try { setMatching((await adminAPI.searchUsers(query.trim())) || []); }
    catch (e) { console.error(e); }
    finally { setSearching(false); }
  };

  const handleSelect = (user) => {
    setSearchQuery(user.username);
    setUserFound(user);
    setMatching([]);
    resetPwdFields();
  };

  const resetPwdFields = () => { setNewPassword(''); setConfirmPwd(''); setStrength(''); setShowPwd(false); setCopied(false); };

  // 25 Nov 2026: one-click temporary password (fills both boxes, shown in
  // clear text so it can be read out / copied to the user).
  const handleGenerate = () => {
    const pw = generatePassword();
    onPwdChange(pw);
    setConfirmPwd(pw);
    setShowPwd(true);
    setCopied(false);
  };
  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(newPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch (e) { /* clipboard blocked — user can still read it */ }
  };

  const onPwdChange = (v) => {
    setNewPassword(v);
    if (!v) { setStrength(''); return; }
    setStrength(v.length < 6 ? 'weak' : v.length < 8 ? 'medium' : 'strong');
  };

  const handleReset = () => {
    if (!userFound) { showAlert('Error', 'Select a user first'); return; }
    if (!newPassword.trim()) { showAlert('Error', 'New password is required'); return; }
    if (newPassword.length < 6) { showAlert('Error', 'Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPwd) { showAlert('Error', 'Passwords do not match'); return; }
    showAlert('Confirm Reset', `Reset password for "${userFound.username}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: doReset },
    ]);
  };

  const doReset = async () => {
    setLoading(true);
    try {
      await adminAPI.resetPassword({ username: userFound.username, new_password: newPassword, confirm_password: confirmPwd });
      showAlert('Success', `Password for "${userFound.username}" has been reset!`, [
        { text: 'OK', onPress: () => { setSearchQuery(''); setUserFound(null); setMatching([]); resetPwdFields(); } },
      ]);
    } catch (e) { showAlert('Error', handleAPIError(e)); }
    finally { setLoading(false); }
  };

  const strengthColor = strength === 'weak' ? '#e53935' : strength === 'medium' ? '#fb8c00' : '#43a047';
  const isAd    = userFound && userFound.auth_type === 'ad';
  const isLocal = userFound && userFound.auth_type !== 'ad';

  return (
    <View style={S.page}>

      {/* ── CARD 1: Search + User Info ── */}
      <View style={S.card1}>
        <Text style={S.panelTitle}>Search User</Text>

        <View style={S.searchWrap}>
          <TextInput style={S.searchInput} placeholder="Type username, email or name..."
            value={searchQuery} onChangeText={handleSearch} autoCapitalize="none" />
          {searching && <ActivityIndicator style={{ position: 'absolute', right: 8, top: 10 }} size="small" color="#0F6B46" />}
          {matchingUsers.length > 0 && (
            <View style={S.searchDrop}>
              <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 6 }} nestedScrollEnabled>
                {matchingUsers.map(u => (
                  <UserResultRow key={u.username} user={u} onPress={() => handleSelect(u)} />
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* User info card */}
        {userFound && (
          <View style={S.userCard}>
            <View style={S.userAvatar}>
              <Text style={S.userAvatarText}>{initialsOf(userFound)}</Text>
            </View>
            <Text style={S.userName}>{userFound.first_name} {userFound.last_name}</Text>
            <Text style={S.userSub}>{userFound.username}</Text>
            {userFound.warehouse_code || userFound.warehouse_name ? (
              <Text style={[S.userSub, { marginTop: 4 }]}>📍 {userFound.warehouse_code}{userFound.warehouse_name ? ` — ${userFound.warehouse_name}` : ''}</Text>
            ) : null}
            <Text style={[S.userSub, { marginTop: 4 }]}>Last login: {shortLastLogin(userFound.last_login)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {(userFound.role || 'No role').split(',').map(r => r.trim()).filter(Boolean).map(r => (
                <View key={r} style={S.rolePill}><Text style={S.rolePillText}>{r}</Text></View>
              ))}
              <View style={[S.rolePill, userFound.is_active === false
                ? { backgroundColor: '#FCEBEB', borderColor: '#F0C4C4' } : null]}>
                <Text style={[S.rolePillText, userFound.is_active === false ? { color: '#A32D2D' } : null]}>
                  {userFound.is_active === false ? '○ Deactivated' : '● Active'}
                </Text>
              </View>
            </View>
            {isAd && (
              <View style={[S.rolePill, { backgroundColor: '#E6F1EC', borderColor: '#9CCBB8', marginTop: 4 }]}>
                <Text style={[S.rolePillText, { color: '#0B5236' }]}>AD Account</Text>
              </View>
            )}
          </View>
        )}

        {!userFound && !searchQuery && (
          <Text style={S.emptyHint}>Type to search by username, email or name</Text>
        )}
      </View>

      {/* ── CARD 2: Password Form ── */}
      <View style={S.card2}>
        {!userFound && (
          <View style={S.emptyState}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🔐</Text>
            <Text style={S.emptyStateText}>Search and select a user{'\n'}to reset their password</Text>
          </View>
        )}

        {isAd && (
          <View style={S.adBlock}>
            <Text style={S.adBlockTitle}>🏢 AD Account — Managed Externally</Text>
            <Text style={S.adBlockBody}>
              This user signs in via Active Directory. Passwords are managed by your IT department — not through this app.
              Contact your AD administrator to reset this user's password.
            </Text>
          </View>
        )}

        {isLocal && (
          <View style={S.pwdForm}>
            <Text style={S.formTitle}>Set a new password for {userFound.username}</Text>

            <TouchableOpacity style={S.genBtn} onPress={handleGenerate} accessibilityRole="button">
              <Text style={S.genBtnText}>⚄  Generate temporary password</Text>
            </TouchableOpacity>
            <Text style={S.orText}>or type one</Text>

            <Text style={S.label}>New Password</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput style={[S.input, { paddingRight: 120 }]} placeholder="Enter new password"
                secureTextEntry={!showPwd} value={newPassword} onChangeText={onPwdChange} autoCapitalize="none" />
              <View style={{ position: 'absolute', right: 8, top: 0, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} accessibilityLabel={showPwd ? 'Hide password' : 'Show password'} style={S.miniBtn}>
                  <Text style={S.miniBtnText}>{showPwd ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
                {newPassword ? (
                  <TouchableOpacity onPress={handleCopy} accessibilityLabel="Copy password" style={S.miniBtn}>
                    <Text style={S.miniBtnText}>{copied ? '✓ Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            {(() => {
              const st = passwordStrength(newPassword);
              return st ? (
                <View style={{ marginTop: -8, marginBottom: 12 }}>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: '#E0E9E5' }}>
                    <View style={{ height: 5, borderRadius: 3, width: `${st.pct}%`, backgroundColor: st.color }} />
                  </View>
                  <Text style={{ fontSize: 11.5, color: st.color, marginTop: 3, fontWeight: '600' }}>{st.label}</Text>
                </View>
              ) : null;
            })()}

            <Text style={S.label}>Confirm New Password</Text>
            <TextInput style={S.input} placeholder="Re-enter new password"
              secureTextEntry={!showPwd} value={confirmPwd} onChangeText={setConfirmPwd} autoCapitalize="none" />
            {confirmPwd ? (
              <Text style={{ fontSize: 12, marginTop: -8, marginBottom: 10, fontWeight: '600', color: confirmPwd === newPassword ? '#2FB164' : '#C62828' }}>
                {confirmPwd === newPassword ? '✓ Passwords match' : "✕ Passwords don't match"}
              </Text>
            ) : null}

            <TouchableOpacity style={[S.resetBtn, loading && S.resetBtnDis]} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.resetBtnText}>Reset password for {userFound.username}</Text>}
            </TouchableOpacity>
            <Text style={S.afterNote}>Share the new password with the user directly (call or in person).</Text>
          </View>
        )}
      </View>

    </View>
  );
};

export default ResetPasswordScreen;

const S = {
  page:           { flex: 1, flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#f4f6f8' },
  // Card 1
  card1:          { width: 280, backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e0e0e0', padding: 16, flexShrink: 0 },
  panelTitle:     { fontSize: 13, fontWeight: '700', color: '#00604F', marginBottom: 12 },
  searchWrap:     { position: 'relative', marginBottom: 12, zIndex: 99 },
  searchInput:    { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: '#333', backgroundColor: '#fafafa' },
  searchDrop:     { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#ccc', borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 99, elevation: 5 },
  searchItem:     { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  searchItemName: { fontSize: 13, fontWeight: '600', color: '#333' },
  searchItemSub:  { fontSize: 11, color: '#999' },
  searchItemRole: { fontSize: 11, color: '#0F6B46', fontWeight: '500', marginLeft: 6, flexShrink: 0 },
  // User card
  userCard:       { backgroundColor: '#F4FAF7', borderRadius: 10, borderWidth: 0.5, borderColor: '#C5E0D6', padding: 14, marginTop: 4 },
  userAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F6B46', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  userAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  userName:       { fontSize: 14, fontWeight: '700', color: '#00604F' },
  userSub:        { fontSize: 11, color: '#888', marginTop: 2 },
  rolePill:       { alignSelf: 'flex-start', backgroundColor: '#E6F1EC', borderRadius: 20, borderWidth: 0.5, borderColor: '#90bce8', paddingHorizontal: 9, paddingVertical: 3 },
  rolePillText:   { fontSize: 11, color: '#0F6B46', fontWeight: '600' },
  emptyHint:      { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 20, lineHeight: 17 },
  // Card 2
  card2:          { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e0e0e0', padding: 20 },
  emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { fontSize: 13, color: '#ccc', textAlign: 'center', lineHeight: 20 },
  // AD block
  adBlock:        { backgroundColor: '#E6F1EC', borderRadius: 10, borderWidth: 0.5, borderColor: '#9CCBB8', padding: 20, marginTop: 12 },
  adBlockTitle:   { fontSize: 14, fontWeight: '700', color: '#0B5236', marginBottom: 8 },
  adBlockBody:    { fontSize: 13, color: '#0F6B46', lineHeight: 20 },
  // Password form
  pwdForm:        { maxWidth: 420 },
  formTitle:      { fontSize: 15, fontWeight: '700', color: '#00604F', marginBottom: 18 },
  label:          { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 5 },
  input:          { backgroundColor: '#f8f9fa', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 14, fontSize: 14, color: '#333' },
  genBtn:         { backgroundColor: '#0F6B46', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  genBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  orText:         { textAlign: 'center', fontSize: 12, color: '#8B99A3', marginVertical: 10 },
  miniBtn:        { borderWidth: 1, borderColor: '#CFDDD7', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#fff' },
  miniBtnText:    { fontSize: 12, fontWeight: '600', color: '#0F6B46' },
  afterNote:      { fontSize: 12, color: '#8B99A3', marginTop: 10 },
  resetBtn:       { backgroundColor: '#C62828', paddingVertical: 13, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  resetBtnDis:    { backgroundColor: '#b0bec5' },
  resetBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
};
