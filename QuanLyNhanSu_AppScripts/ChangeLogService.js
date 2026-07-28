/**
 * Service quản lý Tăng / Giảm nhân sự và biến động hàng tháng
 */
const ChangeLogService = {

  addChangeLog: function(data) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName('Changes_Log');
      
      // Nếu chưa có Tab Changes_Log thì tạo tự động
      if (!sheet) {
        sheet = ss.insertSheet('Changes_Log');
        sheet.appendRow(['Thời gian ghi nhận', 'Mã NV', 'Họ và tên', 'Loại biến động', 'Tháng/Năm hiệu lực', 'Phòng ban', 'Chức vụ', 'Lý do']);
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#E2EFDA');
      }

      const nowStr = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
      sheet.appendRow([
        nowStr,
        data.code || '',
        data.fullName || '',
        data.type || 'Tuyển mới', // 'Tuyển mới', 'Thôi việc', 'Tăng lương', 'Đổi vị trí'
        data.effectiveMonth || '',
        data.department || '',
        data.position || '',
        data.reason || ''
      ]);

      return { success: true, message: 'Đã ghi nhận biến động nhân sự thành công!' };
    } catch (e) {
      return { success: false, message: 'Lỗi ghi nhận biến động: ' + e.message };
    }
  },

  getChangeLogs: function(month, year) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('Changes_Log');
      if (!sheet) return [];

      const values = sheet.getDataRange().getValues();
      if (values.length < 2) return [];

      const logs = [];
      for (let i = 1; i < values.length; i++) {
        const r = values[i];
        logs.push({
          timestamp: r[0],
          code: r[1],
          fullName: r[2],
          type: r[3],
          effectiveMonth: r[4],
          department: r[5],
          position: r[6],
          reason: r[7]
        });
      }
      return logs;
    } catch (e) {
      return [];
    }
  }
};
