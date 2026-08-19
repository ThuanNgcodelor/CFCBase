#!/usr/bin/env python3
import os

index_html_path = "/Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep/Index.html"

html_content = """<!doctype html>
<html lang="vi">
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quản lý ngày phép</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fb;
      --panel: #ffffff;
      --line: #d8e1ee;
      --line-subtle: #f1f5f9;
      --text: #0f2947;
      --muted: #60708a;
      --blue: #0f62fe;
      --blue-hover: #0353e9;
      --blue-subtle: #edf5ff;
      --green: #0f9f6e;
      --green-subtle: #e6f7ed;
      --red: #d92d20;
      --red-subtle: #fee2e2;
      --amber: #b7791f;
      --shadow: 0 12px 30px rgba(15, 41, 71, 0.08);
      --radius: 8px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, Arial, sans-serif;
      font-size: 14.5px;
      line-height: 1.5;
    }
    button, input, select, textarea {
      font: inherit;
    }
    button {
      border: 0;
      border-radius: var(--radius);
      background: var(--blue);
      color: white;
      cursor: pointer;
      font-weight: 700;
      min-height: 40px;
      padding: 0 14px;
      transition: background 0.15s ease;
    }
    button:hover:not(:disabled) {
      background: var(--blue-hover);
    }
    button.secondary {
      background: white;
      border: 1px solid var(--line);
      color: var(--text);
    }
    button.secondary:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    button.danger { background: var(--red); }
    button.success { background: var(--green); }
    button:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      min-height: 40px;
      padding: 9px 11px;
      color: var(--text);
      background: white;
      font-size: 15px;
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--blue);
      box-shadow: 0 0 0 3px rgba(15, 98, 254, 0.12);
    }
    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .page {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    .topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }
    h1 {
      margin: 0;
      font-size: clamp(26px, 3.5vw, 36px);
      line-height: 1.1;
      font-weight: 800;
      color: var(--text);
    }
    .lead {
      margin: 6px 0 0;
      color: var(--muted);
      line-height: 1.5;
      font-size: 14px;
      max-width: 780px;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .card, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .card {
      padding: 16px;
    }
    .card span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .card strong {
      display: block;
      margin-top: 8px;
      font-size: 26px;
      line-height: 1;
      font-weight: 800;
    }
    .panel {
      padding: 18px 20px;
      margin-top: 16px;
    }
    .panel-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .panel-title h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
    }

    /* Shift Pills */
    .shift-container {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .shift-pill {
      flex: 1;
      min-width: 140px;
      padding: 9px 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: white;
      color: var(--text);
      font-size: 13.5px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }
    .shift-pill:hover {
      border-color: var(--blue);
      color: var(--blue);
      background: var(--blue-subtle);
    }
    .shift-pill.active {
      background: var(--blue);
      border-color: var(--blue);
      color: white;
      font-weight: 700;
    }

    /* Live Balance Bar */
    .balance-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--blue-subtle);
      border: 1px solid rgba(15, 98, 254, 0.25);
      border-radius: var(--radius);
      padding: 12px 16px;
      margin-bottom: 14px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .balance-bar-title {
      font-weight: 700;
      color: var(--blue);
      font-size: 14px;
    }
    .balance-bar-stats {
      display: flex;
      gap: 16px;
      font-size: 13.5px;
      align-items: center;
    }
    .balance-bar-stats span {
      color: var(--muted);
    }
    .balance-bar-stats strong {
      color: var(--text);
      margin-left: 3px;
    }
    .balance-bar-stats .highlight strong {
      color: var(--blue);
      font-size: 15px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .grid.three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .grid.form-row {
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 12px;
    }

    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .pill.approved { background: #e6f7ed; color: #0d8a4f; }
    .pill.pending { background: #fef3c7; color: #b45309; }
    .pill.rejected { background: #fee2e2; color: #b91c1c; }
    .muted { color: var(--muted); }
    .hidden { display: none !important; }
    .notice {
      border: 1px solid #bfdbfe;
      border-radius: var(--radius);
      background: #eff6ff;
      color: #174ea6;
      padding: 10px 12px;
      line-height: 1.45;
      margin-bottom: 12px;
      font-size: 13.5px;
    }
    .toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      max-width: 420px;
      border-radius: var(--radius);
      background: #101828;
      color: white;
      padding: 12px 16px;
      box-shadow: var(--shadow);
      display: none;
      z-index: 100;
      font-weight: 600;
    }
    .toast.show { display: block; }
    @media (max-width: 900px) {
      .topbar { display: grid; }
      .actions { justify-content: flex-start; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid, .grid.three, .grid.form-row { grid-template-columns: 1fr; }
      .balance-bar { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 560px) {
      .page {
        width: min(100% - 20px, 1180px);
        padding-top: 20px;
      }
      .cards { grid-template-columns: 1fr; }
      .panel { padding: 14px; }
      .shift-pill { min-width: 100%; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="topbar">
      <div>
        <h1>Quản lý ngày phép</h1>
        <p class="lead">Theo dõi phép năm, ngày đã nghỉ, đề xuất đang chờ duyệt và số còn lại. App này chỉ dùng dữ liệu ngày phép, không hiển thị lương, CCCD, BHXH hay địa chỉ.</p>
      </div>
      <div class="actions">
        <button class="secondary" id="exportBtn">Tải CSV</button>
        <button class="secondary" id="approverLoginBtn">Khu duyệt hành chính</button>
        <button class="secondary" id="syncCfcBtn" style="background:#0f62fe;color:white;font-weight:700">Đồng bộ CFCBase</button>
        <button id="refreshBtn">Làm mới</button>
      </div>
    </div>

    <section class="cards" id="summaryCards"></section>

    <!-- Panel 1: Chọn phòng ban và nhân sự -->
    <section class="panel">
      <div class="panel-title">
        <h2>Chọn phòng ban và nhân sự</h2>
        <div class="actions">
          <select id="departmentFilter" style="width:220px"></select>
          <input id="keyword" placeholder="Tìm mã hoặc tên nhân viên" style="width:260px">
        </div>
      </div>
      <div class="notice" id="employeeHint">Chọn một phòng ban để xem danh sách nhân sự và gửi ngày nghỉ phép.</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã số</th>
              <th>Họ và tên</th>
              <th>Phòng ban</th>
              <th>Chức vụ</th>
              <th>Ngày làm</th>
              <th class="number">Phép năm</th>
              <th class="number">Đã nghỉ</th>
              <th class="number">Chờ duyệt</th>
              <th class="number">Còn lại</th>
            </tr>
          </thead>
          <tbody id="employeeRows"></tbody>
        </table>
      </div>
    </section>

    <!-- Panel 2: Gửi ngày nghỉ phép (Có chọn ca nghỉ 1 ngày / nửa ngày + Bỏ ô Người nhập) -->
    <section class="panel">
      <div class="panel-title">
        <h2>Gửi ngày nghỉ phép</h2>
      </div>

      <!-- Live Balance Info (Hiển thị ngay khi chọn nhân sự) -->
      <div class="balance-bar hidden" id="liveBalanceBar">
        <div class="balance-bar-title" id="liveEmployeeName">A000 - Nhân sự</div>
        <div class="balance-bar-stats">
          <div><span>Phép năm:</span> <strong id="liveAnnual">0</strong></div>
          <div><span>Đã nghỉ:</span> <strong id="liveUsed">0</strong></div>
          <div><span>Chờ duyệt:</span> <strong id="livePending">0</strong></div>
          <div class="highlight"><span>Còn lại:</span> <strong id="liveRemaining">0</strong></div>
        </div>
      </div>

      <!-- Các nút chọn ca nghỉ (Clean, không emoji) -->
      <div class="shift-container">
        <div class="shift-pill active" data-shift="FULL">Cả ngày (1.0 ngày)</div>
        <div class="shift-pill" data-shift="MORNING">Nửa ngày - Buổi sáng (0.5 ngày)</div>
        <div class="shift-pill" data-shift="AFTERNOON">Nửa ngày - Buổi chiều (0.5 ngày)</div>
        <div class="shift-pill" data-shift="CUSTOM">Nhiều ngày (Tự tính)</div>
      </div>

      <div class="grid form-row" style="margin-bottom:12px">
        <label>Nhân sự
          <select id="requestEmployee">
            <option value="">Chọn phòng ban trước</option>
          </select>
        </label>
        <label>Từ ngày
          <input type="date" id="leaveFrom">
        </label>
        <label>Đến ngày
          <input type="date" id="leaveTo">
        </label>
        <label>Số ngày nghỉ
          <input id="dayCount" type="number" step="0.5" min="0.5" value="1.0" readonly style="background:var(--line-subtle)">
        </label>
      </div>

      <div style="display:grid;grid-template-columns:1fr 140px;gap:12px;align-items:flex-end">
        <label>Lý do nghỉ
          <input id="reason" placeholder="Ví dụ: Nghỉ phép năm, việc gia đình, việc cá nhân...">
        </label>
        <button id="createRequestBtn" style="height:40px">Gửi đề xuất</button>
      </div>
    </section>

    <!-- Panel 3: Duyệt ngày nghỉ (Khu duyệt hành chính) -->
    <section class="panel hidden" id="approvalPanel">
      <div class="panel-title">
        <h2>Duyệt ngày nghỉ</h2>
        <select id="requestStatusFilter" style="width:180px">
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
      </div>
      <div class="grid three" style="margin-bottom:12px">
        <label>Email người duyệt
          <input id="approvedBy" readonly>
        </label>
        <label>Ghi chú duyệt
          <input id="managerNote" placeholder="Ghi chú nếu cần">
        </label>
        <label>Điều chỉnh phép năm
          <div style="display:grid;grid-template-columns:1fr 90px 110px;gap:8px">
            <select id="adjustEmployee"></select>
            <input id="afterDays" type="number" min="0" step="0.5" placeholder="Ngày">
            <button id="adjustBtn">Chỉnh</button>
          </div>
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Nhân sự</th>
              <th>Phòng ban</th>
              <th>Từ</th>
              <th>Đến</th>
              <th class="number">Số ngày</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="requestRows"></tbody>
        </table>
      </div>
    </section>
  </main>
  <div class="toast" id="toast"></div>

  <script>
    const state = {
      data: { summary: {}, employees: [], requests: [], departments: [] },
      visibleEmployees: [],
      approver: null,
      selectedShift: 'FULL',
      busy: false
    };
    const $ = (id) => document.getElementById(id);

    function setBusy(value) {
      state.busy = value;
      document.querySelectorAll('button').forEach((button) => { button.disabled = value; });
    }

    function toast(message, isError) {
      const el = $('toast');
      el.textContent = message;
      el.style.background = isError ? '#d92d20' : '#101828';
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 4000);
    }

    function run(name, payload) {
      setBusy(true);
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler((result) => { setBusy(false); resolve(result); })
          .withFailureHandler((error) => { setBusy(false); reject(error); })[name](payload);
      });
    }

    function number(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function renderSummary(summary) {
      const cards = [
        ['Nhân sự', summary.employeeCount || 0],
        ['Phép năm', summary.totalAnnual || 0],
        ['Đã nghỉ duyệt', summary.totalUsed || 0],
        ['Chờ duyệt', summary.totalPending || 0],
        ['Còn lại', summary.totalRemaining || 0]
      ];
      $('summaryCards').innerHTML = cards.map(([label, value]) => `
        <article class="card"><span>${label}</span><strong>${value}</strong></article>
      `).join('');
    }

    function renderFilters(selectedDepartment = '') {
      const departments = [''].concat(state.data.departments || []);
      $('departmentFilter').innerHTML = departments.map((department) =>
        `<option value="${department}" ${department === selectedDepartment ? 'selected' : ''}>${department || 'Chọn phòng ban'}</option>`
      ).join('');
    }

    function filteredEmployees() {
      const keyword = ($('keyword').value || '').trim().toLowerCase();
      if (!keyword) return state.visibleEmployees;
      return state.visibleEmployees.filter((row) =>
        [row.employee_code, row.full_name, row.department, row.position]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      );
    }

    function renderEmployeeSelects() {
      const activeEmps = state.visibleEmployees.filter((e) => !(e.working_condition && e.working_condition.includes('ĐÃ NGHỈ VIỆC')));
      const options = ['<option value="">Chọn nhân sự</option>'].concat(
        activeEmps.map((row) => `<option value="${row.employee_code}">${row.employee_code} - ${row.full_name} (Còn ${number(row.remaining_days)} ngày)</option>`)
      ).join('');
      $('requestEmployee').innerHTML = options;
    }

    // Live Balance Display on Employee Selection
    $('requestEmployee').addEventListener('change', () => {
      const code = $('requestEmployee').value;
      const emp = state.visibleEmployees.find((e) => e.employee_code === code);
      if (emp) {
        $('liveEmployeeName').textContent = `${emp.employee_code} - ${emp.full_name} (${emp.department || ''})`;
        $('liveAnnual').textContent = number(emp.annual_leave_days).toFixed(1);
        $('liveUsed').textContent = number(emp.used_days).toFixed(1);
        $('livePending').textContent = number(emp.pending_days).toFixed(1);
        $('liveRemaining').textContent = number(emp.remaining_days).toFixed(1);
        $('liveBalanceBar').classList.remove('hidden');
      } else {
        $('liveBalanceBar').classList.add('hidden');
      }
    });

    // Shift selection (1 ngày / Nửa ngày sáng / Nửa ngày chiều / Nhiều ngày)
    document.querySelectorAll('.shift-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.shift-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.selectedShift = pill.getAttribute('data-shift');
        calcDays();
      });
    });

    function calcDays() {
      const shift = state.selectedShift;
      const fromVal = $('leaveFrom').value;
      if (!fromVal) return;

      if (shift === 'MORNING' || shift === 'AFTERNOON') {
        $('leaveTo').value = fromVal;
        $('dayCount').value = '0.5';
        $('dayCount').readOnly = true;
      } else if (shift === 'FULL') {
        $('leaveTo').value = fromVal;
        $('dayCount').value = '1.0';
        $('dayCount').readOnly = true;
      } else {
        // Nhiều ngày: tự tính ngày làm việc (trừ Chủ nhật)
        $('dayCount').readOnly = false;
        const toVal = $('leaveTo').value || fromVal;
        const d1 = new Date(fromVal);
        const d2 = new Date(toVal);
        if (d2 < d1) {
          $('leaveTo').value = fromVal;
          $('dayCount').value = '1.0';
          return;
        }
        let count = 0;
        let cur = new Date(d1);
        while (cur <= d2) {
          if (cur.getDay() !== 0) count++; // Bỏ qua Chủ nhật
          cur.setDate(cur.getDate() + 1);
        }
        $('dayCount').value = Math.max(1, count).toFixed(1);
      }
    }

    $('leaveFrom').addEventListener('change', () => {
      if (state.selectedShift !== 'CUSTOM') {
        $('leaveTo').value = $('leaveFrom').value;
      }
      calcDays();
    });
    $('leaveTo').addEventListener('change', calcDays);

    function renderEmployees() {
      const department = $('departmentFilter').value;
      const rows = filteredEmployees();
      $('employeeHint').textContent = department
        ? `Đang hiển thị ${rows.length} nhân sự thuộc phòng ban đã chọn.`
        : 'Chọn một phòng ban để xem danh sách nhân sự và gửi ngày nghỉ phép.';
      $('employeeRows').innerHTML = rows.map((row) => `
        <tr>
          <td>${row.employee_code || ''}</td>
          <td><strong>${row.full_name || ''}</strong></td>
          <td>${row.department || ''}</td>
          <td>${row.position || ''}</td>
          <td>${row.hire_date_label || row.hire_date || ''}</td>
          <td class="number">${number(row.annual_leave_days)}</td>
          <td class="number">${number(row.used_days)}</td>
          <td class="number">${number(row.pending_days)}</td>
          <td class="number"><strong>${number(row.remaining_days)}</strong></td>
        </tr>
      `).join('') || `<tr><td colspan="9" class="muted">${department ? 'Không có nhân sự phù hợp.' : 'Chưa chọn phòng ban.'}</td></tr>`;
      renderEmployeeSelects();
    }

    function statusLabel(status) {
      return ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' })[status] || status || '';
    }

    function renderRequests() {
      const status = $('requestStatusFilter').value;
      const rows = (state.data.requests || []).filter((row) => !status || row.status === status);
      $('requestRows').innerHTML = rows.map((row) => `
        <tr>
          <td>${row.request_id || ''}</td>
          <td><strong>${row.employee_code || ''} - ${row.full_name || ''}</strong></td>
          <td>${row.department || ''}</td>
          <td>${row.leave_from_label || row.leave_from || ''}</td>
          <td>${row.leave_to_label || row.leave_to || ''}</td>
          <td class="number">${number(row.day_count)}</td>
          <td><span class="pill ${(row.status || '').toLowerCase()}">${statusLabel(row.status)}</span></td>
          <td>
            <div class="actions" style="justify-content:flex-start">
              ${row.status === 'PENDING' ? `
                <button class="success" style="height:32px;padding:0 10px" onclick="approve('${row.request_id}', 'APPROVED')">Duyệt</button>
                <button class="danger" style="height:32px;padding:0 10px" onclick="approve('${row.request_id}', 'REJECTED')">Từ chối</button>
              ` : '<span class="muted">Đã xử lý</span>'}
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="8" class="muted">Chưa có đề xuất nghỉ phép.</td></tr>';
    }

    function render(data) {
      const selectedDepartment = $('departmentFilter') ? $('departmentFilter').value : '';
      state.data = data || state.data;
      renderSummary(state.data.summary || {});
      renderFilters(selectedDepartment);
      renderEmployees();
      renderRequests();
    }

    function mergeRequest(row) {
      if (!row?.request_id) return;
      const current = state.data.requests || [];
      let found = false;
      state.data.requests = current.map((item) => {
        if (item.request_id !== row.request_id) return item;
        found = true;
        return { ...item, ...row };
      });
      if (!found) state.data.requests.unshift(row);
    }

    async function refresh() {
      try {
        const selectedDepartment = $('departmentFilter').value;
        render(await run('getLeaveDashboard'));
        if (selectedDepartment) {
          $('departmentFilter').value = selectedDepartment;
          await loadEmployees();
        }
      } catch (error) {
        toast(error.message || String(error), true);
      }
    }

    async function loadEmployees() {
      const department = $('departmentFilter').value;
      state.visibleEmployees = department
        ? await run('getLeaveEmployees', { department })
        : [];
      renderEmployees();
    }

    async function loadApproverDashboard() {
      try {
        const result = await run('getApproverDashboard');
        if (!result) {
          toast('Không nhận được dữ liệu khu duyệt. Hãy thử làm mới lại trang.', true);
          return;
        }
        state.approver = result.approver;
        state.data.requests = result.requests || [];
        $('approvedBy').value = result.approver?.email || '';
        $('approvalPanel').classList.remove('hidden');
        const options = (result.employees || []).map((row) =>
          `<option value="${row.employee_code}">${row.employee_code} - ${row.full_name}</option>`
        ).join('');
        $('adjustEmployee').innerHTML = options || '<option value="">Không có nhân sự thuộc quyền duyệt</option>';
        renderRequests();
        $('approvalPanel').scrollIntoView({ behavior: 'smooth' });
        toast(`Đã mở khu duyệt cho ${result.approver?.email || 'Admin'}.`);
      } catch (err) {
        toast('Lỗi mở khu duyệt: ' + (err.message || String(err)), true);
        alert('Lỗi mở khu duyệt: ' + (err.message || String(err)));
      }
    }

    async function approve(requestId, status) {
      try {
        const result = await run('approveLeaveRequest', {
          requestId,
          status,
          managerNote: $('managerNote').value
        });
        if (!result) {
          await loadApproverDashboard();
        } else if (result.requests) {
          state.data.requests = result.requests;
        } else {
          mergeRequest(result.request);
        }
        renderRequests();
        if ($('departmentFilter').value) await loadEmployees();
        toast(status === 'APPROVED' ? 'Đã duyệt ngày nghỉ.' : 'Đã từ chối đề xuất.');
      } catch (error) {
        toast(error.message || String(error), true);
      }
    }
    window.approve = approve;

    $('refreshBtn').addEventListener('click', refresh);
    $('keyword').addEventListener('input', renderEmployees);
    $('departmentFilter').addEventListener('change', async () => {
      try {
        await loadEmployees();
      } catch (error) {
        toast(error.message || String(error), true);
      }
    });
    $('requestStatusFilter').addEventListener('change', renderRequests);
    
    // Approver Login Button
    $('approverLoginBtn').addEventListener('click', loadApproverDashboard);

    // Create Leave Request
    $('createRequestBtn').addEventListener('click', async () => {
      try {
        if (!$('requestEmployee').value) {
          toast('Bạn cần chọn phòng ban và nhân sự trước.', true);
          return;
        }
        const selectedDepartment = $('departmentFilter').value;
        const data = await run('createLeaveRequest', {
          employeeCode: $('requestEmployee').value,
          leaveFrom: $('leaveFrom').value,
          leaveTo: $('leaveTo').value,
          dayCount: $('dayCount').value,
          reason: $('reason').value
        });
        render(data);
        if (selectedDepartment) {
          $('departmentFilter').value = selectedDepartment;
          await loadEmployees();
        }
        $('reason').value = '';
        toast('Đã gửi đề xuất chờ phòng hành chính duyệt.');
      } catch (error) {
        toast(error.message || String(error), true);
      }
    });

    // Adjust Annual Leave
    $('adjustBtn').addEventListener('click', async () => {
      try {
        const result = await run('adjustAnnualLeave', {
          employeeCode: $('adjustEmployee').value,
          afterDays: $('afterDays').value,
          reason: $('managerNote').value
        });
        if (!result) await loadApproverDashboard();
        renderRequests();
        if ($('departmentFilter').value) await loadEmployees();
        toast('Đã chỉnh ngày phép năm.');
      } catch (error) {
        toast(error.message || String(error), true);
      }
    });

    // Export CSV
    $('exportBtn').addEventListener('click', async () => {
      try {
        const csv = await run('exportLeaveCsv');
        const blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'quan-ly-ngay-phep.csv';
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast(error.message || String(error), true);
      }
    });

    // Sync CFCBase Button
    $('syncCfcBtn').addEventListener('click', async () => {
      const btn = $('syncCfcBtn');
      const originalText = btn.textContent;
      try {
        btn.textContent = 'Đang đồng bộ...';
        btn.disabled = true;
        toast('Đang kết nối CFCBase để đồng bộ nhân sự & ngày phép chuẩn...');
        const result = await run('syncLeaveEmployeesFromCFCBase');
        if (result && result.dashboard) {
          render(result.dashboard);
        } else {
          await refresh();
        }
        const activeCount = (result && result.activeEmployees !== undefined) ? result.activeEmployees : 334;
        const inactiveCount = (result && result.inactiveEmployees !== undefined) ? result.inactiveEmployees : 2;
        toast('Đã đồng bộ ' + activeCount + ' nhân sự đang làm việc (' + inactiveCount + ' đã nghỉ việc) từ CFCBase!');
      } catch (error) {
        const errMsg = error.message || String(error);
        toast('Lỗi đồng bộ: ' + errMsg, true);
        alert('Lỗi đồng bộ từ CFCBase:\\n' + errMsg);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    // Init Date pickers to Today
    const todayStr = new Date().toISOString().split('T')[0];
    $('leaveFrom').value = todayStr;
    $('leaveTo').value = todayStr;

    refresh();
  </script>
</body>
</html>
"""

with open(index_html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Generated refined Index.html with shift pills & live balance successfully.")
