// hooks/useCopackerEnabled.js
// Mirrors the backend COPACKER_FEATURE_ENABLED flag (via /copacker/feature-status).
//   true  -> Co Packer is enabled
//   false -> disabled: hide the Admin Hub card and the hamburger-menu link
//   null  -> not known yet (first load) — callers decide; Admin Hub hides the
//            card until it is known so a disabled card never flashes up.
// A successful answer is cached for the page session. A failed request (e.g.
// not logged in yet) is NOT cached and falls back to "enabled" so a network
// hiccup never removes the feature.
import { useState, useEffect } from 'react';
import { copackerAPI } from '../services/api';

let cached = null;

export function useCopackerEnabled() {
  const [enabled, setEnabled] = useState(cached);

  useEffect(() => {
    if (cached !== null) return undefined;
    let alive = true;
    copackerAPI.featureStatus()
      .then((s) => {
        cached = s?.enabled !== false;
        if (alive) setEnabled(cached);
      })
      .catch(() => {
        if (alive) setEnabled(true);
      });
    return () => { alive = false; };
  }, []);

  return enabled;
}
