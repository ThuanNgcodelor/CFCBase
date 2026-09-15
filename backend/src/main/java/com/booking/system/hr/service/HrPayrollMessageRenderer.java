package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.entity.HrPayrollImportRow;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.Map;

public final class HrPayrollMessageRenderer {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private HrPayrollMessageRenderer() { }

    public static String render(HrPayrollImportRow row, String payrollMonth) {
        Map<String, Object> value;
        try {
            value = MAPPER.readValue(row.getPayloadJson(), new TypeReference<>() { });
        } catch (Exception exception) {
            throw HrApiException.badRequest("PAYROLL_PAYLOAD_INVALID", "Không đọc được dữ liệu lương của " + row.getEmployeeCode());
        }
        return "PHIẾU LƯƠNG THÁNG " + payrollMonth
                + "\n\nKính gửi anh/chị: " + row.getEmployeeName()
                + "\nMã NV: " + row.getEmployeeCode()
                + "\nSố tài khoản: " + text(value, "stk")
                + "\n\nCHI TIẾT LƯƠNG\nSố công: " + text(value, "cong")
                + "\nTiền lương: " + money(value, "tienLuong") + " đ"
                + "\n\nKHẤU TRỪ / ĐÓNG GÓP\nTổng khấu trừ: " + money(value, "tongThu") + " đ"
                + "\nBHXH 10,5%: " + money(value, "bhxh") + " đ"
                + "\nB giặt: " + money(value, "baoGiat") + " đ"
                + "\nHTKK: " + money(value, "htkk") + " đ"
                + "\nĐảng phí: " + money(value, "thuDangPhi") + " đ"
                + "\nĐoàn phí: " + money(value, "doanPhi") + " đ"
                + "\nThuế TNCN: " + money(value, "ttn") + " đ"
                + "\nASXH: " + money(value, "asxh") + " đ"
                + "\nXHHC: " + money(value, "xhhc") + " đ"
                + "\n\nTHỰC NHẬN (CHUYỂN KHOẢN)\n" + money(value, "nganHangChuyen") + " đ"
                + "\n\nNếu có thắc mắc về phiếu lương, vui lòng liên hệ phòng Kế toán.";
    }

    private static String text(Map<String, Object> value, String key) {
        return value.getOrDefault(key, "").toString();
    }

    private static String money(Map<String, Object> value, String key) {
        try {
            return new BigDecimal(value.getOrDefault(key, 0).toString())
                    .setScale(0, java.math.RoundingMode.HALF_UP).toPlainString()
                    .replaceAll("\\B(?=(\\d{3})+(?!\\d))", ".");
        } catch (Exception ignored) {
            return "0";
        }
    }
}
