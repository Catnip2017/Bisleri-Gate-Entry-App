// config/navConfig.js - SINGLE source of truth for app navigation.
// The sidebar renders these links filtered by the user's roles; adding a
// page, renaming a link, or granting a role access is a one-line change
// here — never a per-screen edit.

export const APP_VERSION = 'v1.0.3';

export const NAV_LINKS = [
  {
    // The ONE gate dashboard: guards create entries; admins land on
    // Insights with warehouse/site filters and view-only Gate Entry.
    // (Admin Insights was retired July 2026 — merged into this page.)
    key: 'security',
    label: 'Gate Entry & Insights',
    icon: 'local-shipping',
    route: '/security',
    roles: ['securityguard', 'securityadmin', 'itadmin'],
  },
  {
    key: 'admin-hub',
    label: 'Admin Hub',
    icon: 'apps',
    route: '/admin-hub',
    roles: ['itadmin'],
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
    key: 'copacker',
    label: 'Co-Packer Sessions',
    icon: 'factory',
    route: '/copacker',
    roles: ['copacker'],
  },
];

export const ROLE_LABELS = {
  itadmin: 'IT Admin',
  securityadmin: 'Security Admin',
  securityguard: 'Security Guard',
  copacker: 'Co-Packer',
};

/**
 * Role-relevant detail rows for the sidebar, from the decoded user.
 * Guards/admins see warehouse + site; copackers see their location.
 */
export const getUserDetails = (user) => {
  if (!user) return [];
  const roles = user.roles || [];
  const details = [];
  if (roles.includes('copacker')) {
    details.push(['Location', user.copackerLocation || '—']);
  } else {
    details.push(['WH Code', user.warehouseCode || '—']);
    details.push(['Site Code', user.siteCode || '—']);
  }
  return details;
};

export const getNavLinksForRoles = (roles = []) =>
  NAV_LINKS.filter((link) => link.roles.some((r) => roles.includes(r)));
