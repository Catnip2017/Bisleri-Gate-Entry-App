// utils/printGatePass.js - Printable gate pass (web only).
// Lives in utils/ (NOT app/) — files under app/ are treated as routes by
// Expo Router, and a route's default export must be a React component.
//
// Layout: NAV-parity gate pass slip — logo + letterhead, Party/Gate-Pass
// meta in two columns, item table, sign-off blocks — with TWO copies
// (Vendor Copy, Security Copy) stacked on one printed page, separated by a
// dashed divider. Approved against a mock preview built from a real NAV
// printout; only fields this app actually captures are shown (no Route
// Code/Name, GST Reg. No., Security Deposit, or Party Address — those
// aren't in the data model). On mobile we show an info alert (printing
// happens from the desktop browser).
//
// Print is allowed from Released onward — an Open pass has not been confirmed
// and a Cancelled pass must never circulate on paper. The status is stamped on
// the printout, so a pass printed after dispatch clearly reads "Dispatched".
import { Platform } from 'react-native';
import { gatePassAPI, handleAPIError } from '../services/api';
import { showAlert, showError } from './customModal';

const PRINTABLE_STATUSES = [
  'Released',
  'Dispatched',
  'Partially Received',
  'Inward Received',
  'Closed Without Return',
];

const esc = (v) =>
  String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—');

// Bisleri logo (assets/images/bisleri-logo.png), inlined as a data URI so
// the printout renders identically regardless of how/where the web build
// is hosted — no reliance on a resolvable static asset path in the popup
// window (which is a blank document.write target, not the app's origin).
const LOGO_DATA_URI =
  'data:image/jpeg;base64,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';

// Sub-blocks of the item description that don't have their own column in
// the printed layout (kept as small muted text under the description
// instead of adding columns the approved mockup doesn't have).
const lineExtra = (l) => {
  const bits = [];
  if (l.serial_no) bits.push(`SN ${esc(l.serial_no)}`);
  if (l.chargeable) bits.push(esc(l.chargeable));
  return bits.length ? `<div class="lineExtra">${bits.join(' · ')}</div>` : '';
};

export const printGatePass = async (passId) => {
  if (Platform.OS !== 'web') {
    showAlert('Print', 'Printing is available from the desktop browser.');
    return;
  }
  try {
    const d = await gatePassAPI.getPass(passId);

    // Defense-in-depth: the buttons already respect this, but never print a
    // pass that hasn't been released or that was cancelled.
    if (!PRINTABLE_STATUSES.includes(d.status)) {
      showAlert('Print', `A ${d.status} pass cannot be printed. Release it first.`);
      return;
    }

    const isReturnable = d.pass_type === 'R';
    const typeLabel = isReturnable ? 'RETURNABLE GATE-PASS' : 'NON-RETURNABLE GATE-PASS';

    const linesRows = (d.lines || [])
      .map(
        (l) => `<tr>
          <td class="center">${l.line_no}</td>
          <td>${esc(l.asset_code)}</td>
          <td>${esc(l.description)}${lineExtra(l)}</td>
          <td class="center">${l.quantity ?? 0}</td>
          <td class="center">${esc(l.uom)}</td>
          <td class="center">${isReturnable ? (l.received_qty ?? 0) : '—'}</td>
        </tr>`
      )
      .join('');

    // NAV-parity meta rows — only rows this app actually captures, and
    // Vehicle No. / Expected Inward Date hide entirely when not applicable
    // (Hand Delivery has no vehicle; NR passes never return).
    const vehicleRow = d.vehicle_no
      ? `<tr>
          <td class="lbl">&nbsp;</td><td></td><td></td>
          <td class="lbl right">Vehicle No.</td><td class="colon">:</td><td class="val">${esc(d.vehicle_no)}</td>
        </tr>`
      : '';
    const expectedInwardRow = isReturnable
      ? `<tr>
          <td class="lbl">&nbsp;</td><td></td><td></td>
          <td class="lbl right">Expected Inward Date</td><td class="colon">:</td><td class="val">${esc(d.expected_inward_date)}</td>
        </tr>`
      : '';

    const copyBlock = (copyLabel) => `
      <div class="copy">
        <div class="letterhead">
          <img class="logo" src="${LOGO_DATA_URI}" />
          <div class="titles">
            <div class="doctitle">${esc(typeLabel)}</div>
            <div class="company">Bisleri International Pvt. Ltd.</div>
          </div>
          <div class="copylabel">${esc(copyLabel)}</div>
        </div>

        <table class="meta">
          <tr>
            <td class="lbl">Party Code</td><td class="colon">:</td><td class="val">${esc(d.party_code)}</td>
            <td class="lbl right">Gate Pass No.</td><td class="colon">:</td><td class="val bold">${esc(d.gate_pass_no)}</td>
          </tr>
          <tr>
            <td class="lbl">Party Name</td><td class="colon">:</td><td class="val">${esc(d.party_name)}</td>
            <td class="lbl right">Date</td><td class="colon">:</td><td class="val">${esc(d.document_date)} ${esc(d.document_time)}</td>
          </tr>
          <tr>
            <td class="lbl">&nbsp;</td><td></td><td></td>
            <td class="lbl right">Department</td><td class="colon">:</td><td class="val">${esc(d.department)}</td>
          </tr>
          <tr>
            <td class="lbl">&nbsp;</td><td></td><td></td>
            <td class="lbl right">Mode of Transport</td><td class="colon">:</td><td class="val">${esc(d.mode_of_transport)}</td>
          </tr>
          ${vehicleRow}
          ${expectedInwardRow}
        </table>

        <table class="items">
          <tr>
            <th style="width:6%">Sl.<br/>No.</th>
            <th style="width:14%">Item Code</th>
            <th style="width:40%">Description of Goods</th>
            <th style="width:10%">Quantity</th>
            <th style="width:10%">UOM</th>
            <th style="width:20%">Received Qty</th>
          </tr>
          ${linesRows}
        </table>

        <table class="meta bottom">
          <tr>
            <td class="lbl">Sender Name</td><td class="colon">:</td><td class="val">${esc(d.sender_name)}</td>
            <td class="lbl right">Created By</td><td class="colon">:</td><td class="val">${esc(d.created_by)}</td>
          </tr>
          <tr>
            <td class="lbl">Approved By</td><td class="colon">:</td><td class="val">${esc(d.approver_name)}</td>
            <td class="lbl right">Dispatched</td><td class="colon">:</td><td class="val">${d.dispatched_at ? `${esc(d.dispatched_by)} (${fmtDT(d.dispatched_at)})` : '—'}</td>
          </tr>
        </table>

        <div class="remarks"><span class="lbl">Remarks:</span> ${esc(d.remarks || '—')}</div>

        <div class="sigs">
          <div class="sig"><div class="line"></div>Prepared By</div>
          <div class="sig"><div class="line"></div>Security</div>
          <div class="sig"><div class="line"></div>Approved By</div>
        </div>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(d.gate_pass_no)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 14px 18px; font-size: 12px; background:#fff; }
  .copy { padding-bottom: 10px; }
  .divider { border-top: 2px dashed #888; margin: 14px 0 16px; }

  .letterhead { display:flex; align-items:flex-start; border-bottom:2px solid #00843D; padding-bottom:6px; margin-bottom:10px; }
  .logo { width:80px; height:auto; margin-right:12px; }
  .titles { flex:1; }
  .doctitle { font-size:14px; font-weight:bold; text-decoration:underline; }
  .company { font-size:16px; font-weight:bold; color:#00843D; margin-top:2px; }
  .copylabel { font-size:12px; font-weight:bold; text-align:right; white-space:nowrap; }

  table.meta { width:100%; border-collapse:collapse; margin-bottom:8px; }
  table.meta td { padding:2px 4px; vertical-align:top; font-size:11.5px; }
  table.meta .lbl { color:#333; white-space:nowrap; width:16%; }
  table.meta .lbl.right { width:18%; }
  table.meta .colon { width:1%; }
  table.meta .val.bold { font-weight:bold; }
  table.meta.bottom { margin-top:4px; }

  table.items { width:100%; border-collapse:collapse; margin: 8px 0; }
  table.items th { background:#1E88F7; color:#fff; padding:5px 6px; font-size:10.5px; border:1px solid #1E88F7; }
  table.items td { border:1px solid #ccc; padding:5px 6px; font-size:11px; }
  table.items td.center { text-align:center; }
  .lineExtra { font-size:10px; color:#666; }

  .remarks { font-size:11px; margin: 6px 0 14px; }
  .remarks .lbl { font-weight:bold; margin-right:4px; }

  .sigs { display:flex; justify-content:space-between; margin-top:26px; }
  .sig { width:30%; text-align:center; font-size:11px; }
  .sig .line { border-top:1px solid #333; margin-bottom:4px; height:22px; }
</style></head><body>
${copyBlock('VENDOR COPY')}
<div class="divider"></div>
${copyBlock('SECURITY COPY')}
</body></html>`;

    // A hidden off-screen iframe, not window.open(): the print dialog opens
    // over the CURRENT tab instead of spawning a new one, and there's no
    // popup blocker to fight since nothing is actually "opened".
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    };

    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(html);
    idoc.close();

    // Same belt-and-braces as before: whichever of 'already complete' /
    // 'load event' fires first wins; the flag stops a double dialog.
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // ignore — nothing more we can do if the print call itself fails
      }
      // Browsers don't expose a reliable cross-browser 'print dialog
      // closed' event, so remove the iframe shortly after triggering
      // print rather than trying to time it exactly.
      setTimeout(cleanup, 1000);
    };
    if (idoc.readyState === 'complete') {
      doPrint();
    } else {
      iframe.contentWindow.addEventListener('load', doPrint);
      setTimeout(doPrint, 500);
    }
  } catch (error) {
    showError(handleAPIError(error));
  }
};

export default printGatePass;
