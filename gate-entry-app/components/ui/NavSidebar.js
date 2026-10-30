// components/ui/NavSidebar.js - The ONE sidebar, for all pages and all roles.
// Opens from the LEFT, triggered by the header's hamburger icon (or the
// avatar chip, which opens AccountDetailsPopover instead — 30 Oct 2026).
//
// Structure (identical for every role — only the config decides content):
//   1. Avatar + full name + role chips
//   2. Navigation: flat Admin Hub shortcut → Applications accordion → flat
//      User Management link → Documents accordion (role-aware via
//      config/navConfig.js; Documents is shown to everyone)
//   3. "Account Details" row — opens the same small popup as the avatar
//      chip (components/ui/AccountDetailsPopover.js); the detail rows
//      (WH/site, Gate Pass Location(s), department, …) no longer render
//      inline here too, to avoid showing them in two places in one panel
//   4. Pinned red Logout with confirmation — the single logout in the app
//   5. Footer: app version + connected server
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { authAPI, API_BASE_URL } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { storage } from '../../utils/storage';
import { confirmAction } from '../../utils/customModal';
import { useAccountDetails } from '../../hooks/useAccountDetails';
import {
  APP_VERSION,
  ROLE_LABELS,
  DOCUMENT_LINKS,
  getNavLinksForRoles,
} from '../../config/navConfig';

// Row height used by both the real rows and the accordion's animated
// height target below — keep these in sync if row padding ever changes.
const ACCORDION_ROW_HEIGHT = 48;

// One accordion section: header row (icon + label + chevron that rotates
// open) above an Animated.View that grows/shrinks to exactly fit its rows,
// clipped by overflow:'hidden' so it never pops or jumps.
const AccordionSection = ({ label, icon, isOpen, onToggle, rows, colors }) => {
  const anim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const targetHeight = rows.length * ACCORDION_ROW_HEIGHT;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false, // animating height — can't use the native driver
    }).start();
  }, [isOpen]);

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, targetHeight] });
  const chevRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View>
      <TouchableOpacity
        onPress={onToggle}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          minHeight: 48, paddingHorizontal: 16,
          backgroundColor: isOpen ? colors.surfaceMuted : 'transparent',
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={label}
      >
        <MaterialIcons name={icon} size={20} color={isOpen ? colors.accent : colors.textSecondary} />
        <Text style={{
          flex: 1, fontSize: 14, fontWeight: isOpen ? 'bold' : '600',
          color: isOpen ? colors.accent : colors.textPrimary,
        }}>
          {label}
        </Text>
        <Animated.View style={{ transform: [{ rotate: chevRotate }] }}>
          <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={{ height, overflow: 'hidden' }}>
        {rows}
      </Animated.View>
    </View>
  );
};

const NavSidebar = ({ isVisible, onClose, onOpenAccountDetails, userData }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  // Identity + detail rows (Gate Pass Location enrichment, Username, …) —
  // shared with AccountDetailsPopover so both surfaces show the exact same
  // fields (30 Oct 2026). Hook internally gates its own network fetch on
  // `isVisible`.
  const { roles, details, initials } = useAccountDetails(userData, isVisible);

  // Applications / Documents accordion (30 Oct 2026) — one section open at
  // a time, collapsed again every time the panel is reopened so it never
  // comes back mid-animation or in a stale state.
  const [openSection, setOpenSection] = useState(null); // 'apps' | 'documents' | null
  useEffect(() => {
    if (isVisible) setOpenSection(null);
  }, [isVisible]);

  if (!isVisible) return null;

  const links = getNavLinksForRoles(roles);
  // Admin Hub (no group) stays a flat shortcut at the top, same as before.
  // Everything else clusters under its group.
  const homeLinks = links.filter((l) => !l.group);
  const appLinks = links.filter((l) => l.group === 'app');
  const managementLinks = links.filter((l) => l.group === 'management');

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

  // Shared row renderer — used for the flat Admin Hub / User Management
  // links and, indented, for rows inside the Applications / Documents
  // accordions. Keep minHeight in sync with ACCORDION_ROW_HEIGHT above.
  const renderLink = (link, indented = false) => {
    const active = isCurrent(link.route);
    return (
      <TouchableOpacity
        key={link.key}
        onPress={() => handleNavigate(link.route)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          minHeight: ACCORDION_ROW_HEIGHT, paddingHorizontal: 16,
          paddingLeft: indented ? 44 : 16,
          backgroundColor: active ? colors.surfaceMuted : 'transparent',
          borderRightWidth: active ? 3 : 0,
          borderRightColor: '#00A651',
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={link.label}
      >
        <MaterialIcons
          name={link.icon}
          size={indented ? 18 : 20}
          color={active ? colors.textPrimary : colors.textSecondary}
        />
        <Text style={{
          fontSize: indented ? 13 : 14,
          fontWeight: active ? 'bold' : '500',
          // Same color either way — active state is carried by the bold
          // weight + row highlight + right-edge accent above, not by a
          // separate text color, so it stays legible in both themes.
          color: colors.textPrimary,
        }}>
          {link.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      // Opens from the LEFT (30 Oct 2026 — was row-reverse/right-docked).
      // The backdrop is position:absolute regardless, so only the panel's
      // place in flex order and its shadow direction need to flip.
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
        width: 290, height: '100%', backgroundColor: colors.surface,
        elevation: 8,
        shadowColor: '#000', shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.3, shadowRadius: 8,
      }}>
        {/* 1. Identity */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.textPrimary }}>
              {initials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.textPrimary }} numberOfLines={1}>
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
            <MaterialIcons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 2. Navigation — flat Admin Hub shortcut, then the Applications
            accordion, the flat User Management link, and the Documents
            accordion (30 Oct 2026 hamburger-menu redesign). Documents is
            shown to every signed-in user — it isn't role-filtered like the
            rest of NAV_LINKS. */}
        <ScrollView style={{ flex: 1 }}>
          <View style={{ paddingVertical: 8 }}>
            {homeLinks.map((link) => renderLink(link))}

            {appLinks.length > 0 && (
              <AccordionSection
                label="Applications"
                icon="apps"
                colors={colors}
                isOpen={openSection === 'apps'}
                onToggle={() => setOpenSection(openSection === 'apps' ? null : 'apps')}
                rows={appLinks.map((link) => renderLink(link, true))}
              />
            )}

            {managementLinks.map((link) => renderLink(link))}

            <AccordionSection
              label="Documents"
              icon="folder"
              colors={colors}
              isOpen={openSection === 'documents'}
              onToggle={() => setOpenSection(openSection === 'documents' ? null : 'documents')}
              rows={DOCUMENT_LINKS.map((link) => renderLink(link, true))}
            />
          </View>

        </ScrollView>

        {/* 3. Account Details — opens the same small popup as the avatar
            chip (30 Oct 2026), rather than showing the detail rows inline
            here too; keeps the two surfaces ("tab in the hamburger" +
            "pop-up from the top-right icon") as the only two places this
            data lives, per the 30 Oct 2026 decision. Pinned just above
            Logout. */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={() => { onClose(); onOpenAccountDetails?.(); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              minHeight: ACCORDION_ROW_HEIGHT, paddingHorizontal: 16,
            }}
            accessibilityRole="button"
            accessibilityLabel="Account Details"
          >
            <MaterialIcons name="account-circle" size={20} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
              Account Details
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. Pinned logout */}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
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
            marginTop: 10, fontSize: 10, color: colors.textMuted, textAlign: 'center',
          }}>
            {APP_VERSION} · {String(API_BASE_URL || '').replace(/^https?:\/\//, '')}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default NavSidebar;
