#!/usr/bin/env python3
import os
import re

appscripts_dir = "/Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep"
code_js_path = os.path.join(appscripts_dir, "Code.js")
index_html_path = os.path.join(appscripts_dir, "Index.html")

# 1. Update Code.js
with open(code_js_path, "r", encoding="utf-8") as f:
    code = f.read()

# Update createRequest to support requestedBy default and half-day leaves
old_create_req_start = "function createRequest(payload) {"
new_create_req = """function createRequest(payload) {
    ensureReady_();
    payload = payload || {};
    var employee = findEmployee_(payload.employeeCode || payload.employee_code);
    if (!employee) throw new Error('Không tìm thấy nhân sự.');
    if (employee.working_condition && String(employee.working_condition).indexOf('ĐÃ NGHỈ VIỆC') >= 0) {
      throw new Error('Nhân sự này đã nghỉ việc, không thể tạo đơn nghỉ phép.');
    }
    var dayCount = payload.dayCount || payload.day_count;
    if (dayCount === undefined || dayCount === null || dayCount === '') {
      dayCount = daysBetweenInclusive_(payload.leaveFrom, payload.leaveTo);
    }
    dayCount = number_(dayCount);
    if (dayCount <= 0) throw new Error('Số ngày nghỉ phải lớn hơn 0.');
    var request = {
      request_id: LeaveConfig.uuid('NP'),
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      department: employee.department,
      leave_from: date_(payload.leaveFrom || payload.leave_from),
      leave_to: date_(payload.leaveTo || payload.leave_to || payload.leaveFrom || payload.leave_from),
      day_count: dayCount,
      reason: payload.reason || '',
      requested_by: payload.requestedBy || payload.requested_by || employee.full_name || currentUserEmail_(),
      status: 'PENDING',
      manager_note: '',
      approved_by: '',
      approved_at: '',
      created_at: LeaveConfig.now(),
      updated_at: LeaveConfig.now()
    };"""

# Replace in Code.js
code = re.sub(r'function createRequest\(payload\)\s*\{[\s\S]*?created_at:\s*LeaveConfig\.now\(\),\s*updated_at:\s*LeaveConfig\.now\(\)\s*\};', new_create_req, code)

# Update dashboard to return requests for calendar and approver dashboard
old_dashboard_ret = "requests: [],"
new_dashboard_ret = "requests: reqs.map(decorateRequest_),"
code = code.replace(old_dashboard_ret, new_dashboard_ret, 1)

with open(code_js_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Updated Code.js successfully.")
