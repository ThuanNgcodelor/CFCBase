/**
 * nightRewardReconcile.js
 * Đọc file Excel từ xí nghiệp, đối soát với dữ liệu hệ thống,
 * xuất file Excel hai cột so sánh có highlight màu.
 *
 * Format file XN (HUYEN.xlsx):
 *   Row 1-2: tiêu đề / trống
 *   Row 3  : header (STT | MV | Họ và tên | Công ca đêm | Tích 12 | Tích 24 | ...)
 *   Row 4+ : data
 *
 * Tích 12 = mức thưởng định kỳ (500k/tháng) — dùng để nhận biết chu kỳ, không so sánh số tiền
 * Tích 24 = mức thưởng gắn bó (1tr/tháng)   — tương tự
 * → So sánh thực tế: Công ca đêm, periodicQualifiedMonths (Tích 12), loyaltyQualifiedMonths (Tích 24)
 */
import * as XLSX from 'xlsx';

// ──────────────────────────────────────────────
// 1. Parse file Excel từ xí nghiệp
// ──────────────────────────────────────────────

/**
 * Đọc file .xlsx từ xí nghiệp, trả về array rows.
 * @param {File} file
 * @returns {Promise<Array<{maNV, hoTen, caDem, tich12Rate, tich24Rate}>>}
 */
export async function parseNightRewardXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellFormula: false, cellNF: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        // Tìm header row (có chứa "MV" hoặc "Mã")
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 6); i++) {
          const r = rows[i];
          if (r && r.some((c) => typeof c === 'string' && c.trim().toUpperCase().startsWith('MV'))) {
            headerRowIdx = i;
            break;
          }
        }
        if (headerRowIdx === -1) throw new Error('Không tìm thấy dòng tiêu đề trong file. Kiểm tra file có đúng định dạng không.');

        const headers = rows[headerRowIdx].map((h) => (h ? String(h).trim() : ''));
        // Detect column indices by header name
        const colIdx = (keywords) => {
          for (const kw of keywords) {
            const idx = headers.findIndex((h) => h.toLowerCase().includes(kw.toLowerCase()));
            if (idx !== -1) return idx;
          }
          return -1;
        };
        const idxMV   = colIdx(['MV', 'mã', 'ma nv', 'manv']);
        const idxName = colIdx(['họ và tên', 'ho va ten', 'họ tên', 'tên']);
        const idxCaDem = colIdx(['công ca đêm', 'ca đêm', 'ca dem']);
        const idxT12  = colIdx(['tích 12', 'tich 12', 'tic 12']);
        const idxT24  = colIdx(['tích 24', 'tich 24', 'tic 24']);

        if (idxMV === -1) throw new Error('Không tìm thấy cột "MV" (Mã nhân viên) trong file.');

        const result = [];
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;
          const maNV = row[idxMV] ? String(row[idxMV]).trim().toUpperCase() : null;
          if (!maNV) continue;

          const caDem = idxCaDem !== -1 ? toNumber(row[idxCaDem]) : null;
          const tich12Rate = idxT12 !== -1 ? toNumber(row[idxT12]) : null;
          const tich24Rate = idxT24 !== -1 ? toNumber(row[idxT24]) : null;

          result.push({
            stt: i - headerRowIdx,
            maNV,
            hoTen: idxName !== -1 ? (row[idxName] ? String(row[idxName]).trim() : '') : '',
            caDem,        // Công ca đêm tháng (số ca)
            tich12Rate,   // Mức thưởng chu kỳ 12 (500000 = 500k)
            tich24Rate,   // Mức thưởng chu kỳ 24 (1000000 = 1tr)
          });
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Không đọc được file.'));
    reader.readAsArrayBuffer(file);
  });
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  // Công thức VLOOKUP chưa được tính (không có cached value) → trả về null
  if (typeof val === 'string' && val.trim().startsWith('=')) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ──────────────────────────────────────────────
// 2. Đối soát XN vs Hệ thống
// ──────────────────────────────────────────────

/**
 * Đối soát danh sách từ xí nghiệp với danh sách từ hệ thống.
 * @param {Array} xlsRows     - output của parseNightRewardXlsx
 * @param {Array} sysEmployees - data.employees từ api.month(month)
 * @returns {{ matched: Array, onlyInXN: Array, onlyInSystem: Array, summary }}
 */
export function reconcile(xlsRows, sysEmployees) {
  const sysMap = new Map(sysEmployees.map((e) => [e.employeeCode.toUpperCase(), e]));
  const xlsMap = new Map(xlsRows.map((r) => [r.maNV, r]));

  const matched = [];
  const onlyInXN = [];

  for (const xn of xlsRows) {
    const sys = sysMap.get(xn.maNV);
    if (!sys) {
      onlyInXN.push(xn);
      continue;
    }

    const sysCaDem  = sys.actualNightShiftCount ?? null;
    const sysTich12 = sys.progress?.periodicQualifiedMonths ?? null;
    const sysTich24 = sys.progress?.loyaltyQualifiedMonths ?? null;

    const diffCaDem  = xn.caDem  !== null && sysCaDem  !== null ? xn.caDem  - sysCaDem  : null;

    matched.push({
      // — Phần XN —
      xnMaNV: xn.maNV,
      xnHoTen: xn.hoTen,
      xnCaDem: xn.caDem,
      xnTich12Rate: xn.tich12Rate, // mức tiền (500k)
      xnTich24Rate: xn.tich24Rate, // mức tiền (1tr)
      // — Phần Hệ thống —
      sysMaNV: sys.employeeCode,
      sysHoTen: sys.employeeName,
      sysCaDem,
      sysTich12Months: sysTich12,  // số tháng tích lũy 12-cycle
      sysTich24Months: sysTich24,  // số tháng tích lũy 24-cycle
      sysStatus: sys.finalizedStatus || sys.calculatedStatus,
      // — Chênh lệch —
      diffCaDem,           // > 0: XN nhiều hơn HT, < 0: XN ít hơn HT
      caDemMatch: diffCaDem === 0,
      xnCaDemIsFormula: xn.caDem === null, // file có formula VLOOKUP chưa tính được
      // — Ghi chú —
      note: buildNote(diffCaDem, sys, xn.caDem === null),
    });
  }

  const onlyInSystem = sysEmployees
    .filter((e) => !xlsMap.has(e.employeeCode.toUpperCase()))
    .map((e) => ({
      sysMaNV: e.employeeCode,
      sysHoTen: e.employeeName,
      sysCaDem: e.actualNightShiftCount,
      sysTich12Months: e.progress?.periodicQualifiedMonths ?? null,
      sysTich24Months: e.progress?.loyaltyQualifiedMonths ?? null,
      sysStatus: e.finalizedStatus || e.calculatedStatus,
    }));

  const totalDiff = matched.filter((r) => !r.caDemMatch).length;

  return {
    matched,
    onlyInXN,
    onlyInSystem,
    summary: {
      total: xlsRows.length,
      matched: matched.length,
      diffCount: totalDiff,
      onlyInXN: onlyInXN.length,
      onlyInSystem: onlyInSystem.length,
    },
  };
}

function buildNote(diffCaDem, sys, xnIsFormula = false) {
  if (xnIsFormula) {
    return `Ca đêm HT: ${sys.actualNightShiftCount} ca · File XN dùng VLOOKUP (cần mở file bằng Excel để tính)`;
  }
  const parts = [];
  if (diffCaDem !== null && diffCaDem !== 0) {
    parts.push(diffCaDem > 0
      ? `Ca đêm XN nhiều hơn HT ${diffCaDem} ca`
      : `Ca đêm XN ít hơn HT ${Math.abs(diffCaDem)} ca`);
  }
  if (sys.calculatedStatus === 'NOT_QUALIFIED') parts.push('Chưa đủ điều kiện');
  if (sys.calculatedStatus === 'QUALIFIED' || sys.calculatedStatus === 'QUALIFIED_EXCEPTION') parts.push('Đạt điều kiện tháng này');
  if (!parts.length) return 'Khớp';
  return parts.join(' · ');
}

// ──────────────────────────────────────────────
// 3. Xuất file Excel đối soát
// ──────────────────────────────────────────────

const COLORS = {
  headerXN:      'FF1E3A5F', // Xanh Navy CFC — nhóm XN
  headerSys:     'FF1E3A8A', // Xanh đậm — nhóm Hệ thống
  headerDiff:    'FF334155', // Slate — nhóm đối soát
  subHdrXN:      'FF2D6A4F', // Xanh lá đậm cho sub header XN
  subHdrSys:     'FF2563EB', // Xanh dương cho sub header HT
  subHdrDiff:    'FF475569', // Xám đậm cho sub header đối soát
  rowMatch:      'FFF0FDF4', // Xanh lá rất nhạt — khớp
  rowDiffCaDem:  'FFFFFBEB', // Vàng kem nhạt — lệch ca đêm
  rowOnlyXN:     'FFFFF7ED', // Cam nhạt — chỉ có XN
  rowOnlySys:    'FFEFF6FF', // Xanh dương nhạt — chỉ có HT
  textWhite:     'FFFFFFFF',
  textDark:      'FF0F172A',
  diffRed:       'FFDC2626', // Chữ đỏ khi lệch
  diffGreen:     'FF16A34A', // Chữ xanh khi khớp
};

function cell(value, { bold = false, bgColor, fontColor, italic = false, wrapText = false } = {}) {
  const c = { v: value ?? '', t: typeof value === 'number' ? 'n' : 's' };
  const font = {};
  if (bold) font.bold = true;
  if (italic) font.italic = true;
  if (fontColor) font.color = { rgb: fontColor };
  const fill = bgColor ? { fgColor: { rgb: bgColor }, patternType: 'solid' } : undefined;
  const alignment = wrapText ? { wrapText: true } : undefined;
  c.s = { font, ...(fill ? { fill } : {}), ...(alignment ? { alignment } : {}) };
  return c;
}

function numCell(value, { bold = false, bgColor, fontColor } = {}) {
  if (value === null || value === undefined || value === '') return cell('—', { bgColor, fontColor: fontColor || COLORS.textDark });
  return { v: value, t: 'n', s: { font: { bold, ...(fontColor ? { color: { rgb: fontColor } } : {}) }, ...(bgColor ? { fill: { fgColor: { rgb: bgColor }, patternType: 'solid' } } : {}) } };
}

/**
 * Xuất file Excel đối soát.
 * @param {{ matched, onlyInXN, onlyInSystem }} reconcileResult
 * @param {string} month  - vd "2026-08"
 */
export function exportReconcileXlsx(reconcileResult, month) {
  const { matched, onlyInXN, onlyInSystem } = reconcileResult;
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Đối soát chính ──
  const ws = buildMainSheet(matched, month);
  XLSX.utils.book_append_sheet(wb, ws, 'Đối soát ca đêm');

  // ── Sheet 2: Chỉ có trong XN (cần kiểm tra) ──
  if (onlyInXN.length > 0) {
    const ws2 = buildOnlyXNSheet(onlyInXN, month);
    XLSX.utils.book_append_sheet(wb, ws2, 'Chỉ có trong file XN');
  }

  // ── Sheet 3: Chỉ có trong hệ thống ──
  if (onlyInSystem.length > 0) {
    const ws3 = buildOnlySystemSheet(onlyInSystem, month);
    XLSX.utils.book_append_sheet(wb, ws3, 'Chỉ có trong hệ thống');
  }

  const fileName = `DoiSoat_CaDem_${month}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}

function buildMainSheet(matched, month) {
  const ws = {};

  // Tiêu đề lớn
  const title = `ĐỐI SOÁT CA ĐÊM THÁNG ${month} — XÍ NGHIỆP VS HỆ THỐNG`;
  ws['A1'] = cell(title, { bold: true, bgColor: COLORS.headerXN, fontColor: COLORS.textWhite });
  ws['A2'] = cell(`Xuất lúc: ${new Date().toLocaleString('vi-VN')}`, { italic: true, fontColor: '888888' });

  // Header row — nhóm XN (cột A-F)
  const ROW_H1 = 3;
  const ROW_H2 = 4;
  const ROW_DATA_START = 5;

  // Nhóm XN: A-F
  ws[`A${ROW_H1}`] = cell('STT', { bold: true, bgColor: COLORS.headerXN, fontColor: COLORS.textWhite });
  ws[`B${ROW_H1}`] = cell('XÍ NGHIỆP', { bold: true, bgColor: COLORS.headerXN, fontColor: COLORS.textWhite });
  ws[`C${ROW_H1}`] = cell('', { bgColor: COLORS.headerXN });
  ws[`D${ROW_H1}`] = cell('', { bgColor: COLORS.headerXN });
  ws[`E${ROW_H1}`] = cell('', { bgColor: COLORS.headerXN });
  ws[`F${ROW_H1}`] = cell('', { bgColor: COLORS.headerXN });
  // Separator G
  ws[`G${ROW_H1}`] = cell('', {});
  // Nhóm HT: H-L
  ws[`H${ROW_H1}`] = cell('HỆ THỐNG', { bold: true, bgColor: COLORS.headerSys, fontColor: COLORS.textWhite });
  ws[`I${ROW_H1}`] = cell('', { bgColor: COLORS.headerSys });
  ws[`J${ROW_H1}`] = cell('', { bgColor: COLORS.headerSys });
  ws[`K${ROW_H1}`] = cell('', { bgColor: COLORS.headerSys });
  ws[`L${ROW_H1}`] = cell('', { bgColor: COLORS.headerSys });
  // Nhóm diff: M-O
  ws[`M${ROW_H1}`] = cell('ĐỐI SOÁT & CHÊNH LỆCH', { bold: true, bgColor: COLORS.headerDiff, fontColor: COLORS.textWhite });
  ws[`N${ROW_H1}`] = cell('', { bgColor: COLORS.headerDiff });
  ws[`O${ROW_H1}`] = cell('GHI CHÚ', { bold: true, bgColor: COLORS.headerDiff, fontColor: COLORS.textWhite });

  // Sub-headers row
  const subHdr = (txt, bg, fw) => cell(txt, { bold: true, bgColor: bg, fontColor: fw });
  ws[`A${ROW_H2}`] = subHdr('STT', COLORS.subHdrXN, COLORS.textWhite);
  ws[`B${ROW_H2}`] = subHdr('Mã NV', COLORS.subHdrXN, COLORS.textWhite);
  ws[`C${ROW_H2}`] = subHdr('Họ và tên', COLORS.subHdrXN, COLORS.textWhite);
  ws[`D${ROW_H2}`] = subHdr('Ca đêm', COLORS.subHdrXN, COLORS.textWhite);
  ws[`E${ROW_H2}`] = subHdr('Tích 12 (mức)', COLORS.subHdrXN, COLORS.textWhite);
  ws[`F${ROW_H2}`] = subHdr('Tích 24 (mức)', COLORS.subHdrXN, COLORS.textWhite);
  ws[`G${ROW_H2}`] = cell('', {});
  ws[`H${ROW_H2}`] = subHdr('Mã NV', COLORS.subHdrSys, COLORS.textWhite);
  ws[`I${ROW_H2}`] = subHdr('Họ và tên', COLORS.subHdrSys, COLORS.textWhite);
  ws[`J${ROW_H2}`] = subHdr('Ca đêm', COLORS.subHdrSys, COLORS.textWhite);
  ws[`K${ROW_H2}`] = subHdr('Tích 12 (tháng)', COLORS.subHdrSys, COLORS.textWhite);
  ws[`L${ROW_H2}`] = subHdr('Tích 24 (tháng)', COLORS.subHdrSys, COLORS.textWhite);
  ws[`M${ROW_H2}`] = subHdr('Lệch ca đêm', COLORS.subHdrDiff, COLORS.textWhite);
  ws[`N${ROW_H2}`] = subHdr('Trạng thái HT', COLORS.subHdrDiff, COLORS.textWhite);
  ws[`O${ROW_H2}`] = subHdr('Ghi chú', COLORS.subHdrDiff, COLORS.textWhite);

  // Data rows
  let rowIdx = ROW_DATA_START;
  matched.forEach((r, i) => {
    const bg = r.caDemMatch ? COLORS.rowMatch : COLORS.rowDiffCaDem;
    const diffColor = r.caDemMatch ? COLORS.diffGreen : COLORS.diffRed;
    const diffVal = r.diffCaDem !== null ? (r.diffCaDem === 0 ? 'Khớp' : (r.diffCaDem > 0 ? `+${r.diffCaDem}` : `${r.diffCaDem}`)) : '—';

    ws[`A${rowIdx}`] = numCell(i + 1, { bgColor: bg });
    ws[`B${rowIdx}`] = cell(r.xnMaNV, { bgColor: bg });
    ws[`C${rowIdx}`] = cell(r.xnHoTen, { bgColor: bg });
    ws[`D${rowIdx}`] = numCell(r.xnCaDem, { bgColor: bg });
    ws[`E${rowIdx}`] = numCell(r.xnTich12Rate ? r.xnTich12Rate.toLocaleString('vi-VN') : null, { bgColor: bg });
    ws[`F${rowIdx}`] = numCell(r.xnTich24Rate ? r.xnTich24Rate.toLocaleString('vi-VN') : null, { bgColor: bg });
    ws[`G${rowIdx}`] = cell('', {});
    ws[`H${rowIdx}`] = cell(r.sysMaNV, { bgColor: bg });
    ws[`I${rowIdx}`] = cell(r.sysHoTen, { bgColor: bg });
    ws[`J${rowIdx}`] = numCell(r.sysCaDem, { bgColor: bg });
    ws[`K${rowIdx}`] = numCell(r.sysTich12Months, { bgColor: bg });
    ws[`L${rowIdx}`] = numCell(r.sysTich24Months, { bgColor: bg });
    ws[`M${rowIdx}`] = cell(diffVal, { bold: !r.caDemMatch, bgColor: bg, fontColor: diffColor });
    ws[`N${rowIdx}`] = cell(r.sysStatus || '—', { bgColor: bg });
    ws[`O${rowIdx}`] = cell(r.note, { bgColor: bg, wrapText: true });
    rowIdx++;
  });

  // Dòng tổng kết
  rowIdx++;
  ws[`A${rowIdx}`] = cell('TỔNG KẾT', { bold: true, bgColor: COLORS.headerXN, fontColor: COLORS.textWhite });
  ws[`B${rowIdx}`] = cell(`Tổng XN: ${matched.length + 0} người`, { bold: true });
  ws[`D${rowIdx}`] = cell(`Lệch ca đêm: ${matched.filter(r => !r.caDemMatch).length} người`, { bold: true, fontColor: COLORS.diffRed });

  ws['!ref'] = `A1:O${rowIdx}`;
  ws['!cols'] = [
    { wch: 5 },  // A STT
    { wch: 10 }, // B Mã XN
    { wch: 22 }, // C Tên XN
    { wch: 10 }, // D Ca đêm XN
    { wch: 14 }, // E Tích 12 rate
    { wch: 14 }, // F Tích 24 rate
    { wch: 2 },  // G separator
    { wch: 10 }, // H Mã HT
    { wch: 22 }, // I Tên HT
    { wch: 10 }, // J Ca đêm HT
    { wch: 14 }, // K Tích 12 tháng HT
    { wch: 14 }, // L Tích 24 tháng HT
    { wch: 14 }, // M Lệch ca đêm
    { wch: 16 }, // N Kết quả HT
    { wch: 32 }, // O Ghi chú
  ];
  // Merge cells for group headers
  ws['!merges'] = [
    { s: { r: ROW_H1 - 1, c: 1 }, e: { r: ROW_H1 - 1, c: 5 } }, // B-F XN group
    { s: { r: ROW_H1 - 1, c: 7 }, e: { r: ROW_H1 - 1, c: 11 } }, // H-L HT group
    { s: { r: ROW_H1 - 1, c: 12 }, e: { r: ROW_H1 - 1, c: 13 } }, // M-N diff group
  ];
  return ws;
}

function buildOnlyXNSheet(onlyInXN, month) {
  const ws = {};
  ws['A1'] = cell(`DANH SÁCH CHỈ CÓ TRONG FILE XÍ NGHIỆP — Tháng ${month}`, { bold: true, bgColor: COLORS.rowOnlyXN });
  ws['A2'] = cell('Những người này có trong file XN nhưng KHÔNG có trong hệ thống. Cần kiểm tra lại.', { italic: true });
  const headers = ['STT', 'Mã NV', 'Họ và tên', 'Ca đêm', 'Tích 12 (rate)', 'Tích 24 (rate)'];
  headers.forEach((h, i) => {
    ws[`${colName(i)}3`] = cell(h, { bold: true, bgColor: COLORS.headerXN, fontColor: COLORS.textWhite });
  });
  onlyInXN.forEach((r, i) => {
    const row = i + 4;
    ws[`A${row}`] = numCell(i + 1, { bgColor: COLORS.rowOnlyXN });
    ws[`B${row}`] = cell(r.maNV, { bgColor: COLORS.rowOnlyXN });
    ws[`C${row}`] = cell(r.hoTen, { bgColor: COLORS.rowOnlyXN });
    ws[`D${row}`] = numCell(r.caDem, { bgColor: COLORS.rowOnlyXN });
    ws[`E${row}`] = cell(r.tich12Rate ? r.tich12Rate.toLocaleString('vi-VN') : '—', { bgColor: COLORS.rowOnlyXN });
    ws[`F${row}`] = cell(r.tich24Rate ? r.tich24Rate.toLocaleString('vi-VN') : '—', { bgColor: COLORS.rowOnlyXN });
  });
  ws['!ref'] = `A1:F${onlyInXN.length + 3}`;
  ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
  return ws;
}

function buildOnlySystemSheet(onlyInSystem, month) {
  const ws = {};
  ws['A1'] = cell(`DANH SÁCH CHỈ CÓ TRONG HỆ THỐNG — Tháng ${month}`, { bold: true, bgColor: COLORS.rowOnlySys });
  ws['A2'] = cell('Những người này có trong hệ thống nhưng KHÔNG có trong file xí nghiệp. Có thể chưa gửi đủ.', { italic: true });
  const headers = ['STT', 'Mã NV (HT)', 'Họ và tên (HT)', 'Ca đêm (HT)', 'Tích 12 tháng', 'Tích 24 tháng', 'Trạng thái HT'];
  headers.forEach((h, i) => {
    ws[`${colName(i)}3`] = cell(h, { bold: true, bgColor: COLORS.headerSys, fontColor: COLORS.textWhite });
  });
  onlyInSystem.forEach((r, i) => {
    const row = i + 4;
    ws[`A${row}`] = numCell(i + 1, { bgColor: COLORS.rowOnlySys });
    ws[`B${row}`] = cell(r.sysMaNV, { bgColor: COLORS.rowOnlySys });
    ws[`C${row}`] = cell(r.sysHoTen, { bgColor: COLORS.rowOnlySys });
    ws[`D${row}`] = numCell(r.sysCaDem, { bgColor: COLORS.rowOnlySys });
    ws[`E${row}`] = numCell(r.sysTich12Months, { bgColor: COLORS.rowOnlySys });
    ws[`F${row}`] = numCell(r.sysTich24Months, { bgColor: COLORS.rowOnlySys });
    ws[`G${row}`] = cell(r.sysStatus || '—', { bgColor: COLORS.rowOnlySys });
  });
  ws['!ref'] = `A1:G${onlyInSystem.length + 3}`;
  ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  return ws;
}

// A=0, B=1 ... Z=25, AA=26 ...
function colName(idx) {
  let name = '';
  idx++;
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    idx = Math.floor((idx - 1) / 26);
  }
  return name;
}
