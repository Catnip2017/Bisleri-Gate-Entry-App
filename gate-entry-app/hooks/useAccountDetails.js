// hooks/useAccountDetails.js - Shared "who am I" data (30 Oct 2026).
// Both places that show account details — NavSidebar's "Account Details"
// row and the top-right AccountDetailsPopover it opens — call this one
// hook instead of each fetching/deriving their own copy, so the two
// surfaces can't drift apart ("exactly the same" fields, per the 30 Oct
// 2026 decision).
import { useState, useEffect } from 'react';
import { gatePassAPI } from '../services/api';
import { getUserDetails } from '../config/navConfig';

// `active` gates the network fetch (only fetch while whatever is showing
// this data is actually visible) — same gating NavSidebar used to do
// inline before this was extracted.
export function useAccountDetails(userData, active) {
  const roles = userData?.roles || [];
  const hasGpRole = roles.includes('securityguard') || roles.includes('gatepasscreator');
  const [gpLocationList, setGpLocationList] = useState(null);

  useEffect(() => {
    if (!active || !hasGpRole) return;
    let cancelled = false;
    gatePassAPI.getMyLocations()
      .then((d) => { if (!cancelled) setGpLocationList(d.locations || []); })
      .catch(() => { if (!cancelled) setGpLocationList(null); });
    return () => { cancelled = true; };
  }, [active, hasGpRole]);

  let details = getUserDetails(userData);
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
  // Username was a manual extra row bolted onto the end in the old
  // NavSidebar-only version — folded into `details` here so every caller
  // gets it for free instead of re-adding it themselves.
  details = [...details, ['Username', userData?.username || '—']];

  const initials = (userData?.fullName || userData?.username || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return { roles, details, initials };
}
