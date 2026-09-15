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

    /**
     * Telegram shows this snapshot above the attached PDF. The fixed-width
     * layout is intentional: HR can scan the figures directly in the chat.
     */
    public static String officialCaption(HrPayrollImportRow row, String payrollMonth) {
        return render(row, payrollMonth);
    }

    public static String testCaption(HrPayrollImportRow row, String payrollMonth) {
        return "⚠️ BẢN GỬI THỬ - KHÔNG PHẢI PHIẾU LƯƠNG CHÍNH THỨC"
                + "\nDữ liệu nguồn: " + safe(row.getEmployeeCode()) + " - " + safe(row.getEmployeeName())
                + "\n\n" + render(row, payrollMonth);
    }

    /** Kept for old callers and old snapshots. New delivery uses the PDF renderer. */
    public static String render(HrPayrollImportRow row, String payrollMonth) {
        Map<String, Object> value;
        try {
            value = MAPPER.readValue(row.getPayloadJson(), new TypeReference<>() { });
        } catch (Exception exception) {
            throw HrApiException.badRequest("PAYROLL_PAYLOAD_INVALID", "Không đọc được dữ liệu lương của " + row.getEmployeeCode());
        }
        return "PHIẾU LƯƠNG THÁNG " + displayMonth(payrollMonth)
                + "\n────────────────────"
                + "\n\nTHÔNG TIN NHÂN VIÊN"
                + "\n" + line("Họ và tên", row.getEmployeeName())
                + "\n" + line("Mã nhân viên", row.getEmployeeCode())
                + "\n" + line("Số tài khoản", text(value, "stk"))
                + "\n\nCHI TIẾT LƯƠNG"
                + "\n" + quantityLine("Số công", text(value, "cong"))
                + "\n" + moneyLine("Tiền lương", money(value, "tienLuong"))
                + "\n\nKHOẢN THU TRONG LƯƠNG"
                + "\n" + moneyLine("Tổng khoản thu", money(value, "tongThu"))
                + "\n" + moneyLine("BHXH 10,5%", money(value, "bhxh"))
                + "\n" + moneyLine("B giặt", money(value, "baoGiat"))
                + "\n" + moneyLine("HTKK", money(value, "htkk"))
                + "\n" + moneyLine("Đảng phí", money(value, "thuDangPhi"))
                + "\n" + moneyLine("Đoàn phí", money(value, "doanPhi"))
                + "\n" + moneyLine("Thuế TNCN", money(value, "ttn"))
                + "\n" + moneyLine("ASXH", money(value, "asxh"))
                + "\n" + moneyLine("XHHC", money(value, "xhhc"))
                + "\n\nTHỰC NHẬN (CHUYỂN KHOẢN)\n" + money(value, "nganHangChuyen") + " đ"
                + "\n\nNếu có thắc mắc về phiếu lương, vui lòng liên hệ phòng Kế toán.";
    }

    static String displayMonth(String payrollMonth) {
        if (payrollMonth != null && payrollMonth.matches("\\d{4}-\\d{2}")) {
            return payrollMonth.substring(5) + "/" + payrollMonth.substring(0, 4);
        }
        return safe(payrollMonth);
    }

    static Map<String, Object> payload(HrPayrollImportRow row) {
        try {
            return MAPPER.readValue(row.getPayloadJson(), new TypeReference<>() { });
        } catch (Exception exception) {
            throw HrApiException.badRequest("PAYROLL_PAYLOAD_INVALID", "Không đọc được dữ liệu lương của " + row.getEmployeeCode());
        }
    }

    static String value(Map<String, Object> value, String key) { return text(value, key); }
    static String formattedMoney(Map<String, Object> value, String key) { return money(value, key); }
    static String safe(String value) { return value == null ? "" : value.trim(); }

    private static String line(String label, String value) {
        return String.format(Locale.ROOT, "%-16s: %s", label, value == null ? "" : value);
    }

    private static String moneyLine(String label, String value) {
        return String.format(Locale.ROOT, "%-16s: %14s đ", label, value == null ? "0" : value);
    }

    /** Reserve the same two trailing columns as the money unit (" đ"). */
    private static String quantityLine(String label, String value) {
        return String.format(Locale.ROOT, "%-16s: %14s  ", label, value == null || value.isBlank() ? "0" : value);
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
