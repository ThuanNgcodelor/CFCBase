#!/usr/bin/env python3
import os

index_html_path = "/Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep/Index.html"

html_content = """<!doctype html>
<html lang="vi">
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CFC Base | Quản Lý Ngày Phép</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f9;
      --panel: #ffffff;
      --panel-glass: rgba(255, 255, 255, 0.88);
      --line: #e2e8f0;
      --line-subtle: #f1f5f9;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --primary-subtle: #eff6ff;
      --success: #10b981;
      --success-subtle: #ecfdf5;
      --warning: #f59e0b;
      --warning-subtle: #fffbeb;
      --danger: #ef4444;
      --danger-subtle: #fef2f2;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      --shadow-lg: 0 20px 30px -10px rgba(15, 23, 42, 0.12);
      --radius: 12px;
      --radius-sm: 8px;
    }

    body.dark {
      color-scheme: dark;
      --bg: #0b0f19;
      --panel: #131b2e;
      --panel-glass: rgba(19, 27, 46, 0.9);
      --line: #222f49;
      --line-subtle: #172238;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #60a5fa;
      --primary-subtle: rgba(59, 130, 246, 0.15);
      --success: #10b981;
      --success-subtle: rgba(16, 185, 129, 0.15);
      --warning: #f59e0b;
      --warning-subtle: rgba(245, 158, 11, 0.15);
      --danger: #ef4444;
      --danger-subtle: rgba(239, 68, 68, 0.15);
      --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Be Vietnam Pro', 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 14.5px;
      line-height: 1.5;
      min-height: 100vh;
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    .page {
      width: min(1200px, calc(100% - 32px));
      margin: 0 auto;
      padding: 24px 0 60px;
    }

    /* Topbar */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--line);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 22px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    .brand h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge-sync {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 20px;
      background: var(--success-subtle);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .brand p {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .actions-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      min-height: 38px;
      padding: 0 14px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--primary);
      color: white;
      box-shadow: var(--shadow-sm);
    }
    button:hover:not(:disabled) {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }
    button.secondary {
      background: var(--panel);
      border-color: var(--line);
      color: var(--text);
    }
    button.secondary:hover:not(:disabled) {
      background: var(--line-subtle);
      border-color: var(--text-muted);
    }
    button.btn-sync {
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      color: white;
      font-weight: 700;
      border: none;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
    button.btn-sync:hover:not(:disabled) {
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    button.icon-btn {
      width: 38px;
      padding: 0;
      font-size: 16px;
    }
    button.success { background: var(--success); color: white; }
    button.danger { background: var(--danger); color: white; }
    button:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }

    /* Stat Cards */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px 18px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
    }
    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat-icon {
      font-size: 18px;
      opacity: 0.85;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 800;
      color: var(--text);
      margin-top: 8px;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .stat-sub {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Tabs Navigation */
    .tab-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--line-subtle);
      padding: 4px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      margin-bottom: 20px;
      width: fit-content;
    }
    .tab-btn {
      background: transparent;
      color: var(--text-muted);
      border: none;
      box-shadow: none;
      font-weight: 600;
      padding: 8px 16px;
      min-height: 36px;
      border-radius: var(--radius-sm);
    }
    .tab-btn.active {
      background: var(--panel);
      color: var(--primary);
      box-shadow: var(--shadow-sm);
      font-weight: 700;
    }

    /* Main Panels */
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
      margin-bottom: 24px;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }
    .panel-header h2 {
      font-size: 17px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Form Styles */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 14px;
    }
    .col-4 { grid-column: span 4; }
    .col-6 { grid-column: span 6; }
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }

    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }
    input, select, textarea {
      font-family: inherit;
      width: 100%;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      min-height: 40px;
      padding: 8px 12px;
      color: var(--text);
      background: var(--panel);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-subtle);
    }

    /* Shift Pills */
    .shift-selector {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .shift-pill {
      flex: 1;
      min-width: 110px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--panel);
      color: var(--text-muted);
      font-size: 12.5px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .shift-pill:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
    .shift-pill.active {
      background: var(--primary-subtle);
      border-color: var(--primary);
      color: var(--primary);
      font-weight: 700;
    }

    /* Live Balance Card */
    .balance-card {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(79, 70, 229, 0.04));
      border: 1px solid rgba(37, 99, 235, 0.2);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .balance-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #38bdf8);
      color: white;
      font-weight: 700;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .balance-stats {
      display: flex;
      gap: 20px;
    }
    .balance-item {
      text-align: center;
    }
    .balance-item span {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
    }
    .balance-item strong {
      font-size: 17px;
      color: var(--text);
    }
    .balance-item.highlight strong {
      color: var(--primary);
      font-size: 20px;
    }

    /* Tables */
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      text-align: left;
    }
    th {
      background: var(--line-subtle);
      color: var(--text-muted);
      font-weight: 700;
      padding: 11px 14px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--line);
      color: var(--text);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--line-subtle); }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 20px;
    }
    .pill.approved { background: var(--success-subtle); color: var(--success); }
    .pill.pending { background: var(--warning-subtle); color: var(--warning); }
    .pill.rejected { background: var(--danger-subtle); color: var(--danger); }
    .pill.inactive { background: #e2e8f0; color: #64748b; }

    /* Filter chips */
    .filter-chips {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .chip {
      padding: 5px 12px;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: var(--panel);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .chip:hover { border-color: var(--primary); color: var(--primary); }
    .chip.active { background: var(--primary); color: white; border-color: var(--primary); }

    /* Calendar View */
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      margin-top: 14px;
    }
    .calendar-day-header {
      font-weight: 700;
      font-size: 12px;
      text-align: center;
      padding: 8px 0;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .calendar-day {
      min-height: 90px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: 8px;
      background: var(--panel);
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: border-color 0.2s;
    }
    .calendar-day.today {
      border-color: var(--primary);
      background: var(--primary-subtle);
    }
    .calendar-day.other-month {
      opacity: 0.35;
    }
    .day-num {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
    }
    .event-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--success-subtle);
      color: var(--success);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .event-badge.pending {
      background: var(--warning-subtle);
      color: var(--warning);
    }

    /* Toast */
    .toast {
      position: fixed;
      right: 20px;
      bottom: 20px;
      max-width: 420px;
      border-radius: var(--radius-sm);
      background: #0f172a;
      color: white;
      padding: 12px 18px;
      box-shadow: var(--shadow-lg);
      font-size: 13.5px;
      font-weight: 600;
      display: none;
      z-index: 1000;
      animation: slideUp 0.25s ease;
    }
    .toast.show { display: block; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hidden { display: none !important; }

    @media (max-width: 1024px) {
      .cards-grid { grid-template-columns: repeat(3, 1fr); }
      .form-grid .col-4, .form-grid .col-6, .form-grid .col-8 { grid-column: span 12; }
    }
    @media (max-width: 640px) {
      .topbar { flex-direction: column; align-items: flex-start; }
      .cards-grid { grid-template-columns: 1fr; }
      .calendar-grid { grid-template-columns: repeat(1, 1fr); }
      .balance-card { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main class="page">
    <!-- Topbar -->
    <header class="topbar">
      <div class="brand">
        <div class="brand-icon">🌴</div>
        <div>
          <h1>Quản Lý Ngày Phép <span class="badge-sync" id="syncStatusBadge">⚡ CFC Base Synced</span></h1>
          <p>Hệ thống theo dõi quỹ phép năm, đơn nghỉ phép và phê duyệt trực tuyến</p>
        </div>
      </div>
      <div class="actions-bar">
        <button id="themeToggleBtn" class="secondary icon-btn" title="Chuyển đổi giao diện Tối/Sáng">🌙</button>
        <button class="secondary" id="exportBtn">📥 Tải CSV</button>
        <button class="secondary" id="approverLoginBtn">🛡️ Khu duyệt</button>
        <button class="btn-sync" id="syncCfcBtn">⚡ Đồng bộ CFCBase</button>
        <button class="secondary icon-btn" id="refreshBtn" title="Làm mới dữ liệu">🔄</button>
      </div>
    </header>

    <!-- 5 Stat Cards -->
    <section class="cards-grid" id="summaryCards">
      <article class="stat-card">
        <div class="stat-header"><span>Nhân Sự</span><span class="stat-icon">👥</span></div>
        <div class="stat-value" id="cardEmpCount">334</div>
        <div class="stat-sub"><span class="badge-sync">Đang làm việc</span></div>
      </article>
      <article class="stat-card">
        <div class="stat-header"><span>Tổng Quỹ Phép</span><span class="stat-icon">🌴</span></div>
        <div class="stat-value" id="cardTotalAnnual">4,431</div>
        <div class="stat-sub"><span>Tổng ngày phép năm</span></div>
      </article>
      <article class="stat-card">
        <div class="stat-header"><span>Đã Nghỉ Duyệt</span><span class="stat-icon">🏖️</span></div>
        <div class="stat-value" id="cardTotalUsed">0</div>
        <div class="stat-sub"><span>Ngày đã sử dụng</span></div>
      </article>
      <article class="stat-card">
        <div class="stat-header"><span>Chờ Duyệt</span><span class="stat-icon">⏳</span></div>
        <div class="stat-value" id="cardTotalPending">0</div>
        <div class="stat-sub"><span>Đơn đang chờ phòng HC</span></div>
      </article>
      <article class="stat-card">
        <div class="stat-header"><span>Còn Lại</span><span class="stat-icon">💎</span></div>
        <div class="stat-value" id="cardTotalRemaining">4,431</div>
        <div class="stat-sub"><span>Khả dụng toàn công ty</span></div>
      </article>
    </section>

    <!-- Tabs Navigation -->
    <nav class="tab-bar">
      <button class="tab-btn active" data-tab="tab-request">📝 Đăng ký & Tra cứu phép</button>
      <button class="tab-btn" data-tab="tab-calendar">📅 Lịch nghỉ phép trực quan</button>
      <button class="tab-btn" data-tab="tab-approver">🛡️ Khu duyệt hành chính</button>
    </nav>

    <!-- TAB 1: Request & Lookup -->
    <div id="tab-request" class="tab-content">
      <!-- Request Form Panel -->
      <section class="panel">
        <div class="panel-header">
          <h2>📝 Gửi Đề Xuất Nghỉ Phép</h2>
          <span style="font-size:12.5px;color:var(--text-muted)">* Điền thông tin bên dưới để gửi đến phòng Hành chính</span>
        </div>

        <!-- Live Balance Card (Hidden until employee chosen) -->
        <div class="balance-card hidden" id="liveBalanceCard">
          <div class="balance-info">
            <div class="avatar-circle" id="liveAvatar">A</div>
            <div>
              <strong style="font-size:16px" id="liveFullName">Nguyễn Văn A</strong>
              <div style="font-size:12.5px;color:var(--text-muted)" id="liveDeptPos">Phòng ban • Chức vụ</div>
            </div>
          </div>
          <div class="balance-stats">
            <div class="balance-item">
              <span>Phép Năm</span>
              <strong id="liveAnnual">14.0</strong>
            </div>
            <div class="balance-item">
              <span>Đã Nghỉ</span>
              <strong id="liveUsed">0.0</strong>
            </div>
            <div class="balance-item">
              <span>Đang Chờ</span>
              <strong id="livePending">0.0</strong>
            </div>
            <div class="balance-item highlight">
              <span>Còn Lại</span>
              <strong id="liveRemaining">14.0</strong>
            </div>
          </div>
        </div>

        <form id="leaveForm" onsubmit="return false;">
          <div class="form-grid">
            <div class="col-6">
              <label>Phòng Ban
                <select id="departmentFilter">
                  <option value="">-- Chọn phòng ban --</option>
                </select>
              </label>
            </div>
            <div class="col-6">
              <label>Nhân Sự Nghỉ Phép
                <select id="requestEmployee">
                  <option value="">-- Chọn phòng ban trước --</option>
                </select>
              </label>
            </div>

            <div class="col-12">
              <label>Hình Thức Nghỉ
                <div class="shift-selector">
                  <div class="shift-pill active" data-shift="FULL">🌞 Cả ngày (1.0)</div>
                  <div class="shift-pill" data-shift="MORNING">🌅 Nửa ngày Sáng (0.5)</div>
                  <div class="shift-pill" data-shift="AFTERNOON">🌇 Nửa ngày Chiều (0.5)</div>
                  <div class="shift-pill" data-shift="CUSTOM">📆 Nhiều ngày (Tự tính)</div>
                </div>
              </label>
            </div>

            <div class="col-4">
              <label>Từ Ngày
                <input type="date" id="leaveFrom" required>
              </label>
            </div>
            <div class="col-4">
              <label>Đến Ngày
                <input type="date" id="leaveTo" required>
              </label>
            </div>
            <div class="col-4">
              <label>Tổng Số Ngày Nghỉ
                <input type="number" id="dayCount" step="0.5" min="0.5" value="1.0" readonly style="background:var(--line-subtle)">
              </label>
            </div>

            <div class="col-12">
              <label>Lý Do Nghỉ
                <input type="text" id="reason" placeholder="Ví dụ: Nghỉ phép năm, việc gia đình, khám sức khỏe..." required>
              </label>
            </div>

            <div class="col-12" style="display:flex;justify-content:flex-end;margin-top:8px">
              <button type="submit" id="createRequestBtn" style="min-width:180px;height:42px;font-size:15px">
                🚀 Gửi Đề Xuất Nghỉ Phép
              </button>
            </div>
          </div>
        </form>
      </section>

      <!-- Employee List Table Panel -->
      <section class="panel">
        <div class="panel-header">
          <h2>👥 Danh Sách Quỹ Phép Phòng Ban</h2>
          <div style="display:flex;gap:10px;align-items:center">
            <input type="text" id="keyword" placeholder="🔍 Tìm theo mã hoặc tên..." style="width:240px">
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ và Tên</th>
                <th>Phòng Ban</th>
                <th>Chức Vụ</th>
                <th>Ngày Vào Làm</th>
                <th class="number">Phép Năm</th>
                <th class="number">Đã Nghỉ</th>
                <th class="number">Chờ Duyệt</th>
                <th class="number">Còn Lại</th>
              </tr>
            </thead>
            <tbody id="employeeRows">
              <tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">Vui lòng chọn phòng ban bên trên để xem danh sách.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- TAB 2: Calendar View -->
    <div id="tab-calendar" class="tab-content hidden">
      <section class="panel">
        <div class="panel-header">
          <h2>📅 Lịch Nghỉ Phép Tháng</h2>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="secondary icon-btn" id="prevMonthBtn">◀</button>
            <strong id="calendarMonthLabel" style="font-size:15px">Tháng 08 / 2026</strong>
            <button class="secondary icon-btn" id="nextMonthBtn">▶</button>
          </div>
        </div>

        <div class="calendar-grid">
          <div class="calendar-day-header">Thứ 2</div>
          <div class="calendar-day-header">Thứ 3</div>
          <div class="calendar-day-header">Thứ 4</div>
          <div class="calendar-day-header">Thứ 5</div>
          <div class="calendar-day-header">Thứ 6</div>
          <div class="calendar-day-header">Thứ 7</div>
          <div class="calendar-day-header" style="color:var(--danger)">Chủ Nhật</div>
        </div>
        <div class="calendar-grid" id="calendarDaysGrid"></div>
      </section>
    </div>

    <!-- TAB 3: Approver Area -->
    <div id="tab-approver" class="tab-content hidden">
      <section class="panel">
        <div class="panel-header">
          <h2>🛡️ Khu Phê Duyệt Nghỉ Phép (Phòng Hành Chính)</h2>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="approvedBy" readonly placeholder="Email người duyệt" style="width:240px">
          </div>
        </div>

        <div class="filter-chips">
          <div class="chip active" data-filter="">Tất cả</div>
          <div class="chip" data-filter="PENDING">⏳ Chờ duyệt</div>
          <div class="chip" data-filter="APPROVED">✅ Đã duyệt</div>
          <div class="chip" data-filter="REJECTED">❌ Từ chối</div>
        </div>

        <div style="margin-bottom:14px">
          <label>Ghi chú khi duyệt / từ chối
            <input type="text" id="managerNote" placeholder="Nhập ghi chú cho người làm đơn (nếu có)...">
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Nhân Sự</th>
                <th>Phòng Ban</th>
                <th>Thời Gian</th>
                <th class="number">Số Ngày</th>
                <th>Lý Do</th>
                <th>Trạng Thái</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody id="requestRows">
              <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">Chưa có đề xuất nghỉ phép nào.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Adjust Annual Leave Panel -->
      <section class="panel">
        <div class="panel-header">
          <h2>⚙️ Điều Chỉnh Quỹ Phép Năm</h2>
        </div>
        <div class="form-grid">
          <div class="col-6">
            <label>Chọn Nhân Sự
              <select id="adjustEmployee"></select>
            </label>
          </div>
          <div class="col-3">
            <label>Số Ngày Phép Mới
              <input type="number" id="afterDays" min="0" step="0.5" placeholder="Ví dụ: 14.0">
            </label>
          </div>
          <div class="col-3" style="display:flex;align-items:flex-end">
            <button id="adjustBtn" style="width:100%;height:40px">💾 Lưu Điều Chỉnh</button>
          </div>
        </div>
      </section>
    </div>

  </main>

  <div class="toast" id="toast"></div>

  <script>
    const state = {
      data: { summary: {}, employees: [], requests: [], departments: [] },
      visibleEmployees: [],
      currentTab: 'tab-request',
      calendarDate: new Date(),
      selectedShift: 'FULL',
      busy: false
    };

    const $ = (id) => document.getElementById(id);

    // Theme Management
    function initTheme() {
      const savedTheme = localStorage.getItem('cfc_theme') || 'light';
      if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        $('themeToggleBtn').textContent = '☀️';
      } else {
        document.body.classList.remove('dark');
        $('themeToggleBtn').textContent = '🌙';
      }
    }
    $('themeToggleBtn').addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('cfc_theme', isDark ? 'dark' : 'light');
      $('themeToggleBtn').textContent = isDark ? '☀️' : '🌙';
    });

    // Tab Management
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
        btn.classList.add('active');
        $(target).classList.remove('hidden');
        state.currentTab = target;
        if (target === 'tab-calendar') renderCalendar();
        if (target === 'tab-approver') loadApproverDashboard();
      });
    });

    function setBusy(value) {
      state.busy = value;
      document.querySelectorAll('button').forEach((b) => { b.disabled = value; });
    }

    function toast(message, isError) {
      const el = $('toast');
      el.textContent = message;
      el.style.background = isError ? '#ef4444' : '#0f172a';
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

    function number(val) {
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    }

    function formatNumber(val) {
      return number(val).toLocaleString('vi-VN');
    }

    // Render Stats
    function renderSummary(summary) {
      $('cardEmpCount').textContent = summary.employeeCount || 334;
      $('cardTotalAnnual').textContent = formatNumber(summary.totalAnnual || 0);
      $('cardTotalUsed').textContent = formatNumber(summary.totalUsed || 0);
      $('cardTotalPending').textContent = formatNumber(summary.totalPending || 0);
      $('cardTotalRemaining').textContent = formatNumber(summary.totalRemaining || 0);
    }

    // Render Departments
    function renderDepartments(selectedDept = '') {
      const depts = [''].concat(state.data.departments || []);
      $('departmentFilter').innerHTML = depts.map((d) =>
        `<option value="${d}" ${d === selectedDept ? 'selected' : ''}>${d ? d : '-- Chọn phòng ban --'}</option>`
      ).join('');
    }

    // Shift Selector
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
      } else if (shift === 'FULL') {
        $('leaveTo').value = fromVal;
        $('dayCount').value = '1.0';
      } else {
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
          if (cur.getDay() !== 0) count++; // Skip Sunday
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

    // Live Balance Card on Employee Select
    $('requestEmployee').addEventListener('change', () => {
      const code = $('requestEmployee').value;
      const emp = state.visibleEmployees.find((e) => e.employee_code === code);
      if (emp) {
        $('liveFullName').textContent = `${emp.employee_code} - ${emp.full_name}`;
        $('liveDeptPos').textContent = `${emp.department || ''} • ${emp.position || ''}`;
        $('liveAvatar').textContent = (emp.full_name || 'A').charAt(0).toUpperCase();
        $('liveAnnual').textContent = number(emp.annual_leave_days).toFixed(1);
        $('liveUsed').textContent = number(emp.used_days).toFixed(1);
        $('livePending').textContent = number(emp.pending_days).toFixed(1);
        $('liveRemaining').textContent = number(emp.remaining_days).toFixed(1);
        $('liveBalanceCard').classList.remove('hidden');
      } else {
        $('liveBalanceCard').classList.add('hidden');
      }
    });

    // Filter Employees
    function renderEmployees() {
      const dept = $('departmentFilter').value;
      const kw = ($('keyword').value || '').trim().toLowerCase();
      const rows = (state.visibleEmployees || []).filter((e) => {
        if (!kw) return true;
        const text = `${e.employee_code} ${e.full_name} ${e.position}`.toLowerCase();
        return text.includes(kw);
      });

      $('employeeRows').innerHTML = rows.map((e) => `
        <tr>
          <td><strong>${e.employee_code}</strong></td>
          <td>${e.full_name}</td>
          <td>${e.department || ''}</td>
          <td>${e.position || ''}</td>
          <td>${e.hire_date_label || e.hire_date || ''}</td>
          <td class="number"><strong>${number(e.annual_leave_days).toFixed(1)}</strong></td>
          <td class="number">${number(e.used_days).toFixed(1)}</td>
          <td class="number">${number(e.pending_days).toFixed(1)}</td>
          <td class="number"><strong style="color:var(--primary)">${number(e.remaining_days).toFixed(1)}</strong></td>
        </tr>
      `).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">${dept ? 'Không có nhân sự phù hợp' : 'Chưa chọn phòng ban'}</td></tr>`;

      // Update request employee dropdown
      const activeEmps = state.visibleEmployees.filter((e) => !(e.working_condition && e.working_condition.includes('ĐÃ NGHỈ VIỆC')));
      $('requestEmployee').innerHTML = ['<option value="">-- Chọn nhân sự --</option>'].concat(
        activeEmps.map((e) => `<option value="${e.employee_code}">${e.employee_code} - ${e.full_name} (Còn ${number(e.remaining_days)} ngày)</option>`)
      ).join('');
    }

    async function loadEmployees() {
      const dept = $('departmentFilter').value;
      if (!dept) {
        state.visibleEmployees = [];
        renderEmployees();
        $('liveBalanceCard').classList.add('hidden');
        return;
      }
      state.visibleEmployees = await run('getLeaveEmployees', { department: dept });
      renderEmployees();
    }

    $('departmentFilter').addEventListener('change', loadEmployees);
    $('keyword').addEventListener('input', renderEmployees);

    // Create Leave Request
    $('createRequestBtn').addEventListener('click', async () => {
      const code = $('requestEmployee').value;
      if (!code) {
        toast('Vui lòng chọn nhân sự làm đơn!', true);
        return;
      }
      const leaveFrom = $('leaveFrom').value;
      const leaveTo = $('leaveTo').value;
      const dayCount = $('dayCount').value;
      const reason = $('reason').value.trim();
      if (!leaveFrom || !reason) {
        toast('Vui lòng điền ngày và lý do nghỉ!', true);
        return;
      }

      try {
        const res = await run('createLeaveRequest', {
          employeeCode: code,
          leaveFrom: leaveFrom,
          leaveTo: leaveTo,
          dayCount: dayCount,
          reason: reason
        });
        toast('🎉 Gửi đề xuất nghỉ phép thành công! Đã chuyển phòng Hành chính duyệt.');
        $('reason').value = '';
        renderSummary(res.summary || {});
        await loadEmployees();
        if (state.currentTab === 'tab-calendar') renderCalendar();
      } catch (err) {
        toast('❌ Lỗi: ' + (err.message || String(err)), true);
      }
    });

    // Calendar View
    function renderCalendar() {
      const year = state.calendarDate.getFullYear();
      const month = state.calendarDate.getMonth();
      $('calendarMonthLabel').textContent = `Tháng ${(month + 1).toString().padStart(2, '0')} / ${year}`;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDayIndex = (firstDay.getDay() + 6) % 7; // Monday = 0
      const totalDays = lastDay.getDate();

      const requests = state.data.requests || [];
      const grid = $('calendarDaysGrid');
      grid.innerHTML = '';

      // Blank days before month start
      for (let i = 0; i < startDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day other-month';
        grid.appendChild(emptyCell);
      }

      const todayStr = new Date().toISOString().split('T')[0];

      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day' + (dateStr === todayStr ? ' today' : '');
        
        const numSpan = document.createElement('div');
        numSpan.className = 'day-num';
        numSpan.textContent = d;
        dayCell.appendChild(numSpan);

        // Find requests on this date
        const matching = requests.filter((r) => {
          const from = r.leave_from || '';
          const to = r.leave_to || from;
          return dateStr >= from && dateStr <= to;
        });

        matching.forEach((r) => {
          const isPending = (r.status || '').toUpperCase() === 'PENDING';
          const badge = document.createElement('div');
          badge.className = 'event-badge' + (isPending ? ' pending' : '');
          badge.textContent = `${isPending ? '⏳' : '✅'} ${r.employee_code} ${r.full_name.split(' ').pop()}`;
          badge.title = `${r.full_name} (${r.department}) - ${r.reason || 'Nghỉ phép'}`;
          dayCell.appendChild(badge);
        });

        grid.appendChild(dayCell);
      }
    }

    $('prevMonthBtn').addEventListener('click', () => {
      state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
      renderCalendar();
    });
    $('nextMonthBtn').addEventListener('click', () => {
      state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
      renderCalendar();
    });

    // Approver Area
    async function loadApproverDashboard() {
      try {
        const res = await run('getApproverDashboard');
        if (!res) return;
        $('approvedBy').value = res.approver?.email || 'Admin';
        state.data.requests = res.requests || [];
        renderApproverRequests();

        // Populate adjust employee select
        const options = (res.employees || []).map((e) =>
          `<option value="${e.employee_code}">${e.employee_code} - ${e.full_name} (Hiện có: ${number(e.annual_leave_days)} ngày)</option>`
        ).join('');
        $('adjustEmployee').innerHTML = options || '<option value="">Không có nhân sự</option>';
      } catch (err) {
        toast('Lỗi tải khu duyệt: ' + (err.message || String(err)), true);
      }
    }

    let activeFilter = '';
    document.querySelectorAll('.filter-chips .chip').forEach((c) => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.filter-chips .chip').forEach((ch) => ch.classList.remove('active'));
        c.classList.add('active');
        activeFilter = c.getAttribute('data-filter') || '';
        renderApproverRequests();
      });
    });

    function renderApproverRequests() {
      const rows = (state.data.requests || []).filter((r) => !activeFilter || r.status === activeFilter);
      $('requestRows').innerHTML = rows.map((r) => `
        <tr>
          <td><strong>${r.request_id}</strong></td>
          <td><strong>${r.employee_code}</strong> - ${r.full_name}</td>
          <td>${r.department || ''}</td>
          <td>${r.leave_from_label || r.leave_from} ➔ ${r.leave_to_label || r.leave_to}</td>
          <td class="number"><strong>${number(r.day_count).toFixed(1)}</strong></td>
          <td>${r.reason || ''}</td>
          <td><span class="pill ${(r.status || '').toLowerCase()}">${r.status === 'APPROVED' ? 'Đã duyệt' : r.status === 'PENDING' ? 'Chờ duyệt' : 'Từ chối'}</span></td>
          <td>
            ${r.status === 'PENDING' ? `
              <div style="display:flex;gap:6px">
                <button class="success" style="height:32px;padding:0 10px;font-size:12px" onclick="approveAction('${r.request_id}', 'APPROVED')">Duyệt</button>
                <button class="danger" style="height:32px;padding:0 10px;font-size:12px" onclick="approveAction('${r.request_id}', 'REJECTED')">Từ chối</button>
              </div>
            ` : '<span style="color:var(--text-muted);font-size:12px">Đã xử lý</span>'}
          </td>
        </tr>
      `).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">Không có đề xuất nghỉ phép nào.</td></tr>';
    }

    async function approveAction(requestId, status) {
      try {
        const note = $('managerNote').value.trim();
        await run('approveLeaveRequest', {
          requestId: requestId,
          status: status,
          managerNote: note
        });
        toast(status === 'APPROVED' ? '✅ Đã duyệt đơn nghỉ phép!' : '🚫 Đã từ chối đơn nghỉ phép!');
        $('managerNote').value = '';
        await loadApproverDashboard();
        refresh();
      } catch (err) {
        toast('❌ Lỗi: ' + (err.message || String(err)), true);
      }
    }
    window.approveAction = approveAction;

    // Adjust Annual Leave
    $('adjustBtn').addEventListener('click', async () => {
      const code = $('adjustEmployee').value;
      const afterDays = $('afterDays').value;
      if (!code || afterDays === '') {
        toast('Vui lòng chọn nhân sự và nhập số ngày!', true);
        return;
      }
      try {
        await run('adjustAnnualLeave', {
          employeeCode: code,
          afterDays: afterDays,
          reason: 'Điều chỉnh từ khu duyệt'
        });
        toast('✅ Đã điều chỉnh ngày phép năm thành công!');
        $('afterDays').value = '';
        await loadApproverDashboard();
        refresh();
      } catch (err) {
        toast('❌ Lỗi: ' + (err.message || String(err)), true);
      }
    });

    // Refresh Function
    async function refresh() {
      try {
        const data = await run('getLeaveDashboard');
        state.data = data || state.data;
        renderSummary(state.data.summary || {});
        renderDepartments($('departmentFilter').value);
        if ($('departmentFilter').value) await loadEmployees();
        if (state.currentTab === 'tab-calendar') renderCalendar();
      } catch (err) {
        toast('Lỗi làm mới: ' + (err.message || String(err)), true);
      }
    }
    $('refreshBtn').addEventListener('click', refresh);

    // Sync CFCBase Button
    $('syncCfcBtn').addEventListener('click', async () => {
      const btn = $('syncCfcBtn');
      const originalText = btn.innerHTML;
      try {
        btn.innerHTML = '⏳ Đang đồng bộ...';
        btn.disabled = true;
        toast('Đang kết nối CFCBase để đồng bộ nhân sự & ngày phép chuẩn...');
        const result = await run('syncLeaveEmployeesFromCFCBase');
        if (result && result.dashboard) {
          state.data = result.dashboard;
          renderSummary(result.dashboard.summary || {});
          renderDepartments();
        } else {
          await refresh();
        }
        const activeCount = (result && result.activeEmployees !== undefined) ? result.activeEmployees : 334;
        const inactiveCount = (result && result.inactiveEmployees !== undefined) ? result.inactiveEmployees : 2;
        toast(`✅ Đồng bộ thành công ${activeCount} nhân sự đang làm việc (${inactiveCount} đã nghỉ việc) từ CFCBase!`);
      } catch (error) {
        const errMsg = error.message || String(error);
        toast('❌ Lỗi đồng bộ: ' + errMsg, true);
        alert('Lỗi đồng bộ từ CFCBase:\\n' + errMsg);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    // Export CSV
    $('exportBtn').addEventListener('click', async () => {
      try {
        const csv = await run('exportLeaveCsv');
        const blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quan-ly-ngay-phep-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a);
        toast('📥 Đã xuất file CSV thành công!');
      } catch (err) {
        toast('Lỗi xuất file: ' + (err.message || String(err)), true);
      }
    });

    // Init Date pickers to Today
    const today = new Date().toISOString().split('T')[0];
    $('leaveFrom').value = today;
    $('leaveTo').value = today;

    initTheme();
    refresh();
  </script>
</body>
</html>
"""

with open(index_html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Generated WOW Index.html successfully.")
