#!/usr/bin/env python3
"""
Create AGENTS.md and PROJECT_MASTER_CONTEXT.md for QuanLyNgayPhep
"""

import os

TARGET_DIR = "/Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep"

AGENTS_MD_CONTENT = """# QuanLyNgayPhep Agent Instructions

Read this file before changing code in this repository.

## Active Product Scope

- `QuanLyNgayPhep` là ứng dụng Google Apps Script / AppSheet chuyên trách quản lý ngày nghỉ phép, tạo đơn đề xuất nghỉ phép, duyệt phép và tính toán số ngày phép còn lại cho Công ty Cổ phần Phân bón và Hóa chất Cần Thơ (CFC).
- Hệ thống tích hợp trực tiếp 2 chiều với **CFCBase** qua API `/api/v1/hr/sync/leave-roster`.
- Canonical master architecture and context: `PROJECT_MASTER_CONTEXT.md`.

## Source Of Truth

1. Current code and Google Sheets schema in `Code.js` are the source of truth.
2. Master Architecture & Sync Logic: `PROJECT_MASTER_CONTEXT.md`.

Start by reading:
- `PROJECT_MASTER_CONTEXT.md`

## Hard Rules

- **Không bao giờ làm mất số ngày phép đã sử dụng (`used_days`)**: Mọi thao tác đồng bộ từ CFCBase phải bảo toàn 100% lịch sử đơn từ trong `LEAVE_REQUESTS` và gọi hàm `recalculate_()`.
- **Không bao giờ xóa cứng nhân viên cũ**: Nhân viên đã nghỉ việc (giảm nhân sự) phải được chuyển sang trạng thái `ĐÃ NGHỈ VIỆC` (INACTIVE), giữ nguyên toàn bộ lịch sử đơn phép cũ để bảo toàn kiểm toán.
- **Không lưu dữ liệu nhạy cảm**: Google Sheet ngày phép tuyệt đối không lưu Lương, CCCD, CMND, BHXH, Địa chỉ cá nhân (chỉ lưu: Mã NV, Tên, Phòng ban, Chức vụ, Thâm niên, ĐKLĐ, Hạn mức phép năm, Số ngày đã nghỉ, Số ngày còn lại).
- **Tuân thủ quy chuẩn Apps Script**: Chạy `npm run build:all` và `npm run verify` sau mỗi lần sửa đổi mã nguồn.
- **Không commit secrets**: Không commit Google Service Account keys, Telegram Bot Tokens hoặc webapp deployment IDs nhạy cảm.

## Sync Checklist with CFCBase

Khi chạm vào hàm `syncFromCFCBase`:
- API URL mặc định: `https://cfcbooking.io.vn/api/v1/hr/sync/leave-roster?period=T8-26&activeOnly=false`.
- Luôn map đúng mã nhân viên (`employeeCode` -> `employee_code`).
- Cập nhật đúng `annual_leave_days` (hạn mức phép năm) từ CFCBase.
- Giữ nguyên `used_days`, `pending_days` và gọi `recalculate_(rows)`.
- Giữ lại các nhân sự cũ đã có trên Sheet nhưng không có trong đợt sync với trạng thái `ĐÃ NGHỈ VIỆC`.
- Tự động đồng bộ danh sách phòng ban sang bảng `DEPARTMENTS`.
- Ghi log đợt sync vào bảng `IMPORT_LOGS`.

## Common Commands

Build and verify bundle:

```bash
npm run build:all
npm run verify
```

Deploy via Clasp (nếu có cấu hình):

```bash
clasp push
```
"""

MASTER_CONTEXT_CONTENT = """# Tổng Hợp Hệ Thống Quản Lý Ngày Phép (QuanLyNgayPhep) Hiện Hành

> **Tài liệu nguồn chuẩn duy nhất (Single Source of Truth) cho ứng dụng Quản Lý Ngày Phép (Google Apps Script / AppSheet).**  
> Ngày cập nhật: **2026-08-20** (Production Baseline: Đồng bộ chuẩn 338 nhân sự T8-2026 từ CFCBase, Bảo toàn 100% lịch sử đơn phép).  
> Phạm vi: `Code.js`, `Index.html`, `appsscript.json`, 9 Bảng Google Sheets, Tích hợp API CFCBase, và Telegram/Email Alerts.

---

## 1. Mục Tiêu & Phạm Vi Ứng Dụng

`QuanLyNgayPhep` là hệ thống Web App chạy trên nền tảng **Google Apps Script** và **Google Sheets Database** phục vụ toàn thể cán bộ công nhân viên Công ty CFC Cần Thơ:

1. **Quản lý Nghỉ phép Không Cần Đăng nhập Rườm rà**:
   - Bất kỳ nhân viên nào trong nội bộ mở Web App đều có thể tra cứu nhanh số ngày phép còn lại của mình và phòng ban.
   - Trưởng bộ phận hoặc người được ủy quyền có thể tạo đơn xin nghỉ phép nhanh chóng.
2. **Quy trình Phê duyệt Tập trung (Approval Workflow)**:
   - Phòng Hành chính đăng nhập bằng tài khoản Google (được khai báo trong sheet `APPROVERS`) để duyệt hoặc từ chối đơn.
   - Tự động bắn Email thông báo kết quả duyệt cho Trưởng phòng tương ứng và gửi tin nhắn Telegram tới nhóm quản lý.
3. **Bảo mật Thông tin Nhân sự Cá nhân**:
   - Sheet ngày phép chỉ lưu các trường phục vụ chấm phép: Mã NV, Họ tên, Phòng ban, Chức vụ, Thâm niên, Điều kiện lao động, Hạn mức phép năm, Số phép đã nghỉ, Số phép còn lại.
   - **Tuyệt đối không lưu** các thông tin nhạy cảm như Mức lương, Phụ cấp, CCCD/CMND, BHXH, Địa chỉ nhà.
4. **Tích hợp Đồng bộ 2 Chiều với CFCBase Master**:
   - Nhận dữ liệu danh sách nhân sự chuẩn (338 người) và hạn mức phép năm từ hệ thống master **CFCBase**.
   - **Bảo toàn 100% số ngày phép đã nghỉ thực tế (`used_days`)**, không bao giờ bị mất hay reset dữ liệu khi đồng bộ lại.

---

## 2. Kiến Trúc Tổng Quan (System Architecture)

```mermaid
flowchart TB
    subgraph Client ["Giao diện Người dùng"]
        WebApp["Web App Responsive (Index.html / HtmlService)"]
        SheetsUI["Thanh Menu Google Sheets (⚡ CFC Base Sync)"]
    end

    subgraph CoreEngine ["Google Apps Script Engine (Code.js / Code.gs)"]
        LeaveService["LeaveService (Tạo đơn, Duyệt đơn, Điều chỉnh phép)"]
        SyncEngine["syncFromCFCBase (Đồng bộ nhân sự & hạn mức)"]
        CalcEngine["recalculate_ / requestTotals_ (Tính ngày phép thực tế)"]
        LeaveStore["LeaveStore (Đọc / Ghi Google Sheets tối ưu)"]
        NotifyEngine["MailApp & Telegram Notification Engine"]
    end

    subgraph Database ["Google Sheets Database (9 Bảng Dữ Liệu)"]
        LEAVE_EMPLOYEES[("LEAVE_EMPLOYEES (338 nhân sự & số phép)")]
        LEAVE_REQUESTS[("LEAVE_REQUESTS (Lịch sử đơn xin phép)")]
        LEAVE_ADJUSTMENTS[("LEAVE_ADJUSTMENTS (Lịch sử điều chỉnh)")]
        APPROVERS[("APPROVERS (Danh sách duyệt Hành chính)")]
        DEPT_CONTACTS[("DEPARTMENT_CONTACTS (Email Trưởng phòng)")]
        LOGS[("APPROVAL_LOGS & IMPORT_LOGS")]
        CONFIG[("CONFIG & TELEGRAM_CONFIG")]
    end

    subgraph MasterSystem ["Hệ thống Nguồn Master"]
        CFCBase["CFCBase Backend API (https://cfcbooking.io.vn)"]
    end

    WebApp -->|google.script.run| LeaveService
    SheetsUI -->|Trigger Menu| SyncEngine
    
    SyncEngine -->|GET /api/v1/hr/sync/leave-roster| CFCBase
    SyncEngine --> CalcEngine
    LeaveService --> CalcEngine
    
    CalcEngine --> LeaveStore
    LeaveStore --> Database
    LeaveService --> NotifyEngine
```

---

## 3. Cây Thư Mục & Vai Trò Từng File (Code Map)

```text
QuanLyNgayPhep/
├── AGENTS.md                               # Chỉ dẫn AI: Quy tắc bảo toàn ngày phép, checklist đồng bộ
├── PROJECT_MASTER_CONTEXT.md               # File Master Context duy nhất này
├── README_HUONG_DAN.md                     # Hướng dẫn sử dụng cho người vận hành
├── appsscript.json                         # Manifest cấu hình Apps Script (Timezone Asia/Ho_Chi_Minh)
├── Code.js                                 # [MÃ NGUỒN CHÍNH] Chứa toàn bộ Business Logic, Store, Sync, API
├── Index.html                              # [GIAO DIỆN WEB APP] Single Page App (HtmlService), tra cứu & tạo đơn
├── package.json / package-lock.json        # Cấu hình script build & verify
│
├── dist/                                   # [BẢN BUILD CLASP]
│   ├── appsscript.json
│   ├── Code.js
│   └── Index.html
│
├── output/                                 # File mẫu bảng tính khởi tạo
│   └── QuanLyNgayPhep_Template.xlsx        # Template Excel chứa 9 sheets chuẩn hóa
│
└── scripts/                                # [TIỆN ÍCH BUILD & VERIFY]
    ├── build-all.mjs                       # Kiểm tra cú pháp và đóng gói vào dist/
    ├── verify-dist.mjs                     # Kiểm tra tính toàn vẹn của bundle
    ├── make_leave_workbook.py              # Script Python sinh workbook mẫu
    └── upgrade_leave_template.py           # Script nâng cấp công thức bảng tính
```

---

## 4. Từ Điển Dữ Liệu (9 Bảng Trên Google Sheets)

### 4.1 Bảng Nhân sự & Ngày phép: `LEAVE_EMPLOYEES` (Bảng chính)
| Cột | Ý nghĩa | Ví dụ | Quyền cập nhật |
|---|---|---|---|
| `employee_code` | Mã nhân viên duy nhất (Khóa chính) | `A268`, `A035`, `C690` | CFCBase Sync |
| `full_name` | Họ và tên nhân viên | `Nguyễn Công Huân` | CFCBase Sync |
| `department` | Phòng ban công tác | `Tổng Giám đốc`, `Phòng Kỹ thuật` | CFCBase Sync |
| `position` | Chức vụ công tác | `Tổng Giám đốc`, `Kỹ sư` | CFCBase Sync |
| `hire_date` | Ngày vào làm chính thức | `2018-05-02` | CFCBase Sync |
| `working_condition` | Điều kiện lao động / Trạng thái | `Bình Thường` / `ĐÃ NGHỈ VIỆC` | CFCBase Sync |
| `service_years` | Chuỗi thâm niên làm việc | `8 NĂM 3 THÁNG 18 NGÀY` | CFCBase Sync |
| `annual_leave_days` | **Tổng hạn mức phép năm được hưởng** | `12`, `14`, `15`... | CFCBase Sync / Điều chỉnh |
| `used_days` | **Tổng số ngày phép ĐÃ NGHỈ** | `2.5`, `4.0` | **Tự động tính từ đơn đã duyệt** |
| `pending_days` | Số ngày phép đang chờ duyệt | `1.0` | **Tự động tính từ đơn pending** |
| `remaining_days` | **Số ngày phép CÒN LẠI** | `= annual_leave_days - used_days` | **Công thức tự động** |
| `period` | Kỳ danh sách nhân sự | `T8-26` | CFCBase Sync |
| `source_sheet` | Nguồn dữ liệu | `CFCBase-API` | Hệ thống |
| `updated_at` | Thời gian cập nhật cuối cùng | `2026-08-20 07:49:30` | Hệ thống |

### 4.2 Bảng Đơn xin nghỉ phép: `LEAVE_REQUESTS`
| Cột | Ý nghĩa | Trạng thái |
|---|---|---|
| `request_id` | Mã đơn duy nhất (`REQ-...`) | |
| `employee_code` | Mã nhân viên xin nghỉ | Khóa ngoại |
| `full_name` | Tên nhân viên xin nghỉ | |
| `department` | Phòng ban | |
| `leave_from` / `leave_to` | Thời gian nghỉ từ ngày $\rightarrow$ đến ngày | |
| `day_count` | Số ngày nghỉ phép (0.5, 1, 2...) | |
| `reason` | Lý do nghỉ việc riêng / việc gia đình | |
| `requested_by` | Người tạo đơn | |
| `status` | **Trạng thái đơn** | `PENDING`, `APPROVED`, `REJECTED` |
| `manager_note` | Ghi chú của người duyệt | |
| `approved_by` / `approved_at` | Email người duyệt & Thời gian duyệt | |

### 4.3 Các bảng cấu hình & phân quyền:
- **`APPROVERS`**: Danh sách email cán bộ Phòng Hành chính có quyền duyệt đơn (`email`, `name`, `active`, `note`).
- **`DEPARTMENT_CONTACTS`**: Email Trưởng phòng từng bộ phận nhận thông báo khi có đơn được duyệt (`department`, `head_name`, `email`, `cc_email`, `active`).
- **`LEAVE_ADJUSTMENTS`**: Lưu lịch sử mỗi lần Hành chính điều chỉnh tăng/giảm hạn mức phép năm của nhân viên.
- **`IMPORT_LOGS`**: Lưu lịch sử mỗi lần bấm đồng bộ từ CFCBase (số dòng active, số dòng inactive, thời gian).
- **`CONFIG`**: Cấu hình URL CFCBase (`CFC_BASE_API_URL`), Kỳ mặc định (`T8-26`), Năm hiện tại (`2026`).
- **`TELEGRAM_CONFIG`**: Lưu Bot Token và Chat ID để gửi thông báo duyệt phép tức thời.

---

## 5. Nghiệp Vụ Tính Toán Ngày Phép & Duyệt Đơn

### 5.1 Thuật toán Tính Phép Chuẩn Xác (`recalculate_`)
Hệ thống **không tính nhẩm hay lưu số tĩnh**, mà luôn tính động theo nguyên tắc dòng tiền:

1. Quét toàn bộ bảng `LEAVE_REQUESTS`:
   - Lọc tất cả các đơn của nhân viên có `status === 'APPROVED'` $\rightarrow$ Cộng tổng thành **`used_days`**.
   - Lọc tất cả các đơn có `status === 'PENDING'` $\rightarrow$ Cộng tổng thành **`pending_days`**.
2. Cập nhật vào bảng `LEAVE_EMPLOYEES`:
   $$\text{Remaining Days} = \text{Annual Leave Days} - \text{Used Days}$$

### 5.2 Luồng Duyệt Đơn & Bắn Thông Báo
```text
Nhân viên / Trưởng phòng nộp đơn trên Web App
→ Tạo bản ghi trong LEAVE_REQUESTS (status = PENDING)
→ Số ngày pending_days của nhân viên tự động tăng lên
→ Phòng Hành chính mở Web App (nhận diện qua Google Email trong APPROVERS)
→ Bấm "Duyệt" (approveRequest) hoặc "Từ chối" (rejectRequest)
→ Cập nhật status = APPROVED / REJECTED
→ Gọi recalculate_(): used_days tăng lên, remaining_days giảm đi
→ Gửi Email xác nhận cho Trưởng phòng (qua MailApp theo DEPARTMENT_CONTACTS)
→ Bắn thông báo Telegram tới nhóm quản lý
```

---

## 6. Cơ Chế Đồng Bộ 2 Chiều với CFCBase Master

### 6.1 Endpoint Tích Hợp
`GET https://cfcbooking.io.vn/api/v1/hr/sync/leave-roster?period=T8-26&activeOnly=false`

### 6.2 Ma trận Phân định Quyền Sở Hữu Dữ Liệu (Không Xung Đột)
| Trường dữ liệu | Bên làm chủ (Master) | Quy tắc đồng bộ |
|---|---|---|
| **Mã NV, Họ Tên, Phòng ban, Chức vụ, Thâm niên** | **CFCBase** | Cập nhật mới nhất từ CFCBase sang Sheet. |
| **Tổng hạn mức phép năm (`annual_leave_days`)** | **CFCBase** | Cập nhật số ngày được hưởng gốc (12, 14, 15...). |
| **Số ngày phép ĐÃ NGHỈ (`used_days`)** | **App Ngày Phép** | **BẢO TOÀN 100%**, CFCBase không được reset về 0. |
| **Số ngày phép CÒN LẠI (`remaining_days`)** | **App Ngày Phép** | Tự động tính toán lại sau khi sync: `annual_leave_days - used_days`. |
| **Nhân sự đã thôi việc (`INACTIVE`)** | **CFCBase** | Chuyển thành `ĐÃ NGHỈ VIỆC`, **TUYỆT ĐỐI KHÔNG XÓA DÒNG** trên Sheet để bảo toàn lịch sử đơn phép cũ. |

### 6.3 Thuật toán Xử lý trong `syncFromCFCBase`
```javascript
function syncFromCFCBase(options) {
  // 1. Gọi API lấy 338 nhân sự từ CFCBase
  var response = UrlFetchApp.fetch(apiUrl);
  var items = JSON.parse(response.getContentText()).data;

  // 2. Map nhân sự active và inactive từ API
  items.forEach(function (item) {
    var existing = existingMap[item.employeeCode];
    rows.push({
      employee_code: item.employeeCode,
      full_name: item.fullName,
      department: item.department,
      position: item.position,
      hire_date: item.hireDate,
      working_condition: item.employmentStatus === 'ACTIVE' ? item.workingCondition : 'ĐÃ NGHỈ VIỆC',
      service_years: item.serviceYears,
      annual_leave_days: item.annualLeaveDays,
      used_days: existing ? existing.used_days : 0, // Giữ nguyên số ngày đã nghỉ
      pending_days: existing ? existing.pending_days : 0
    });
  });

  // 3. Giữ lại nhân sự cũ trên Sheet không nằm trong đợt sync (chuyển ĐÃ NGHỈ VIỆC)
  existingEmployees.forEach(function (emp) {
    if (!syncedCodes[emp.employee_code]) {
      emp.working_condition = 'ĐÃ NGHỈ VIỆC';
      rows.push(emp);
    }
  });

  // 4. Quét toàn bộ LEAVE_REQUESTS để tính lại used_days và remaining_days chuẩn 100%
  var recalculated = recalculate_(rows);
  LeaveStore.replaceAll(LeaveConfig.TABLES.EMPLOYEES, recalculated);
}
```

---

## 7. Hướng Dẫn Vận Hành & Triển Khai (Deployment)

### 7.1 Cách Triển khai Lên Google Sheets & Apps Script:
1. Tạo một Google Sheet mới trên Google Drive.
2. Mở `Extensions` $\rightarrow$ `Apps Script`.
3. Copy toàn bộ mã nguồn trong [`Code.js`](file:///Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep/Code.js) vào `Code.gs`.
4. Tạo file HTML tên `Index`, copy nội dung [`Index.html`](file:///Users/hyden/Documents/David-nguyen/AppScriptsCFC/QuanLyNgayPhep/Index.html) vào.
5. Kiểm tra `Project Settings` $\rightarrow$ Timezone là `Asia/Ho_Chi_Minh` (GMT+7).
6. Chọn hàm `setupLeaveWorkbook` và bấm **Run** để khởi tạo 9 bảng chuẩn hóa.
7. Bấm **Deploy** $\rightarrow$ **New deployment** $\rightarrow$ Chọn loại **Web app**:
   - **Execute as**: `User accessing the web app`
   - **Who has access**: `Anyone with Google account` (hoặc nội bộ tổ chức).

### 7.2 Cách Đồng bộ Dữ liệu từ CFCBase:
- Trên thanh menu Google Sheet, chọn:
  👉 **`⚡ CFC Base Sync`** $\rightarrow$ **`🔄 Đồng bộ Nhân sự & Ngày phép chuẩn (CFCBase)`**
- Hoặc mở Web App và bấm nút đồng bộ ở góc trên cùng bên phải.

---

## 8. Xử Lý Sự Cố & Câu Hỏi Thường Gặp (Troubleshooting)

1. **Lỗi "Không thể kết nối CFCBase API"**:
   - Kiểm tra xem Cloudflare Tunnel `cfcbooking.io.vn` hoặc VPS CFCBase có đang hoạt động không.
   - Kiểm tra cấu hình `CFC_BASE_API_URL` trong sheet `CONFIG`.
2. **Tại sao nhân viên đã nghỉ việc vẫn còn trên Sheet?**:
   - Đây là thiết kế chủ động để bảo toàn lịch sử các đơn xin phép họ đã nộp trong năm. Trạng thái của họ được ghi rõ `ĐÃ NGHỈ VIỆC` và Web App sẽ tự động khóa không cho tạo đơn mới.
3. **Số ngày phép còn lại bị sai lệch**:
   - Chỉ cần chạy hàm `refreshBalances_()` trong Apps Script hoặc bấm Đồng bộ lại từ CFCBase, hệ thống sẽ tự động quét lại toàn bộ đơn trong `LEAVE_REQUESTS` và cập nhật lại số ngày phép chính xác từng 0.1 ngày.

---

## 9. Quy Tắc Bất Biến Dành Cho AI Developers

1. **Không bao giờ xóa `used_days`**: Mọi thuật toán cập nhật hay đồng bộ không bao giờ được phép gán `used_days = 0` nếu nhân viên đã có lịch sử đơn.
2. **Không bao giờ xóa cứng dòng nhân viên cũ**: Mọi nhân viên nghỉ việc chỉ được đổi trạng thái sang `ĐÃ NGHỈ VIỆC`.
3. **Luôn chạy kiểm tra trước khi bàn giao**:
   ```bash
   npm run build:all && npm run verify
   ```
4. **Không đưa dữ liệu lương / bảo hiểm lên Apps Script**: Bảo vệ quyền riêng tư dữ liệu cá nhân theo quy chế công ty.
"""

def main():
    print(f"🚀 Đang tạo tài liệu AGENTS.md và PROJECT_MASTER_CONTEXT.md cho {TARGET_DIR}...")
    
    agents_path = os.path.join(TARGET_DIR, "AGENTS.md")
    with open(agents_path, "w", encoding="utf-8") as f:
        f.write(AGENTS_MD_CONTENT)
    print(f"✅ Đã tạo {agents_path}")

    master_path = os.path.join(TARGET_DIR, "PROJECT_MASTER_CONTEXT.md")
    with open(master_path, "w", encoding="utf-8") as f:
        f.write(MASTER_CONTEXT_CONTENT)
    print(f"✅ Đã tạo {master_path}")

    print("🎉 Hoàn tất tạo tài liệu chuẩn mực cho QuanLyNgayPhep!")

if __name__ == "__main__":
    main()
