// components/ui/FixedSidebar.js - Always-open left sidebar for desktop web
// (25 Nov 2026 UI overhaul, approved by the user; matches the Inventory
// portal wireframe: teal gradient panel, logo on top, profile, menu).
//
// Shown by AppShell only on wide WEB screens (>= WIDE_BREAKPOINT). Phones,
// narrow windows and the native apps keep the slide-in NavSidebar (☰).
//
// Sections:
//   1. Bisleri logo + OPS HUB
//   2. Profile: avatar, name, role label(s)
//   3. Optional "this app" section — the screen passes `appNav`
//      ({ title, items: [{ key, label, icon, active, badge, onPress }] }),
//      e.g. Gate Entry & Insights lists Gate Entry / Insights / Gate Pass.
//   4. "Ops Hub" section — the same role-filtered links as NavSidebar
//      (config/navConfig.js): Admin Hub, applications, User Management,
//      Documents.
//   5. Account Details row + Logout (same confirmation as NavSidebar) +
//      version footer.
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { authAPI, API_BASE_URL } from '../../services/api';
import { brand } from '../../contexts/ThemeContext';
import { storage } from '../../utils/storage';
import { confirmAction } from '../../utils/customModal';
import { useCopackerEnabled } from '../../hooks/useCopackerEnabled';
import {
  APP_VERSION,
  ROLE_LABELS,
  DOCUMENT_LINKS,
  getNavLinksForRoles,
} from '../../config/navConfig';

export const FIXED_SIDEBAR_WIDTH = 260;

const WHITE = '#FFFFFF';
const WHITE_70 = 'rgba(255,255,255,0.78)';
const WHITE_50 = 'rgba(255,255,255,0.55)';
const DIVIDER = 'rgba(255,255,255,0.22)';

const SectionLabel = ({ children }) => (
  <Text style={{
    color: WHITE_50, fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', paddingHorizontal: 22, marginTop: 18, marginBottom: 6,
  }} numberOfLines={1}>
    {children}
  </Text>
);

const NavItem = ({ label, icon, active, badge, onPress, small, indent, parentOpen, chevron, tint }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      minHeight: small ? 40 : 46, marginHorizontal: 12, marginBottom: 4,
      paddingHorizontal: 12, paddingLeft: indent ? 40 : 12, borderRadius: 10,
      backgroundColor: active ? brand.active : tint ? 'rgba(255,255,255,0.12)' : 'transparent',
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    }}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
    accessibilityLabel={label}
  >
    <MaterialIcons name={icon} size={small ? 18 : 20} color={WHITE} />
    <Text style={{
      flex: 1, color: WHITE, fontSize: small ? 13.5 : chevron ? 14 : 15,
      fontWeight: active ? '700' : '500',
    }} numberOfLines={1}>
      {label}
    </Text>
    {badge ? (
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8,
        paddingHorizontal: 6, paddingVertical: 2,
      }}>
        <Text style={{ color: WHITE, fontSize: 10, fontWeight: '700' }}>{badge}</Text>
      </View>
    ) : null}
    {chevron ? (
      <MaterialIcons name={parentOpen ? 'expand-less' : 'expand-more'} size={20} color={WHITE_70} />
    ) : null}
  </TouchableOpacity>
);

const FixedSidebar = ({ userData, appNav, onOpenAccountDetails }) => {
  const router = useRouter();
  const pathname = usePathname();
  const copackerEnabled = useCopackerEnabled();

  const roles = userData?.roles || [];
  const fullName = userData?.fullName || userData?.username || '';
  const initials = (fullName || '?')
    .split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const roleText = roles.map((r) => ROLE_LABELS[r] || r).join(', ');

  const links = getNavLinksForRoles(roles).filter(
    (l) => !(l.key === 'copacker' && copackerEnabled === false),
  );

  const isCurrent = (route) =>
    pathname === route || (route !== '/' && pathname?.startsWith(route + '/'));
  // The current app's own pages (appNav) open as a sub-dropdown under its
  // link in the ONE Ops Hub list — same sidebar on every page (25 Nov 2026).
  const hasAppNav = !!(appNav && appNav.items && appNav.items.length > 0);
  const [appOpen, setAppOpen] = useState(true);

  const go = (route) => {
    if (pathname !== route) router.push(route);
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
          router.replace('/LoginScreen');
        }
      },
    });
  };

  return (
    <View
      style={{
        width: FIXED_SIDEBAR_WIDTH,
        backgroundColor: brand.navy,
        ...(Platform.OS === 'web' ? { backgroundImage: brand.sidebarGradient } : {}),
      }}
      accessibilityRole="navigation"
    >
      {/* 1. Brand */}
      <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: DIVIDER }}>
        <Image
          source={require('../../assets/images/bisleri-logo-white.png')}
          style={{ width: 168, height: 58 }}
          resizeMode="contain"
          accessibilityLabel="Bisleri"
        />
        <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700', letterSpacing: 1.8, marginTop: 2, marginLeft: 4 }}>
          OPS HUB
        </Text>
      </View>

      {/* 2. Profile */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DIVIDER,
      }}>
        <View style={{
          width: 42, height: 42, borderRadius: 21, backgroundColor: WHITE,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: brand.navy, fontWeight: '700', fontSize: 15 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: WHITE, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {fullName || 'Loading…'}
          </Text>
          {roleText ? (
            <Text style={{ color: WHITE_70, fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>
              {roleText}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 3 + 4. Menus */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
        <SectionLabel>Ops Hub</SectionLabel>
        {links.map((link) => {
          const current = isCurrent(link.route);
          if (hasAppNav && current) {
            return (
              <View key={link.key}>
                <NavItem
                  label={link.label}
                  icon={link.icon}
                  tint
                  chevron
                  parentOpen={appOpen}
                  onPress={() => setAppOpen((o) => !o)}
                />
                {appOpen && appNav.items.map((item) => (
                  <NavItem
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    active={item.active}
                    badge={item.badge}
                    onPress={item.onPress}
                    indent
                    small
                  />
                ))}
              </View>
            );
          }
          return (
            <NavItem
              key={link.key}
              label={link.label}
              icon={link.icon}
              active={current}
              onPress={() => go(link.route)}
            />
          );
        })}

        <SectionLabel>Documents</SectionLabel>
        {DOCUMENT_LINKS.map((link) => (
          <NavItem
            key={link.key}
            label={link.label}
            icon={link.icon}
            active={isCurrent(link.route)}
            onPress={() => go(link.route)}
            small
          />
        ))}
      </ScrollView>

      {/* 5. Account + logout */}
      <View style={{ borderTopWidth: 1, borderTopColor: DIVIDER, paddingTop: 8, paddingBottom: 14 }}>
        <NavItem
          label="Account Details"
          icon="account-circle"
          onPress={() => onOpenAccountDetails?.()}
          small
        />
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginHorizontal: 16, marginTop: 6, minHeight: 44, borderRadius: 10,
            backgroundColor: '#C62828', borderWidth: 1, borderColor: '#E0574F',
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
          }}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <MaterialIcons name="logout" size={18} color={WHITE} />
          <Text style={{ color: WHITE, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
        <Text style={{ marginTop: 10, fontSize: 10, color: WHITE_50, textAlign: 'center' }} numberOfLines={1}>
          {APP_VERSION} · {String(API_BASE_URL || '').replace(/^https?:\/\//, '')}
        </Text>
      </View>
    </View>
  );
};

export default FixedSidebar;
