// config/navConfig.js - SINGLE source of truth for app navigation.
// The sidebar renders these links filtered by the user's roles; adding a
// page, renaming a link, or granting a role access is a one-line change
// here — never a per-screen edit.

export const APP_VERSION = 'v1.0.3';

export const NAV_LINKS = [
  {
    // Admin Hub stays FIRST in the sidebar — it's the IT Admin's home.
    // (Non-admins never see it; the role filter removes it.)
    key: 'admin-hub',
    label: 'Admin Hub',
    icon: 'apps',
    route: '/admin-hub',
    roles: ['itadmin'],
  },
  {
    // The ONE gate dashboard: guards create entries; admins land on
    // Insights with warehouse/site filters and view-only Gate Entry.
    // (Admin Insights was retired July 2026 — merged into this page.)
    key: 'security',
    label: 'Gate Entry & Insights',
    icon: 'local-shipping',
    route: '/security',
    roles: ['securityguard', 'itadmin'],
  },
  {
    key: 'user-management',
    label: 'User Management',
    icon: 'group',
    route: '/admin-hub/user-management',
    roles: ['itadmin'],
  },
  {
    key: 'dashboards',
    label: 'Dashboards',
    icon: 'bar-chart',
    route: '/admin-hub/dashboard',
    roles: ['itadmin'],
  },
  {
    key: 'rpa',
    label: 'RPA Processes',
    icon: 'smart-toy',
    route: '/rpa',
    roles: ['itadmin'],
  },
  {
    // Gate Pass (RGP / Non-RGP) — initiator module. Role model LOCKED
    // 14 Jul 2026: only Gate Pass Creators (incl. ITA+GPC) open this.
    // Plain ITA has NO gate pass access.
    key: 'gate-pass',
    label: 'Gate Pass',
    icon: 'assignment',
    route: '/gate-pass',
    roles: ['gatepasscreator'],
  },
  {
    key: 'copacker',
    label: 'Co-Packer Sessions',
    icon: 'factory',
    route: '/copacker',
    roles: ['copacker'],
  },
];

export const ROLE_LABELS = {
  itadmin: 'IT Admin',

  securityguard: 'Security Guard',
  copacker: 'Co-Packer',
  gatepasscreator: 'Gate Pass Creator',
  gatepassdispatcher: 'Gate Pass Dispatcher',
};

/**
 * Sidebar detail rows — all attributes always visible.
 * Shows '—' if no value assigned.
 */
export const getUserDetails = (user) => {
  if (!user) return [];
  return [
    ['Gate Entry Warehouse Code', user.warehouseCode    || '—'],
    ['Site Code',                 user.siteCode         || '—'],
    ['Gate Pass Location',        user.gatePassLocation || '—'],
    ['Department',                user.department       || '—'],
    ['Co-Packer Location',        user.copackerLocation || '—'],
  ];
};

export const getNavLinksForRoles = (roles = []) =>
  NAV_LINKS.filter((link) => link.roles.some((r) => roles.includes(r)));
