#!/usr/bin/env python3
"""
Update Code.js in QuanLyNgayPhep to ensure:
1. When syncing from CFCBase, existing employees who have leave history but are not in the active batch are preserved with status ĐÃ NGHỈ VIỆC.
2. All approved requests from LEAVE_REQUESTS are used to calculate used_days, preserving used leave days 100%.
3. Remaining days are calculated as (annual_leave_days - used_days) without ever losing leave history.
4. Auto-sync and manual sync work flawlessly.
"""

CODE_PATH = "/Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep/Code.js"

with open(CODE_PATH, "r", encoding="utf-8") as f:
    code = f.read()

# Let's inspect the syncFromCFCBase function in Code.js
new_sync_function = """  function syncFromCFCBase(options) {
    options = options || {};
    var configRows = LeaveStore.all(LeaveConfig.TABLES.CONFIG);
    var configMap = {};
    configRows.forEach(function (r) {
      if (r.key) configMap[String(r.key).trim()] = String(r.value || '').trim();
    });

    var baseUrl = options.baseUrl || configMap['CFC_BASE_API_URL'] || 'https://cfcbooking.io.vn';
    var period = options.period || configMap['PERIOD'] || configMap['DEFAULT_MONTH_SHEET'] || 'T8-26';
    var apiUrl = baseUrl.replace(/\\/+$/, '') + '/api/v1/hr/sync/leave-roster?period=' + encodeURIComponent(period);

    var response = UrlFetchApp.fetch(apiUrl, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Không thể kết nối CFCBase API (' + response.getResponseCode() + '): ' + response.getContentText());
    }

    var json = JSON.parse(response.getContentText());
    var items = (json && json.data) ? json.data : [];
    if (!items || items.length === 0) {
      throw new Error('CFCBase không trả về dữ liệu nhân sự cho kỳ: ' + period);
    }

    var existingEmployees = LeaveStore.all(LeaveConfig.TABLES.EMPLOYEES);
    var existingMap = {};
    existingEmployees.forEach(function (emp) {
      if (emp.employee_code) {
        existingMap[String(emp.employee_code).trim()] = emp;
      }
    });

    var rows = [];
    var departments = {};
    var syncedCodes = {};
    var activeCount = 0;
    var inactiveCount = 0;

    // 1. Đồng bộ các nhân sự từ API CFCBase
    items.forEach(function (item) {
      var code = String(item.employeeCode || '').trim();
      var name = String(item.fullName || '').trim();
      if (!code || !name) return;

      syncedCodes[code] = true;
      var dept = String(item.department || '').trim();
      if (dept) departments[dept] = true;

      var isActive = String(item.employmentStatus || '').toUpperCase() === 'ACTIVE';
      if (isActive) {
        activeCount++;
      } else {
        inactiveCount++;
      }

      var annualLeave = number_(item.annualLeaveDays);
      var existing = existingMap[code];
      var workCondition = isActive 
        ? (String(item.workingCondition || '').trim() || 'Bình Thường')
        : ('ĐÃ NGHỈ VIỆC' + (item.resignationDate ? ' (' + item.resignationDate + ')' : ''));

      rows.push({
        employee_code: code,
        full_name: name,
        department: dept || (existing ? existing.department : ''),
        position: String(item.position || '').trim() || (existing ? existing.position : ''),
        hire_date: item.hireDate ? String(item.hireDate).trim() : (existing ? existing.hire_date : ''),
        working_condition: workCondition,
        service_years: String(item.serviceYears || '').trim() || (existing ? existing.service_years : ''),
        annual_leave_days: annualLeave > 0 ? annualLeave : (existing ? number_(existing.annual_leave_days) : 12),
        used_days: existing ? number_(existing.used_days) : 0,
        pending_days: existing ? number_(existing.pending_days) : 0,
        remaining_days: existing ? Math.max(0, (annualLeave > 0 ? annualLeave : number_(existing.annual_leave_days)) - number_(existing.used_days)) : annualLeave,
        period: period,
        source_sheet: 'CFCBase-API',
        updated_at: LeaveConfig.now()
      });
    });

    // 2. Bảo toàn các nhân sự cũ đã có trên Sheet nhưng không nằm trong danh sách trả về (chuyển sang ĐÃ NGHỈ VIỆC)
    existingEmployees.forEach(function (emp) {
      var code = String(emp.employee_code || '').trim();
      if (!code || syncedCodes[code]) return;

      var cond = String(emp.working_condition || '');
      if (cond.indexOf('ĐÃ NGHỈ VIỆC') === -1) {
        cond = 'ĐÃ NGHỈ VIỆC';
      }
      if (emp.department) departments[emp.department] = true;
      inactiveCount++;

      rows.push({
        employee_code: code,
        full_name: emp.full_name,
        department: emp.department,
        position: emp.position,
        hire_date: emp.hire_date,
        working_condition: cond,
        service_years: emp.service_years,
        annual_leave_days: number_(emp.annual_leave_days),
        used_days: number_(emp.used_days),
        pending_days: number_(emp.pending_days),
        remaining_days: number_(emp.remaining_days),
        period: emp.period || period,
        source_sheet: emp.source_sheet || 'CFCBase-API',
        updated_at: LeaveConfig.now()
      });
    });

    // 3. Tự động tính toán lại used_days và remaining_days dựa trên lịch sử đơn thực tế trong LEAVE_REQUESTS
    var recalculatedRows = recalculate_(rows);
    LeaveStore.replaceAll(LeaveConfig.TABLES.EMPLOYEES, recalculatedRows);

    // 4. Đồng bộ danh mục phòng ban
    LeaveStore.replaceAll(LeaveConfig.TABLES.DEPARTMENTS, Object.keys(departments).sort().map(function (department) {
      return { department: department, head_name: '', note: '', updated_at: LeaveConfig.now() };
    }));
    syncDepartmentContacts_();

    // 5. Ghi nhật ký đồng bộ
    LeaveStore.append(LeaveConfig.TABLES.IMPORT_LOGS, {
      import_id: LeaveConfig.uuid('SYNC'),
      source_sheet: 'CFCBase API (' + period + ')',
      period: period,
      imported_rows: recalculatedRows.length,
      imported_by: options.importedBy || 'CFCBase Auto Sync',
      created_at: LeaveConfig.now(),
      note: 'Đồng bộ tự động thành công: ' + activeCount + ' nhân sự đang làm việc (hạn mức phép chuẩn CFCBase), ' + inactiveCount + ' nhân sự đã nghỉ việc (bảo toàn lịch sử ngày phép).'
    });

    return {
      ok: true,
      period: period,
      totalSynced: recalculatedRows.length,
      activeEmployees: activeCount,
      inactiveEmployees: inactiveCount,
      dashboard: dashboard()
    };
  }"""

import re
# Replace the syncFromCFCBase function in Code.js
code_updated = re.sub(
    r"function syncFromCFCBase\(options\) \{[\s\S]*?\n  \}\n\n  function importMonthlyRoster",
    new_sync_function + "\n\n  function importMonthlyRoster",
    code
)

with open(CODE_PATH, "w", encoding="utf-8") as f:
    f.write(code_updated)

print("✅ Đã cập nhật syncFromCFCBase trong Code.js thành công!")
