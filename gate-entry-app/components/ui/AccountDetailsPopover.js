// components/ui/AccountDetailsPopover.js - Small "who am I" card anchored
// under the avatar, top-right (30 Oct 2026). Opened two ways: tapping the
// avatar chip directly, or tapping "Account Details" at the bottom of the
// hamburger menu — both render THIS component, so the fields are always
// identical, never two copies drifting apart.
import React from 'react';
import { View, Text, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAccountDetails } from '../../hooks/useAccountDetails';
import { ROLE_LABELS } from '../../config/navConfig';

const AccountDetailsPopover = ({ isVisible, onClose, userData }) => {
  const { colors } = useTheme();
  const { roles, details, initials } = useAccountDetails(userData, isVisible);

  if (!isVisible) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 110 }}>
      {/* Backdrop — tap outside to close */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }}
        onPress={onClose}
      />

      {/* Card — "small half page" per the 30 Oct 2026 request: a compact
          dropdown anchored top-right, not a full-screen sheet. */}
      <View style={{
        position: 'absolute', top: 60, right: 10, width: 300, maxHeight: '55%',
        backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border,
        elevation: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10,
      }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceMuted,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.textPrimary }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.textPrimary }} numberOfLines={1}>
              {userData?.fullName || userData?.username || 'Loading…'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {roles.map((role) => (
                <View key={role} style={{
                  backgroundColor: '#00843D', borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#fff', letterSpacing: 0.2 }}>
                    {ROLE_LABELS[role] || role}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialIcons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: 320 }}>
          <View style={{ padding: 16 }}>
            {details.map(([label, value]) => (
              <View key={label} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 1 }}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textPrimary }}>{value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default AccountDetailsPopover;
