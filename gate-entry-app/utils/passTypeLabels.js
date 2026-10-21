// utils/passTypeLabels.js - Display-only labels for the gate pass type code.
// The underlying stored/API value stays 'R' / 'NR' everywhere (DB column,
// gate pass number prefix like R-MUM-2026-27-000004, filters, business
// logic comparisons such as `pass_type === 'R'`) — this only changes what
// the user SEES in Type columns and badges, per the 21 Oct 2026 request to
// stop showing the bare shorthand there.
export const PASS_TYPE_LABELS = {
  R: 'RGP',
  NR: 'NRGP',
};

export const passTypeLabel = (code) => PASS_TYPE_LABELS[code] || code;

export default PASS_TYPE_LABELS;
