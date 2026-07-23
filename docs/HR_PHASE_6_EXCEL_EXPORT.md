# HR Phase 6 — Export Excel

Cập nhật: 2026-07-23

Trạng thái: **hoàn thành ở source code và automated test; chưa deploy/restart production, chưa UAT trên database đang chạy**

## Phạm vi

Phase 6 bổ sung export Excel tại `Quản lý nhân sự -> Danh sách tháng` (`/manager/hr/rosters`).

Exporter hiện ưu tiên dùng file mẫu sạch nằm trong backend resource:

```text
backend/src/main/resources/hr/templates/workforce-export-template.xlsx
```

File này được đóng gói theo JAR production, đã xóa dữ liệu nhân sự thật nhưng vẫn giữ style/độ rộng cột/header/màu sắc từ file baseline. Khi export, backend chỉ thay dữ liệu vào các sheet.

Khi chạy dev nếu resource bị thiếu, service vẫn fallback đọc file local `docs/hr-template/workforce-baseline-339-2026.xlsx`.

Có hai chế độ:

- Export theo năm: tạo workbook có 14 sheet.
- Export theo tháng: tạo workbook có 3 sheet.

## Cấu trúc file

### Export theo năm

Tên file dạng:

```text
hr-nam-2026.xlsx
```

Workbook có đủ 14 sheet theo thứ tự:

```text
TĂNG
GIẢM
T1-26
T2-26
T3-26
T4-26
T5-26
T6-26
T7-26
T8-26
T9-26
T10-26
T11-26
T12-26
```

Sheet tháng chưa có roster vẫn được tạo với header để giữ đúng cấu trúc năm.

### Export theo tháng

Tên file dạng:

```text
hr-T6-26.xlsx
```

Workbook có 3 sheet:

```text
TĂNG
GIẢM
T6-26
```

`TĂNG` và `GIẢM` chỉ lấy movement đã `CONFIRMED` trong tháng export. Sheet tháng lấy snapshot roster đúng kỳ nếu đã tồn tại; nếu chưa có roster, sheet vẫn có header/formatted rows theo template.

## Dữ liệu xuất

Sheet `TĂNG`/`GIẢM` giữ layout file mẫu:

- STT, mã nhân sự, họ tên.
- Loại biến động và ngày hiệu lực.
- Phòng ban/chức vụ/điều kiện lao động trước-sau.
- Lý do, số quyết định, ngày quyết định.
- Người xác nhận và thời gian xác nhận.

Sheet tháng giữ đủ 34 cột từ file mẫu:

- STT, STT bộ phận, mã nhân sự, họ tên.
- Phòng ban, chức vụ, điều kiện lao động.
- Trạng thái, ngày vào làm, ngày nghỉ việc.
- Ngày phép và lý do vào danh sách.

Snapshot tháng xuất thêm các thông tin đang có trong hệ thống: BHXH/BHYT, CCCD/CMND, địa chỉ, điện thoại, lương/phụ cấp/tổng thu nhập, tuổi, năm công tác và ngày nghỉ phép.

## API

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `/api/v1/hr/exports/year?year=2026` | Export workbook 14 sheet cho cả năm |
| `GET` | `/api/v1/hr/exports/month?year=2026&month=6` | Export workbook 3 sheet cho một tháng |

Mọi API nằm dưới `/api/v1/hr/**`, nên vẫn chỉ `MANAGER` đang `ACTIVE` được gọi.

## UI

Tại `/manager/hr/rosters`:

- Header có ô nhập năm và nút `Export năm`.
- Mỗi card roster có nút `Export tháng`.
- Bấm vào card vẫn mở chi tiết roster; bấm export chỉ tải file, không mở detail.

## Verification

- `HrExcelExportServiceTest`: khóa số sheet export năm/tháng.
- `HrActivityControllerTest`: khóa response attachment XLSX.
- Frontend lint/build xác nhận route `/manager/hr/rosters` compile và PWA build ổn.
