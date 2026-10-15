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
import XLSX from 'xlsx-js-style';

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
    return `HT: ${sys.actualNightShiftCount} ca · File XN dùng VLOOKUP (chưa tính số)`;
  }
  const parts = [];
  if (diffCaDem !== null && diffCaDem !== 0) {
    parts.push(diffCaDem > 0
      ? `XN nhiều hơn HT ${diffCaDem} ca`
      : `XN ít hơn HT ${Math.abs(diffCaDem)} ca`);
  }
  const status = sys.finalizedStatus || sys.calculatedStatus;
  if (status === 'NOT_QUALIFIED') parts.push('Chưa đạt điều kiện');
  if (status === 'QUALIFIED') parts.push('Đạt điều kiện tháng');
  if (status === 'QUALIFIED_EXCEPTION') parts.push('Đạt ngoại lệ');
  if (!parts.length) return 'Khớp số liệu';
  return parts.join(' · ');
}

// ──────────────────────────────────────────────
// 3. Xuất file Excel đối soát có định dạng bảng và màu sắc
// ──────────────────────────────────────────────

export const STATUS_LABELS = {
  QUALIFIED: 'Đạt điều kiện',
  QUALIFIED_EXCEPTION: 'Đạt ngoại lệ',
  NOT_QUALIFIED: 'Chưa đạt',
  EXCLUDED: 'Không áp dụng',
  STALE: 'Cần chốt lại',
  DRAFT: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  CONFIRMED: 'Đã chốt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
  AUTO_MATCHED: 'Tự động khớp',
  NEEDS_REVIEW: 'Cần kiểm tra',
  NO_PUNCH: 'Không chấm công',
  INCIDENT: 'Sự cố máy',
};

const COLORS = {
  // Tiêu đề nhóm lớn (Hàng 3)
  tblHeaderXN:   '1E3A5F', // Xanh Navy CFC đậm — Bảng Xí nghiệp
  tblHeaderSys:  '0F766E', // Xanh Teal đậm — Bảng Hệ thống CFC
  tblHeaderDiff: '334155', // Slate đậm — Nhóm Đối soát & Ghi chú

  // Tiêu đề cột chi tiết (Hàng 4)
  colHeaderXN:   '2563EB', // Xanh Royal
  colHeaderSys:  '0D9488', // Xanh Teal vừa
  colHeaderDiff: '475569', // Xám Slate

  // Màu nền dòng dữ liệu
  rowMatch:      'E8F5E9', // Xanh lá pastel nhạt — Khớp
  rowDiff:       'FFEBEE', // Đỏ hồng pastel nhạt — Lệch ca đêm
  rowWarning:    'FEF3C7', // Vàng kem pastel nhạt — Cảnh báo / Chưa đạt / Ngoại lệ
  rowOnlyXN:     'FFF7ED', // Cam nhạt — Chỉ có trong file XN
  rowOnlySys:    'EFF6FF', // Xanh nhạt — Chỉ có trong HT
  rowTotal:      'F8FAFC', // Xám nền tổng kết

  // Viền ô (Borders)
  borderGrid:    'D1D5DB', // Xám kẻ ô tiêu chuẩn (#D1D5DB)
  borderDark:    '0F172A', // Viền tiêu đề

  // Màu chữ (Text)
  textWhite:     'FFFFFF',
  textDark:      '0F172A',
  textMuted:     '64748B',
  diffGreen:     '16A34A', // Xanh lá đậm cho trạng thái khớp
  diffRed:       'DC2626', // Đỏ đậm cho số lệch ca
  diffAmber:     'D97706', // Vàng cam cho cảnh báo
};

const thinBorder = { style: 'thin', color: { rgb: COLORS.borderGrid } };
const cellBorder = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};
const headerBorder = {
  top: { style: 'medium', color: { rgb: COLORS.borderDark } },
  bottom: { style: 'medium', color: { rgb: COLORS.borderDark } },
  left: thinBorder,
  right: thinBorder,
};

function cell(value, {
  bold = false,
  bgColor,
  fontColor = COLORS.textDark,
  italic = false,
  wrapText = false,
  align = 'left',
  border = cellBorder,
  fontSize = 10,
} = {}) {
  const c = { v: value ?? '', t: typeof value === 'number' ? 'n' : 's' };
  const font = {
    name: 'Calibri',
    sz: fontSize,
    color: { rgb: fontColor },
  };
  if (bold) font.bold = true;
  if (italic) font.italic = true;

  const fill = bgColor ? { fgColor: { rgb: bgColor }, patternType: 'solid' } : undefined;
  const alignment = {
    horizontal: align,
    vertical: 'center',
    wrapText: Boolean(wrapText),
  };
  c.s = {
    font,
    ...(fill ? { fill } : {}),
    alignment,
    ...(border ? { border } : {}),
  };
  return c;
}

function numCell(value, {
  bold = false,
  bgColor,
  fontColor = COLORS.textDark,
  align = 'center',
  border = cellBorder,
  fontSize = 10,
} = {}) {
  if (value === null || value === undefined || value === '') {
    return cell('—', { bgColor, fontColor: COLORS.textMuted, align: 'center', border, fontSize });
  }
  return cell(value, { bold, bgColor, fontColor, align, border, fontSize });
}

function formatRate(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number') return val.toLocaleString('vi-VN');
  return String(val);
}

/**
 * Xuất file Excel đối soát với định dạng 2 bảng riêng biệt, đóng khung, tô màu và dịch trạng thái.
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

  // Dòng 1: Tiêu đề lớn
  const title = `BẢNG ĐỐI SOÁT CA ĐÊM THÁNG ${month} — XÍ NGHIỆP VS HỆ THỐNG CFC`;
  ws['A1'] = cell(title, {
    bold: true,
    bgColor: COLORS.tblHeaderXN,
    fontColor: COLORS.textWhite,
    fontSize: 12,
    border: null,
  });

  // Dòng 2: Thời gian xuất
  ws['A2'] = cell(
    `Xuất ngày: ${new Date().toLocaleString('vi-VN')} · Bảng bên trái: Xí nghiệp gửi · Bảng bên phải: Hệ thống CFC & Kết quả đối soát`,
    { italic: true, fontColor: COLORS.textMuted, border: null },
  );

  // Vị trí dòng
  const ROW_H1 = 3; // Tiêu đề nhóm bảng
  const ROW_H2 = 4; // Tiêu đề cột
  const ROW_DATA_START = 5;

  // ── HÀNG 3: Super-headers nhóm bảng ──
  // STT
  ws[`A${ROW_H1}`] = cell('STT', { bold: true, bgColor: COLORS.tblHeaderXN, fontColor: COLORS.textWhite, align: 'center', border: headerBorder, fontSize: 11 });
  // BẢNG 1: Xí nghiệp (B-F)
  ws[`B${ROW_H1}`] = cell('BẢNG 1: SỐ LIỆU TỪ XÍ NGHIỆP GỬI', { bold: true, bgColor: COLORS.tblHeaderXN, fontColor: COLORS.textWhite, align: 'center', border: headerBorder, fontSize: 11 });
  ['C', 'D', 'E', 'F'].forEach((col) => {
    ws[`${col}${ROW_H1}`] = cell('', { bgColor: COLORS.tblHeaderXN, border: headerBorder });
  });

  // Cột khoảng cách G (không viền, không nền)
  ws[`G${ROW_H1}`] = cell('', { border: null });

  // BẢNG 2: Hệ thống CFC (H-L)
  ws[`H${ROW_H1}`] = cell('BẢNG 2: SỐ LIỆU HỆ THỐNG CFC', { bold: true, bgColor: COLORS.tblHeaderSys, fontColor: COLORS.textWhite, align: 'center', border: headerBorder, fontSize: 11 });
  ['I', 'J', 'K', 'L'].forEach((col) => {
    ws[`${col}${ROW_H1}`] = cell('', { bgColor: COLORS.tblHeaderSys, border: headerBorder });
  });

  // KẾT QUẢ ĐỐI SOÁT & GHI CHÚ (M-O)
  ws[`M${ROW_H1}`] = cell('KẾT QUẢ ĐỐI SOÁT & GHI CHÚ', { bold: true, bgColor: COLORS.tblHeaderDiff, fontColor: COLORS.textWhite, align: 'center', border: headerBorder, fontSize: 11 });
  ['N', 'O'].forEach((col) => {
    ws[`${col}${ROW_H1}`] = cell('', { bgColor: COLORS.tblHeaderDiff, border: headerBorder });
  });

  // ── HÀNG 4: Tiêu đề cột chi tiết ──
  // Bảng Xí nghiệp
  ws[`A${ROW_H2}`] = cell('STT', { bold: true, bgColor: COLORS.colHeaderXN, fontColor: COLORS.textWhite, align: 'center' });
  ws[`B${ROW_H2}`] = cell('Mã NV (XN)', { bold: true, bgColor: COLORS.colHeaderXN, fontColor: COLORS.textWhite, align: 'center' });
  ws[`C${ROW_H2}`] = cell('Họ và tên (XN)', { bold: true, bgColor: COLORS.colHeaderXN, fontColor: COLORS.textWhite, align: 'left' });
  ws[`D${ROW_H2}`] = cell('Công ca đêm', { bold: true, bgColor: COLORS.colHeaderXN, fontColor: COLORS.textWhite, align: 'center' });
  ws[`E${ROW_H2}`] = cell('Tích 12 (mức)', { bold: true, bgColor: COLORS.colHeaderXN, fontColor: COLORS.textWhite, align: 'right' });
  ws[`F${ROW_H2}`] = cell('Tích 24 (mức)', { bold: true, bgColor: COLORS.colHeaderXN, fontColor: COLORS.textWhite, align: 'right' });

  // Cột khoảng cách G
  ws[`G${ROW_H2}`] = cell('', { border: null });

  // Bảng Hệ thống
  ws[`H${ROW_H2}`] = cell('Mã NV (HT)', { bold: true, bgColor: COLORS.colHeaderSys, fontColor: COLORS.textWhite, align: 'center' });
  ws[`I${ROW_H2}`] = cell('Họ và tên (HT)', { bold: true, bgColor: COLORS.colHeaderSys, fontColor: COLORS.textWhite, align: 'left' });
  ws[`J${ROW_H2}`] = cell('Công ca đêm', { bold: true, bgColor: COLORS.colHeaderSys, fontColor: COLORS.textWhite, align: 'center' });
  ws[`K${ROW_H2}`] = cell('Tích 12 (tháng)', { bold: true, bgColor: COLORS.colHeaderSys, fontColor: COLORS.textWhite, align: 'center' });
  ws[`L${ROW_H2}`] = cell('Tích 24 (tháng)', { bold: true, bgColor: COLORS.colHeaderSys, fontColor: COLORS.textWhite, align: 'center' });

  // Nhóm Đối soát & Ghi chú
  ws[`M${ROW_H2}`] = cell('Lệch ca đêm', { bold: true, bgColor: COLORS.colHeaderDiff, fontColor: COLORS.textWhite, align: 'center' });
  ws[`N${ROW_H2}`] = cell('Trạng thái HT', { bold: true, bgColor: COLORS.colHeaderDiff, fontColor: COLORS.textWhite, align: 'center' });
  ws[`O${ROW_H2}`] = cell('Ghi chú đối soát', { bold: true, bgColor: COLORS.colHeaderDiff, fontColor: COLORS.textWhite, align: 'left' });

  // ── HÀNG DỮ LIỆU (Row 5+) ──
  let rowIdx = ROW_DATA_START;
  let sumXnCaDem = 0;
  let sumSysCaDem = 0;
  let diffCount = 0;
  let matchCount = 0;

  matched.forEach((r, i) => {
    if (typeof r.xnCaDem === 'number') sumXnCaDem += r.xnCaDem;
    if (typeof r.sysCaDem === 'number') sumSysCaDem += r.sysCaDem;

    const hasDiff = r.diffCaDem !== null && r.diffCaDem !== 0;
    const isWarning = !hasDiff && (
      r.xnCaDem === null ||
      r.sysStatus === 'NOT_QUALIFIED' ||
      r.sysStatus === 'QUALIFIED_EXCEPTION' ||
      r.sysStatus === 'STALE'
    );

    let rowBg;
    let diffText;
    let diffColor;

    if (hasDiff) {
      diffCount++;
      rowBg = COLORS.rowDiff; // #FFEBEE — Đỏ nhạt
      diffText = r.diffCaDem > 0 ? `+${r.diffCaDem} ca` : `${r.diffCaDem} ca`;
      diffColor = COLORS.diffRed;
    } else if (isWarning) {
      matchCount++;
      rowBg = COLORS.rowWarning; // #FEF3C7 — Vàng nhạt
      diffText = r.xnCaDem === null ? 'Chờ số liệu' : 'Khớp (0 ca)';
      diffColor = COLORS.diffAmber;
    } else {
      matchCount++;
      rowBg = COLORS.rowMatch; // #E8F5E9 — Xanh lá nhạt
      diffText = 'Khớp (0 ca)';
      diffColor = COLORS.diffGreen;
    }

    const statusVi = STATUS_LABELS[r.sysStatus] || r.sysStatus || '—';

    // Bảng 1: Xí nghiệp (A-F)
    ws[`A${rowIdx}`] = numCell(i + 1, { bgColor: rowBg, align: 'center' });
    ws[`B${rowIdx}`] = cell(r.xnMaNV, { bold: true, bgColor: rowBg, align: 'center' });
    ws[`C${rowIdx}`] = cell(r.xnHoTen, { bgColor: rowBg, align: 'left' });
    ws[`D${rowIdx}`] = numCell(r.xnCaDem, { bold: true, bgColor: rowBg, align: 'center' });
    ws[`E${rowIdx}`] = cell(formatRate(r.xnTich12Rate), { bgColor: rowBg, align: 'right' });
    ws[`F${rowIdx}`] = cell(formatRate(r.xnTich24Rate), { bgColor: rowBg, align: 'right' });

    // Spacer column G (không viền)
    ws[`G${rowIdx}`] = cell('', { border: null });

    // Bảng 2: Hệ thống (H-L)
    ws[`H${rowIdx}`] = cell(r.sysMaNV, { bold: true, bgColor: rowBg, align: 'center' });
    ws[`I${rowIdx}`] = cell(r.sysHoTen, { bgColor: rowBg, align: 'left' });
    ws[`J${rowIdx}`] = numCell(r.sysCaDem, { bold: true, bgColor: rowBg, align: 'center' });
    ws[`K${rowIdx}`] = numCell(r.sysTich12Months, { bgColor: rowBg, align: 'center' });
    ws[`L${rowIdx}`] = numCell(r.sysTich24Months, { bgColor: rowBg, align: 'center' });

    // Nhóm Đối soát & Ghi chú (M-O)
    ws[`M${rowIdx}`] = cell(diffText, { bold: true, bgColor: rowBg, fontColor: diffColor, align: 'center' });
    ws[`N${rowIdx}`] = cell(statusVi, { bold: isWarning || hasDiff, bgColor: rowBg, align: 'center' });
    ws[`O${rowIdx}`] = cell(r.note, { bgColor: rowBg, align: 'left', wrapText: true });

    rowIdx++;
  });

  // ── DÒNG TỔNG KẾT BẢNG ──
  const summaryRow = rowIdx;
  // Bảng 1 Tổng (A-F)
  ws[`A${summaryRow}`] = cell('TỔNG', { bold: true, bgColor: COLORS.tblHeaderXN, fontColor: COLORS.textWhite, align: 'center' });
  ws[`B${summaryRow}`] = cell(`${matched.length} NV`, { bold: true, bgColor: COLORS.rowTotal, align: 'center' });
  ws[`C${summaryRow}`] = cell('', { bgColor: COLORS.rowTotal });
  ws[`D${summaryRow}`] = numCell(sumXnCaDem, { bold: true, bgColor: COLORS.rowTotal, align: 'center' });
  ws[`E${summaryRow}`] = cell('', { bgColor: COLORS.rowTotal });
  ws[`F${summaryRow}`] = cell('', { bgColor: COLORS.rowTotal });

  // Cột khoảng cách G
  ws[`G${summaryRow}`] = cell('', { border: null });

  // Bảng 2 Tổng (H-O)
  ws[`H${summaryRow}`] = cell('TỔNG', { bold: true, bgColor: COLORS.tblHeaderSys, fontColor: COLORS.textWhite, align: 'center' });
  ws[`I${summaryRow}`] = cell(`${matched.length} NV`, { bold: true, bgColor: COLORS.rowTotal, align: 'center' });
  ws[`J${summaryRow}`] = numCell(sumSysCaDem, { bold: true, bgColor: COLORS.rowTotal, align: 'center' });
  ws[`K${summaryRow}`] = cell('', { bgColor: COLORS.rowTotal });
  ws[`L${summaryRow}`] = cell('', { bgColor: COLORS.rowTotal });
  ws[`M${summaryRow}`] = cell(
    diffCount > 0 ? `Lệch: ${diffCount} NV` : 'Khớp 100%',
    {
      bold: true,
      bgColor: diffCount > 0 ? COLORS.rowDiff : COLORS.rowMatch,
      fontColor: diffCount > 0 ? COLORS.diffRed : COLORS.diffGreen,
      align: 'center',
    },
  );
  ws[`N${summaryRow}`] = cell(`Khớp: ${matchCount} NV`, { bold: true, bgColor: COLORS.rowMatch, fontColor: COLORS.diffGreen, align: 'center' });
  ws[`O${summaryRow}`] = cell('', { bgColor: COLORS.rowTotal });

  // Cấu hình vùng in và độ rộng cột
  ws['!ref'] = `A1:O${summaryRow}`;
  ws['!cols'] = [
    { wch: 6 },  // A STT
    { wch: 12 }, // B Mã NV (XN)
    { wch: 24 }, // C Họ và tên (XN)
    { wch: 14 }, // D Công ca đêm (XN)
    { wch: 15 }, // E Tích 12 (mức)
    { wch: 15 }, // F Tích 24 (mức)
    { wch: 3 },  // G Khoảng cách 2 bảng (ngăn cách trực quan)
    { wch: 12 }, // H Mã NV (HT)
    { wch: 24 }, // I Họ và tên (HT)
    { wch: 14 }, // J Công ca đêm (HT)
    { wch: 14 }, // K Tích 12 (tháng)
    { wch: 14 }, // L Tích 24 (tháng)
    { wch: 16 }, // M Lệch ca đêm
    { wch: 18 }, // N Trạng thái HT (tiếng Việt)
    { wch: 38 }, // O Ghi chú đối soát
  ];

  // Merge cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },   // A1:F1 Tiêu đề bảng 1
    { s: { r: 0, c: 7 }, e: { r: 0, c: 14 } },  // H1:O1 Tiêu đề bảng 2
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },  // A2:O2 Chú thích thời gian
    { s: { r: 2, c: 1 }, e: { r: 2, c: 5 } },   // B3:F3 Bảng 1: Số liệu xí nghiệp
    { s: { r: 2, c: 7 }, e: { r: 2, c: 11 } },  // H3:L3 Bảng 2: Số liệu hệ thống
    { s: { r: 2, c: 12 }, e: { r: 2, c: 14 } }, // M3:O3 Kết quả đối soát
  ];

  return ws;
}

function buildOnlyXNSheet(onlyInXN, month) {
  const ws = {};
  ws['A1'] = cell(`DANH SÁCH CHỈ CÓ TRONG FILE XÍ NGHIỆP — Tháng ${month}`, {
    bold: true,
    bgColor: COLORS.tblHeaderXN,
    fontColor: COLORS.textWhite,
    fontSize: 12,
    border: null,
  });
  ws['A2'] = cell(
    'Những nhân viên này có trong file XN gửi nhưng KHÔNG tìm thấy trong hệ thống CFC. Cần kiểm tra lại mã NV.',
    { italic: true, fontColor: COLORS.textMuted, border: null },
  );

  const headers = [
    { label: 'STT', align: 'center', w: 6 },
    { label: 'Mã NV (XN)', align: 'center', w: 14 },
    { label: 'Họ và tên (XN)', align: 'left', w: 26 },
    { label: 'Công ca đêm', align: 'center', w: 14 },
    { label: 'Tích 12 (mức)', align: 'right', w: 16 },
    { label: 'Tích 24 (mức)', align: 'right', w: 16 },
  ];

  const ROW_HDR = 4;
  headers.forEach((h, i) => {
    ws[`${colName(i)}${ROW_HDR}`] = cell(h.label, {
      bold: true,
      bgColor: COLORS.colHeaderXN,
      fontColor: COLORS.textWhite,
      align: h.align,
    });
  });

  onlyInXN.forEach((r, i) => {
    const row = ROW_HDR + 1 + i;
    const bg = COLORS.rowOnlyXN;
    ws[`A${row}`] = numCell(i + 1, { bgColor: bg, align: 'center' });
    ws[`B${row}`] = cell(r.maNV, { bold: true, bgColor: bg, align: 'center' });
    ws[`C${row}`] = cell(r.hoTen, { bgColor: bg, align: 'left' });
    ws[`D${row}`] = numCell(r.caDem, { bold: true, bgColor: bg, align: 'center' });
    ws[`E${row}`] = cell(formatRate(r.tich12Rate), { bgColor: bg, align: 'right' });
    ws[`F${row}`] = cell(formatRate(r.tich24Rate), { bgColor: bg, align: 'right' });
  });

  ws['!ref'] = `A1:F${ROW_HDR + onlyInXN.length}`;
  ws['!cols'] = headers.map((h) => ({ wch: h.w }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];
  return ws;
}

function buildOnlySystemSheet(onlyInSystem, month) {
  const ws = {};
  ws['A1'] = cell(`DANH SÁCH CHỈ CÓ TRONG HỆ THỐNG CFC — Tháng ${month}`, {
    bold: true,
    bgColor: COLORS.tblHeaderSys,
    fontColor: COLORS.textWhite,
    fontSize: 12,
    border: null,
  });
  ws['A2'] = cell(
    'Những nhân viên này có dữ liệu trong hệ thống CFC nhưng KHÔNG có trong file xí nghiệp gửi. Có thể xí nghiệp gửi thiếu.',
    { italic: true, fontColor: COLORS.textMuted, border: null },
  );

  const headers = [
    { label: 'STT', align: 'center', w: 6 },
    { label: 'Mã NV (HT)', align: 'center', w: 14 },
    { label: 'Họ và tên (HT)', align: 'left', w: 26 },
    { label: 'Công ca đêm (HT)', align: 'center', w: 14 },
    { label: 'Tích 12 (tháng)', align: 'center', w: 15 },
    { label: 'Tích 24 (tháng)', align: 'center', w: 15 },
    { label: 'Trạng thái HT', align: 'center', w: 18 },
  ];

  const ROW_HDR = 4;
  headers.forEach((h, i) => {
    ws[`${colName(i)}${ROW_HDR}`] = cell(h.label, {
      bold: true,
      bgColor: COLORS.colHeaderSys,
      fontColor: COLORS.textWhite,
      align: h.align,
    });
  });

  onlyInSystem.forEach((r, i) => {
    const row = ROW_HDR + 1 + i;
    const bg = COLORS.rowOnlySys;
    const statusVi = STATUS_LABELS[r.sysStatus] || r.sysStatus || '—';

    ws[`A${row}`] = numCell(i + 1, { bgColor: bg, align: 'center' });
    ws[`B${row}`] = cell(r.sysMaNV, { bold: true, bgColor: bg, align: 'center' });
    ws[`C${row}`] = cell(r.sysHoTen, { bgColor: bg, align: 'left' });
    ws[`D${row}`] = numCell(r.sysCaDem, { bold: true, bgColor: bg, align: 'center' });
    ws[`E${row}`] = numCell(r.sysTich12Months, { bgColor: bg, align: 'center' });
    ws[`F${row}`] = numCell(r.sysTich24Months, { bgColor: bg, align: 'center' });
    ws[`G${row}`] = cell(statusVi, { bgColor: bg, align: 'center' });
  });

  ws['!ref'] = `A1:G${ROW_HDR + onlyInSystem.length}`;
  ws['!cols'] = headers.map((h) => ({ wch: h.w }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  ];
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

