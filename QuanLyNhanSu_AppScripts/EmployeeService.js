/**
 * Service xử lý dữ liệu Nhân sự (336+ người)
 * Tự động kết nối Google Sheets bằng SPREADSHEET_ID khai báo ở Code.js
 */
const EmployeeService = {
  
  // Mở Google Sheet trực tiếp bằng ID của bạn (SPREADSHEET_ID được định nghĩa ở Code.js)
  getSpreadsheet: function() {
    try {
      const id = (typeof SPREADSHEET_ID !== 'undefined') ? SPREADSHEET_ID : '1MCX7FYjDlgShWEI1Kr9C6x-9hIjl8aTxwa6U-4wLhzE';
      return SpreadsheetApp.openById(id);
    } catch (e) {
      Logger.log('Không mở được bằng ID, thử getActiveSpreadsheet: ' + e.toString());
      return SpreadsheetApp.getActiveSpreadsheet();
    }
  },

  // Tự động tìm Sheet chứa dữ liệu nhân sự
  findEmployeeSheet: function() {
    const ss = this.getSpreadsheet();
    if (!ss) return null;

    const sheets = ss.getSheets();
    
    // Ưu tiên theo tên tab: Employees, hr-T6-26, Sheet1, hoặc Tab đầu tiên
    for (let name of ['Employees', 'hr-T6-26', 'Sheet1', 'Danh_Sach_Nhan_Su']) {
      let s = ss.getSheetByName(name);
      if (s) return s;
    }
    return sheets[0];
  },

  // Lấy toàn bộ danh sách 336+ nhân sự
  getAllEmployees: function() {
    try {
      const sheet = this.findEmployeeSheet();
      if (!sheet) return [];
      
      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return [];

      // Tự động tìm dòng chứa Header (tìm dòng có chữ "MÃ SỐ" hoặc "HỌ VÀ TÊN" hoặc "STT")
      let headerRowIndex = -1;
      for (let r = 0; r < Math.min(10, values.length); r++) {
        const rowStr = values[r].map(cell => String(cell).toUpperCase()).join(' ');
        if (rowStr.includes('MÃ SỐ') || rowStr.includes('HỌ VÀ TÊN') || rowStr.includes('MÃ NV')) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) headerRowIndex = 3; // Mặc định dòng 4 (index 3)

      const employees = [];
      for (let i = headerRowIndex + 1; i < values.length; i++) {
        const row = values[i];
        
        // Đọc mã số và họ tên (thường nằm ở cột 2 & 4 hoặc 0 & 1)
        let code = String(row[2] || row[0] || '').trim();
        let fullName = String(row[4] || row[1] || '').trim();

        // Bỏ qua dòng trống hoặc dòng tổng cộng
        if (!fullName || code.toUpperCase().includes('TỔNG') || fullName.toUpperCase().includes('TỔNG CỘNG')) {
          continue;
        }

        employees.push({
          id: 'EMP_' + (i + 1),
          rowIndex: i + 1,
          stt: row[0] || (employees.length + 1),
          sttDept: row[1] || '',
          code: code,
          bhxh: String(row[3] || '').trim(),
          fullName: fullName,
          bhyt: String(row[5] || '').trim(),
          salary: row[6] ? Number(row[6]) : 0,
          allowance: row[7] ? Number(row[7]) : 0,
          totalIncome: row[8] ? Number(row[8]) : 0,
          gender: String(row[9] || 'Nam').trim(),
          ethnicity: String(row[10] || 'Kinh').trim(),
          religion: String(row[11] || 'Không').trim(),
          position: String(row[12] || 'Nhân viên').trim(),
          department: String(row[13] || 'Khối Sản Xuất').trim(),
          dob: row[14] ? this.formatDate(row[14]) : '',
          joinDate: row[15] ? this.formatDate(row[15]) : '01/06/2026',
          status: row[16] ? String(row[16]).trim() : 'Đang làm việc',
          cccd: String(row[17] || row[3] || '').trim(),
          permanentAddress: String(row[18] || 'TP. Hồ Chí Minh').trim()
        });
      }
      
      return employees;
    } catch (e) {
      Logger.log('Lỗi getAllEmployees: ' + e.toString());
      return [];
    }
  },

  // Tìm kiếm nhân sự nâng cao
  searchEmployees: function(keyword, department, status) {
    const all = this.getAllEmployees();
    return all.filter(emp => {
      const matchKeyword = !keyword || 
        emp.fullName.toLowerCase().includes(keyword.toLowerCase()) || 
        emp.code.toLowerCase().includes(keyword.toLowerCase()) ||
        emp.position.toLowerCase().includes(keyword.toLowerCase());
      const matchDept = !department || emp.department === department;
      const matchStatus = !status || emp.status === status;
      return matchKeyword && matchDept && matchStatus;
    });
  },

  // Format ngày dd/MM/yyyy
  formatDate: function(dateVal) {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
      const d = dateVal.getDate().toString().padStart(2, '0');
      const m = (dateVal.getMonth() + 1).toString().padStart(2, '0');
      const y = dateVal.getFullYear();
      return `${d}/${m}/${y}`;
    }
    return String(dateVal);
  }
};
