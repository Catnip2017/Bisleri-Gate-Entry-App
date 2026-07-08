// app/gate-pass/printPass.js - Printable gate pass (web only).
// Navision parity: one layout printed thrice — Vendor / Security / Initiating
// Department copies, each with three signature blocks. On mobile we show an
// info alert (printing happens from the desktop browser).
import { Platform } from 'react-native';
import { gatePassAPI, handleAPIError } from '../../services/api';
import { showAlert, showError } from '../../utils/customModal';

const esc = (v) =>
  String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDT = (v) => (v ? new Date(v).toLocaleString() : '—');

export const printGatePass = async (passId) => {
  if (Platform.OS !== 'web') {
    showAlert('Print', 'Printing is available from the desktop browser.');
    return;
  }
  try {
    const d = await gatePassAPI.getPass(passId);
    const typeLabel = d.pass_type === 'R' ? 'RETURNABLE' : 'NON-RETURNABLE';

    const linesRows = (d.lines || [])
      .map(
        (l) => `<tr>
          <td>${l.line_no}</td>
          <td>${esc(l.item_code)}</td>
          <td>${esc(l.description)}</td>
          <td>${esc(l.serial_no)}</td>
          <td style="text-align:right">${l.quantity}</td>
          <td>${esc(l.uom)}</td>
          <td style="text-align:right">${d.pass_type === 'R' ? l.received_qty : '—'}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><title>${esc(d.gate_pass_no)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #222; margin: 24px; font-size: 13px; }
  .head { text-align: center; border-bottom: 2px solid #00843D; padding-bottom: 8px; margin-bottom: 12px; }
  .head h1 { margin: 0; font-size: 20px; color: #00843D; }
  .head h2 { margin: 4px 0 0; font-size: 15px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .meta td { padding: 4px 8px; vertical-align: top; }
  .meta .lbl { color: #666; width: 140px; font-weight: bold; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.items th { background: #1E88F7; color: #fff; padding: 6px 8px; text-align: left; font-size: 12px; }
  table.items td { border: 1px solid #ccc; padding: 6px 8px; }
  .remarks { border: 1px solid #ccc; padding: 8px; min-height: 40px; margin-bottom: 24px; }
  .sigs { display: flex; justify-content: space-between; margin-top: 48px; }
  .sig { width: 30%; text-align: center; }
  .sig .line { border-top: 1px solid #333; margin-bottom: 4px; }
  .copies { margin-top: 24px; text-align: center; color: #666; font-size: 11px; }
  .status { display: inline-block; border: 1px solid #333; padding: 2px 10px; border-radius: 10px; font-weight: bold; }
  @media print { .noprint { display: none; } }
</style></head><body>
  <div class="head">
    <h1>Bisleri International Pvt Ltd</h1>
    <h2>${typeLabel} GATE PASS &nbsp; <span class="status">${esc(d.status)}</span></h2>
  </div>
  <table class="meta">
    <tr>
      <td class="lbl">Gate Pass No.</td><td><b>${esc(d.gate_pass_no)}</b></td>
      <td class="lbl">Document Date</td><td>${esc(d.document_date)} ${esc(d.document_time)}</td>
    </tr>
    <tr>
      <td class="lbl">Location</td><td>${esc(d.location_code)}</td>
      <td class="lbl">Department</td><td>${esc(d.department)}</td>
    </tr>
    <tr>
      <td class="lbl">Party</td><td>${esc(d.party_code)} — ${esc(d.party_name)}</td>
      <td class="lbl">Mode of Transport</td><td>${esc(d.mode_of_transport)}</td>
    </tr>
    <tr>
      <td class="lbl">Vehicle No.</td><td>${esc(d.vehicle_no)}</td>
      <td class="lbl">Expected Inward</td><td>${d.pass_type === 'R' ? esc(d.expected_inward_date) : 'N/A'}</td>
    </tr>
    <tr>
      <td class="lbl">Sender</td><td>${esc(d.sender_name)}</td>
      <td class="lbl">Approver</td><td>${esc(d.approver_name)}</td>
    </tr>
    <tr>
      <td class="lbl">Created By</td><td>${esc(d.created_by)} (${fmtDT(d.created_at)})</td>
      <td class="lbl">Dispatched</td><td>${d.dispatched_at ? `${esc(d.dispatched_by)} (${fmtDT(d.dispatched_at)})` : '—'}</td>
    </tr>
  </table>
  <table class="items">
    <tr><th>#</th><th>Item Code</th><th>Description of Goods</th><th>Serial No.</th><th>Qty</th><th>Unit</th><th>Received</th></tr>
    ${linesRows}
  </table>
  <div><b>Remarks:</b></div>
  <div class="remarks">${esc(d.remarks || '')}</div>
  <div class="sigs">
    <div class="sig"><div class="line"></div>Admin / IT Head</div>
    <div class="sig"><div class="line"></div>Security</div>
    <div class="sig"><div class="line"></div>Vendor / Party</div>
  </div>
  <div class="copies">Print 3 copies — Vendor · Security · Initiating Department</div>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      showError('Popup blocked — allow popups for this site to print.');
      return;
    }
    w.document.write(html);
    w.document.close();
  } catch (error) {
    showError(handleAPIError(error));
  }
};

export default printGatePass;
