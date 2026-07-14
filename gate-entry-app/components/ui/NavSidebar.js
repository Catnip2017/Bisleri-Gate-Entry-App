// components/ui/NavSidebar.js - The ONE sidebar, for all pages and all roles.
//
// Structure (identical for every role — only the config decides content):
//   1. Avatar + full name + role chips
//   2. Role-aware navigation links (from config/navConfig.js), current
//      page highlighted
//   3. Role-relevant detail rows (WH/site, or copacker location)
//   4. Pinned red Logout with confirmation — the single logout in the app
//   5. Footer: app version + connected server
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { authAPI, gatePassAPI, API_BASE_URL } from '../../services/api';
import { storage } from '../../utils/storage';
import { confirmAction } from '../../utils/customModal';
import {
  APP_VERSION,
  ROLE_LABELS,
  getUserDetails,
  getNavLinksForRoles,
} from '../../config/navConfig';

const NavSidebar = ({ isVisible, onClose, userData }) => {
  const router = useRouter();
  const pathname = usePathname();

  // Multi-location: the JWT only carries the legacy single gate_pass_location
  // (the ★ default). The full assigned list lives in the junction table, so
  // fetch it when the sidebar opens for guards / gate pass users. Skipped for
  // other roles (ITA without assignments would get the whole master back).
  const rolesForFetch = userData?.roles || [];
  const hasGpRole =
    rolesForFetch.includes('securityguard') || rolesForFetch.includes('gatepasscreator');
  const [gpLocationList, setGpLocationList] = useState(null);
  useEffect(() => {
    if (!isVisible || !hasGpRole) return;
    let cancelled = false;
    gatePassAPI.getMyLocations()
      .then((d) => { if (!cancelled) setGpLocationList(d.locations || []); })
      .catch(() => { if (!cancelled) setGpLocationList(null); });
    return () => { cancelled = true; };
  }, [isVisible, hasGpRole]);

  if (!isVisible) return null;

  const roles = userData?.roles || [];
  const links = getNavLinksForRoles(roles);
  let details = getUserDetails(userData);
  // Replace the single legacy value with the full assigned list (★ = default).
  if (gpLocationList && gpLocationList.length > 0) {
    const joined = gpLocationList
      .map((l) => l.location_code + (l.is_default && gpLocationList.length > 1 ? ' ★' : ''))
      .join(', ');
    details = details.map(([label, value]) =>
      label === 'Gate Pass Location'
        ? [gpLocationList.length > 1 ? 'Gate Pass Locations' : 'Gate Pass Location', joined]
        : [label, value]
    );
  }
  const initials = (userData?.fullName || userData?.username || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleNavigate = (route) => {
    onClose();
    if (pathname !== route) {
      router.push(route);
    }
  };

  const handleLogout = () => {
    confirmAction({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: async () => {
        try {
          await authAPI.logout();
        } catch (e) {
          console.log('Logout API error:', e);
        } finally {
          await storage.removeItem('access_token');
          onClose();
          router.replace('/LoginScreen');
        }
      },
    });
  };

  const isCurrent = (route) =>
    pathname === route || (route !== '/' && pathname?.startsWith(route + '/'));

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      flexDirection: 'row', zIndex: 100,
    }}>
      {/* Backdrop — tap outside to close */}
      <Pressable
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
        onPress={onClose}
      />

      {/* Panel */}
      <View style={{
        width: 290, height: '100%', backgroundColor: '#ffffff',
        elevation: 8,
        shadowColor: '#000', shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.3, shadowRadius: 8,
      }}>
        {/* 1. Identity */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5EDE8',
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: '#D5EEDF',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#064D28' }}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1A2E22' }} numberOfLines={1}>
              {userData?.fullName || userData?.username || 'Loading…'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {roles.map((role) => (
                <View key={role} style={{
                  backgroundColor: '#00843D', borderRadius: 10,
                  paddingHorizontal: 9, paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#fff', letterSpacing: 0.2 }}>
                    {ROLE_LABELS[role] || role}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <MaterialIcons name="close" size={22} color="#5C6B62" />
          </TouchableOpacity>
        </View>

        {/* 2. Navigation links (role-filtered, current highlighted) */}
        <ScrollView style={{ flex: 1 }}>
          <View style={{ paddingVertical: 8 }}>
            {links.map((link) => {
              const active = isCurrent(link.route);
              return (
                <TouchableOpacity
                  key={link.key}
                  onPress={() => handleNavigate(link.route)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    minHeight: 48, paddingHorizontal: 16,
                    backgroundColor: active ? '#D5EEDF' : 'transparent',
                    borderRightWidth: active ? 3 : 0,
                    borderRightColor: '#00A651',
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={link.label}
                >
                  <MaterialIcons
                    name={link.icon}
                    size={20}
                    color={active ? '#064D28' : '#5C6B62'}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: active ? 'bold' : '500',
                    color: active ? '#064D28' : '#1A2E22',
                  }}>
                    {link.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. Details */}
          {details.length > 0 && (
            <View style={{
              marginHorizontal: 16, marginTop: 8, padding: 12,
              backgroundColor: '#EAF7EF', borderRadius: 8,
            }}>
              {details.map(([label, value]) => (
                <View key={label} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: '#5C6B62', marginBottom: 1 }}>{label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1A2E22' }}>{value}</Text>
                </View>
              ))}
              <View>
                <Text style={{ fontSize: 11, color: '#5C6B62', marginBottom: 1 }}>Username</Text>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1A2E22' }}>
                  {userData?.username || '—'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 4. Pinned logout */}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#E5EDE8' }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, backgroundColor: '#C62828', minHeight: 48, borderRadius: 8,
            }}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <MaterialIcons name="logout" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Logout</Text>
          </TouchableOpacity>

          {/* 5. Footer */}
          <Text style={{
            marginTop: 10, fontSize: 10, color: '#9FB3A7', textAlign: 'center',
          }}>
            {APP_VERSION} · {String(API_BASE_URL || '').replace(/^https?:\/\//, '')}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default NavSidebar;
