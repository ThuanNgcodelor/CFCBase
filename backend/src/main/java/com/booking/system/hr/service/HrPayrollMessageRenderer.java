package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.entity.HrPayrollImportRow;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.Locale;
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
                + "\n────────────────────"
                + "\n\nTHÔNG TIN NHÂN VIÊN"
                + "\n" + line("Họ và tên", row.getEmployeeName())
                + "\n" + line("Mã nhân viên", row.getEmployeeCode())
                + "\n" + line("Số tài khoản", text(value, "stk"))
                + "\n\nCHI TIẾT LƯƠNG"
                + "\n" + line("Số công", text(value, "cong"))
                + "\n" + line("Tiền lương", money(value, "tienLuong") + " đ")
                + "\n\nKHOẢN THU TRONG LƯƠNG"
                + "\n" + line("Tổng khoản thu", money(value, "tongThu") + " đ")
                + "\n" + line("BHXH 10,5%", money(value, "bhxh") + " đ")
                + "\n" + line("B giặt", money(value, "baoGiat") + " đ")
                + "\n" + line("HTKK", money(value, "htkk") + " đ")
                + "\n" + line("Đảng phí", money(value, "thuDangPhi") + " đ")
                + "\n" + line("Đoàn phí", money(value, "doanPhi") + " đ")
                + "\n" + line("Thuế TNCN", money(value, "ttn") + " đ")
                + "\n" + line("ASXH", money(value, "asxh") + " đ")
                + "\n" + line("XHHC", money(value, "xhhc") + " đ")
                + "\n\nTHỰC NHẬN (CHUYỂN KHOẢN)\n" + money(value, "nganHangChuyen") + " đ"
                + "\n\nNếu có thắc mắc về phiếu lương, vui lòng liên hệ phòng Kế toán.";
    }

    private static String line(String label, String value) {
        return String.format(Locale.ROOT, "%-16s: %s", label, value == null ? "" : value);
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
