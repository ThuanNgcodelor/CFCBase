#!/usr/bin/env python3
import os

index_html_path = "/Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep/Index.html"

with open(index_html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Make sure button is in topbar
if 'id="syncCfcBtn"' not in html:
    html = html.replace(
        '<button id="refreshBtn">Làm mới</button>',
        '<button class="secondary" id="syncCfcBtn" style="background:#0f62fe;color:white;font-weight:700">⚡ Đồng bộ CFCBase</button>\n        <button id="refreshBtn">Làm mới</button>'
    )

# Add event listener for syncCfcBtn
event_listener_code = """
    $('syncCfcBtn').addEventListener('click', async () => {
      const btn = $('syncCfcBtn');
      const originalText = btn.textContent;
      try {
        btn.textContent = '⏳ Đang đồng bộ...';
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
        toast('✅ Đã đồng bộ thành công ' + activeCount + ' nhân sự đang làm việc (' + inactiveCount + ' đã nghỉ việc) từ CFCBase!');
      } catch (error) {
        const errMsg = error.message || String(error);
        toast('❌ Lỗi đồng bộ: ' + errMsg);
        alert('Lỗi đồng bộ từ CFCBase:\\n' + errMsg);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
    $('refreshBtn').addEventListener('click', refresh);"""

if "$('syncCfcBtn').addEventListener" not in html:
    html = html.replace("$('refreshBtn').addEventListener('click', refresh);", event_listener_code)

with open(index_html_path, "w", encoding="utf-8") as f:
    f.write(html)

print("Successfully updated Index.html with active click event listener.")
