/**
 * Hệ Thống Quản Lý Nhân Sự (Google Apps Script Backend)
 * Tự động kết nối Google Sheets, Google Docs và Google Drive.
 */

// ID File Google Sheet chuẩn của bạn
const SPREADSHEET_ID = '1MCX7FYjDlgShWEI1Kr9C6x-9hIjl8aTxwa6U-4wLhzE';

// 1. Khởi tạo Web App Router
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Hệ Thống HR - CFC People Operations')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// API: Lấy toàn bộ danh sách 336 nhân sự
function apiGetEmployees() {
  return EmployeeService.getAllEmployees();
}

// API: Tìm kiếm nhân sự theo Từ khóa / Phòng ban / Trạng thái
function apiSearchEmployees(keyword, department, status) {
  return EmployeeService.searchEmployees(keyword, department, status);
}

// API: Xuất hợp đồng thử việc từ Google Docs Template (Khớp 22 biến Java)
function apiCreateProbationContract(employeeData, docTemplateId, folderDriveId) {
  return ContractService.generateProbationContract(employeeData, docTemplateId, folderDriveId);
}

// API: Ghi nhận biến động Tăng / Giảm nhân sự
function apiLogChange(changeData) {
  return ChangeLogService.addChangeLog(changeData);
}

// API: Lấy lịch sử biến động Tăng/Giảm
function apiGetChangeLogs(month, year) {
  return ChangeLogService.getChangeLogs(month, year);
}

// API: Lấy đường dẫn xuất file Excel tháng
function apiGetMonthlyExcelExportUrl() {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
}
