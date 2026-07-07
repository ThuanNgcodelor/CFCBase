package com.booking.system.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:admin@cfcbooking.io.vn}")
    private String fromEmail;

    @Async
    public void sendBookingCreatedEmailToAdmin(String adminEmail, String requesterName, String resourceType,
            String title) {
        String subject = "🔔 Yêu cầu đặt " + resourceType + " mới từ " + requesterName;
        String content = "<h2>Yêu cầu phê duyệt mới</h2>"
                + "<p>Xin chào Admin,</p>"
                + "<p>Bạn vừa nhận được một yêu cầu đặt <b>" + resourceType + "</b> mới từ <b>" + requesterName
                + "</b>.</p>"
                + "<div style='background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;'>"
                + "  <p style='margin: 0;'><b>Tiêu đề:</b> " + title + "</p>"
                + "</div>"
                + "<p>Vui lòng truy cập hệ thống để xem chi tiết thông tin và tiến hành phê duyệt.</p>"
                + "<div style='text-align: center; margin: 30px 0;'>"
                + "  <a href='https://cfcbooking.io.vn/admin/approvals' style='background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>ĐI TỚI TRANG PHÊ DUYỆT</a>"
                + "</div>";
        sendEmail(adminEmail, subject, buildHtmlTemplate(subject, content));
    }

    @Async
    public void sendBookingApprovedEmail(String userEmail, String resourceType, String title) {
        String subject = "✅ Yêu cầu đặt " + resourceType + " ĐÃ ĐƯỢC PHÊ DUYỆT";
        String content = "<h2>Yêu cầu đã được phê duyệt!</h2>"
                + "<p>Xin chào,</p>"
                + "<p>Tin vui! Yêu cầu đặt <b>" + resourceType + "</b> của bạn đã được Admin chấp thuận.</p>"
                + "<div style='background-color: #f0fdf4; padding: 15px; border-left: 4px solid #22c55e; margin: 20px 0;'>"
                + "  <p style='margin: 0;'><b>Tiêu đề:</b> " + title + "</p>"
                + "</div>"
                + "<p>Bạn có thể truy cập hệ thống để xem lại chi tiết lịch trình của mình.</p>"
                + "<div style='text-align: center; margin: 30px 0;'>"
                + "  <a href='https://cfcbooking.io.vn/' style='background-color: #22c55e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>XEM LỊCH TRÌNH</a>"
                + "</div>";
        sendEmail(userEmail, subject, buildHtmlTemplate(subject, content));
    }

    @Async
    public void sendBookingRejectedEmail(String userEmail, String resourceType, String title, String reason) {
        String subject = "❌ Yêu cầu đặt " + resourceType + " BỊ TỪ CHỐI";
        String content = "<h2>Yêu cầu không được chấp thuận</h2>"
                + "<p>Xin chào,</p>"
                + "<p>Rất tiếc, yêu cầu đặt <b>" + resourceType + "</b> của bạn đã bị Admin từ chối.</p>"
                + "<div style='background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;'>"
                + "  <p style='margin: 0; margin-bottom: 8px;'><b>Tiêu đề:</b> " + title + "</p>"
                + "  <p style='margin: 0; color: #b91c1c;'><b>Lý do từ chối:</b> "
                + (reason != null && !reason.isEmpty() ? reason : "Không có lý do cụ thể") + "</p>"
                + "</div>"
                + "<p>Vui lòng liên hệ trực tiếp với người phê duyệt nếu bạn cần thêm thông tin.</p>"
                + "<div style='text-align: center; margin: 30px 0;'>"
                + "  <a href='https://cfcbooking.io.vn/' style='background-color: #64748b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;'>TRỞ VỀ HỆ THỐNG</a>"
                + "</div>";
        sendEmail(userEmail, subject, buildHtmlTemplate(subject, content));
    }

    private String buildHtmlTemplate(String title, String bodyContent) {
        return "<!DOCTYPE html>"
                + "<html>"
                + "<head>"
                + "<meta charset='UTF-8'>"
                + "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
                + "</head>"
                + "<body style='margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #3f3f46;'>"
                + "  <table border='0' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f4f4f5; padding: 20px 0;'>"
                + "    <tr>"
                + "      <td align='center'>"
                + "        <table border='0' cellpadding='0' cellspacing='0' width='100%' max-width='600' style='background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 600px; width: 100%;'>"
                + "          <tr>"
                + "            <td style='background-color: #1e3a8a; padding: 24px; text-align: center; border-bottom: 4px solid #3b82f6;'>"
                + "              <h1 style='color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;'>CFC BOOKING</h1>"
                + "            </td>"
                + "          </tr>"
                + "          <tr>"
                + "            <td style='padding: 32px 24px; font-size: 16px; line-height: 1.6; color: #334155;'>"
                + bodyContent
                + "            </td>"
                + "          </tr>"
                + "          <tr>"
                + "            <td style='background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;'>"
                + "              <p style='margin: 0; font-size: 13px; color: #64748b;'>Đây là email tự động từ hệ thống CFC Booking. Vui lòng không trả lời email này.</p>"
                + "              <p style='margin: 8px 0 0 0; font-size: 13px; color: #64748b;'>© "
                + java.time.Year.now().getValue() + " Công ty CP Phân bón & Hóa chất Cần Thơ</p>"
                + "            </td>"
                + "          </tr>"
                + "        </table>"
                + "      </td>"
                + "    </tr>"
                + "  </table>"
                + "</body>"
                + "</html>";
    }

    private void sendEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Email sent successfully to {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error while sending email to {}: {}", to, e.getMessage());
        }
    }
}
