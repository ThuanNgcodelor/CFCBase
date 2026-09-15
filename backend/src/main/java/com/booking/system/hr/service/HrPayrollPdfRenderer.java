package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.entity.HrPayrollImportRow;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

/** One-page, Unicode-safe payroll snapshot used for Telegram delivery and resend audit. */
public final class HrPayrollPdfRenderer {
    private static final Color INK = new Color(20, 37, 58);
    private static final Color MUTED = new Color(95, 112, 132);
    private static final Color GREEN = new Color(0, 137, 91);
    private static final Color PALE_GREEN = new Color(232, 247, 240);
    private static final Color PALE_GRAY = new Color(246, 248, 250);

    private HrPayrollPdfRenderer() { }

    public record PayrollPdf(byte[] bytes, String fileName) { }

    public static PayrollPdf render(HrPayrollImportRow row, String payrollMonth, boolean testCopy) {
        Map<String, Object> payload = HrPayrollMessageRenderer.payload(row);
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDFont regular = loadFont(document, "/hr/fonts/BeVietnamPro-Regular.ttf");
            PDFont semibold = loadFont(document, "/hr/fonts/BeVietnamPro-SemiBold.ttf");
            try (PDPageContentStream canvas = new PDPageContentStream(document, page)) {
                canvas.setNonStrokingColor(INK);
                canvas.addRect(0, 0, page.getMediaBox().getWidth(), page.getMediaBox().getHeight());
                canvas.fill();

                canvas.setNonStrokingColor(Color.WHITE);
                canvas.addRect(34, 34, 527, 774);
                canvas.fill();
                canvas.setNonStrokingColor(INK);
                float y = 768;
                text(canvas, semibold, 18, 58, y, "PHIẾU LƯƠNG");
                text(canvas, regular, 10, 58, y - 18, "Kỳ lương " + HrPayrollMessageRenderer.displayMonth(payrollMonth));
                canvas.setNonStrokingColor(GREEN);
                canvas.addRect(58, y - 31, 92, 3);
                canvas.fill();
                if (testCopy) badge(canvas, semibold, "BẢN GỬI THỬ", 426, y - 3);

                y -= 65;
                section(canvas, semibold, "THÔNG TIN NHÂN VIÊN", 58, y);
                y -= 18;
                y = infoRow(canvas, regular, semibold, "Họ và tên", row.getEmployeeName(), y);
                y = infoRow(canvas, regular, semibold, "Mã nhân viên", row.getEmployeeCode(), y);
                y = infoRow(canvas, regular, semibold, "Số tài khoản", HrPayrollMessageRenderer.value(payload, "stk"), y);

                y -= 12;
                section(canvas, semibold, "CHI TIẾT LƯƠNG", 58, y);
                y -= 18;
                y = amountRow(canvas, regular, semibold, "Số công", HrPayrollMessageRenderer.value(payload, "cong"), y, false);
                y = amountRow(canvas, regular, semibold, "Tiền lương", HrPayrollMessageRenderer.formattedMoney(payload, "tienLuong"), y, true);

                y -= 12;
                section(canvas, semibold, "KHOẢN THU TRONG LƯƠNG", 58, y);
                y -= 18;
                y = amountRow(canvas, regular, semibold, "Tổng khoản thu", HrPayrollMessageRenderer.formattedMoney(payload, "tongThu"), y, true);
                for (var field : List.of(
                        new Field("BHXH 10,5%", "bhxh"), new Field("B giặt", "baoGiat"), new Field("HTKK", "htkk"),
                        new Field("Đảng phí", "thuDangPhi"), new Field("Đoàn phí", "doanPhi"), new Field("Thuế TNCN", "ttn"),
                        new Field("ASXH", "asxh"), new Field("XHHC", "xhhc"))) {
                    y = amountRow(canvas, regular, regular, field.label(), HrPayrollMessageRenderer.formattedMoney(payload, field.key()), y, true);
                }

                y -= 10;
                canvas.setNonStrokingColor(PALE_GREEN);
                canvas.addRect(58, y - 46, 479, 46);
                canvas.fill();
                canvas.setNonStrokingColor(INK);
                text(canvas, semibold, 10, 72, y - 17, "THỰC NHẬN (CHUYỂN KHOẢN)");
                right(canvas, semibold, 16, 522, y - 35, HrPayrollMessageRenderer.formattedMoney(payload, "nganHangChuyen") + " đ");

                canvas.setNonStrokingColor(MUTED);
                text(canvas, regular, 8.5f, 58, 64, "Nếu có thắc mắc về phiếu lương, vui lòng liên hệ phòng Kế toán.");
                text(canvas, regular, 7.5f, 58, 49, testCopy ? "Bản thử - không dùng làm chứng từ thanh toán." : "Tài liệu bảo mật - chỉ dành cho người nhận.");
            }
            document.save(output);
            return new PayrollPdf(output.toByteArray(), fileName(row, payrollMonth));
        } catch (Exception exception) {
            throw HrApiException.badRequest("PAYROLL_PDF_FAILED", "Không thể tạo PDF phiếu lương cho " + row.getEmployeeCode());
        }
    }

    private record Field(String label, String key) { }

    private static PDFont loadFont(PDDocument document, String path) throws Exception {
        InputStream stream = HrPayrollPdfRenderer.class.getResourceAsStream(path);
        if (stream == null) throw new IllegalStateException("Payroll font is missing");
        try (stream) { return PDType0Font.load(document, stream); }
    }

    private static void section(PDPageContentStream canvas, PDFont font, String title, float x, float y) throws Exception {
        canvas.setNonStrokingColor(GREEN); text(canvas, font, 9, x, y, title); canvas.setNonStrokingColor(INK);
    }

    private static float infoRow(PDPageContentStream canvas, PDFont regular, PDFont valueFont, String label, String value, float y) throws Exception {
        canvas.setNonStrokingColor(PALE_GRAY); canvas.addRect(58, y - 14, 479, 19); canvas.fill();
        canvas.setNonStrokingColor(MUTED); text(canvas, regular, 8.5f, 70, y - 2, label);
        canvas.setNonStrokingColor(INK); textFit(canvas, valueFont, 9, 190, y - 2, 330, HrPayrollMessageRenderer.safe(value));
        return y - 23;
    }

    private static float amountRow(PDPageContentStream canvas, PDFont labelFont, PDFont amountFont, String label, String amount, float y, boolean money) throws Exception {
        canvas.setNonStrokingColor(INK); text(canvas, labelFont, 9, 70, y, label);
        String value = (amount == null || amount.isBlank() ? "0" : amount) + (money ? " đ" : "");
        right(canvas, amountFont, 9, 522, y, value);
        canvas.setStrokingColor(new Color(229, 233, 237)); canvas.setLineWidth(.45f); canvas.moveTo(70, y - 7); canvas.lineTo(522, y - 7); canvas.stroke();
        return y - 19;
    }

    private static void badge(PDPageContentStream canvas, PDFont font, String label, float right, float y) throws Exception {
        float width = 98; canvas.setNonStrokingColor(new Color(255, 244, 230)); canvas.addRect(right - width, y - 12, width, 18); canvas.fill();
        canvas.setNonStrokingColor(new Color(181, 82, 0)); text(canvas, font, 7.5f, right - width + 11, y - .5f, label); canvas.setNonStrokingColor(INK);
    }

    private static void text(PDPageContentStream canvas, PDFont font, float size, float x, float y, String value) throws Exception {
        canvas.beginText(); canvas.setFont(font, size); canvas.newLineAtOffset(x, y); canvas.showText(value == null ? "" : value); canvas.endText();
    }

    private static void textFit(PDPageContentStream canvas, PDFont font, float size, float x, float y, float width, String value) throws Exception {
        String fitted = value == null ? "" : value;
        while (!fitted.isEmpty() && font.getStringWidth(fitted) / 1000f * size > width) fitted = fitted.substring(0, fitted.length() - 1);
        if (!fitted.equals(value) && fitted.length() > 1) fitted = fitted.substring(0, fitted.length() - 1) + "…";
        text(canvas, font, size, x, y, fitted);
    }

    private static void right(PDPageContentStream canvas, PDFont font, float size, float right, float y, String value) throws Exception {
        float width = font.getStringWidth(value) / 1000f * size; text(canvas, font, size, right - width, y, value);
    }

    private static String fileName(HrPayrollImportRow row, String payrollMonth) {
        String month = payrollMonth == null ? "ky-luong" : payrollMonth.replaceAll("[^0-9-]", "").replace('-', '_');
        String code = HrPayrollMessageRenderer.safe(row.getEmployeeCode()).replaceAll("[^A-Za-z0-9_-]", "_");
        return "Phieu_luong_" + month + "_" + (code.isBlank() ? "nhan_vien" : code) + ".pdf";
    }
}
