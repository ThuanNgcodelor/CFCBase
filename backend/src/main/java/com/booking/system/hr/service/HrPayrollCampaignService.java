package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.api.dto.HrPageResponse;
import com.booking.system.hr.api.dto.HrPayrollDtos;
import com.booking.system.hr.entity.HrPayrollCampaign;
import com.booking.system.hr.entity.HrPayrollDelivery;
import com.booking.system.hr.entity.HrPayrollImport;
import com.booking.system.hr.entity.HrPayrollImportRow;
import com.booking.system.hr.enums.HrPayrollCampaignStatus;
import com.booking.system.hr.enums.HrPayrollDeliveryStatus;
import com.booking.system.hr.enums.HrPayrollImportStatus;
import com.booking.system.hr.enums.HrPayrollRowStatus;
import com.booking.system.hr.importer.HrImportActor;
import com.booking.system.hr.repository.HrPayrollCampaignRepository;
import com.booking.system.hr.repository.HrPayrollDeliveryRepository;
import com.booking.system.hr.repository.HrPayrollImportRepository;
import com.booking.system.hr.repository.HrPayrollImportRowRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HrPayrollCampaignService {
    private final HrPayrollService payrollService;
    private final HrPayrollCampaignRepository campaignRepository;
    private final HrPayrollDeliveryRepository deliveryRepository;
    private final HrPayrollImportRepository importRepository;
    private final HrPayrollImportRowRepository rowRepository;
    private final TelegramBotClient botClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TransactionTemplate transactionTemplate;
    private static final int MAX_ATTEMPTS = 3;

    @Transactional
    public HrPayrollDtos.CampaignResponse create(String importId, HrPayrollDtos.CreateCampaignRequest request, HrImportActor actor) {
        HrPayrollImport payrollImport = importRepository.findByIdForUpdate(importId).orElseThrow(() -> HrApiException.notFound("PAYROLL_IMPORT_NOT_FOUND", "Không tìm thấy lần nhập lương."));
        if (campaignRepository.findByPayrollImportId(importId).isPresent()) throw HrApiException.conflict("PAYROLL_CAMPAIGN_EXISTS", "File lương này đã tạo đợt gửi.");
        if (campaignRepository.existsByStatusIn(List.of(HrPayrollCampaignStatus.QUEUED, HrPayrollCampaignStatus.SENDING))) throw HrApiException.conflict("PAYROLL_CAMPAIGN_ACTIVE", "Đang có một đợt gửi lương khác đang chạy.");
        List<HrPayrollImportRow> rows = rowRepository.findByPayrollImportIdOrderBySourceRowNumber(importId);
        HrPayrollCampaign campaign = new HrPayrollCampaign(); campaign.setPayrollImport(payrollImport); campaign.setStatus(HrPayrollCampaignStatus.QUEUED); campaign.setDeliveryMode("TEXT"); campaign.setBatchSize(50); campaign.setTotalCount(rows.size()); campaign.setCreatedByActor(actor.subject()); campaign.setUpdatedByActor(actor.subject());
        int pending = 0, skipped = 0;
        campaign = campaignRepository.save(campaign);
        for (HrPayrollImportRow row : rows) {
            HrPayrollDelivery delivery = new HrPayrollDelivery(); delivery.setCampaign(campaign); delivery.setImportRow(row); delivery.setEmployee(row.getEmployee()); delivery.setEmployeeCode(row.getEmployeeCode()); delivery.setEmployeeName(row.getEmployeeName()); delivery.setTelegramChatId(row.getTelegramChatId()); delivery.setCreatedByActor(actor.subject()); delivery.setUpdatedByActor(actor.subject());
            if (row.getStatus() == HrPayrollRowStatus.READY && row.getTelegramChatId() != null) { delivery.setStatus(HrPayrollDeliveryStatus.PENDING); pending++; }
            else { delivery.setStatus(HrPayrollDeliveryStatus.SKIPPED); skipped++; delivery.setLastError(row.getErrorMessage()); }
            deliveryRepository.save(delivery);
        }
        campaign.setPendingCount(pending); campaign.setSkippedCount(skipped); campaign.setUpdatedByActor(actor.subject());
        payrollImport.setStatus(pending > 0 ? HrPayrollImportStatus.QUEUED : HrPayrollImportStatus.COMPLETED_WITH_WARNING); payrollImport.setUpdatedByActor(actor.subject()); importRepository.save(payrollImport);
        return toResponse(campaignRepository.save(campaign));
    }

    @Async
    public void processAsync(String campaignId) { process(campaignId); }

    @Transactional
    public HrPayrollDtos.CampaignResponse start(String campaignId, HrImportActor actor) {
        HrPayrollCampaign campaign = campaignRepository.findByIdForUpdate(campaignId)
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_CAMPAIGN_NOT_FOUND", "Không tìm thấy đợt gửi lương."));
        if (campaign.getStatus() == HrPayrollCampaignStatus.SENDING) {
            throw HrApiException.conflict("PAYROLL_CAMPAIGN_ACTIVE", "Đợt gửi lương này đang chạy.");
        }
        if (campaign.getStatus() == HrPayrollCampaignStatus.COMPLETED
                || campaign.getStatus() == HrPayrollCampaignStatus.COMPLETED_WITH_WARNING) {
            throw HrApiException.conflict("PAYROLL_CAMPAIGN_COMPLETED", "Đợt gửi lương này đã hoàn tất.");
        }
        if (campaign.getStatus() != HrPayrollCampaignStatus.QUEUED) {
            campaign.setStatus(HrPayrollCampaignStatus.QUEUED);
        }
        campaign.setUpdatedByActor(actor.subject());
        return toResponse(campaignRepository.save(campaign));
    }

    @Transactional
    public HrPayrollDtos.CampaignResponse retryFailed(String campaignId, HrImportActor actor) {
        HrPayrollCampaign campaign = campaignRepository.findByIdForUpdate(campaignId)
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_CAMPAIGN_NOT_FOUND", "Không tìm thấy đợt gửi lương."));
        if (campaign.getStatus() == HrPayrollCampaignStatus.SENDING) {
            throw HrApiException.conflict("PAYROLL_CAMPAIGN_ACTIVE", "Đợt gửi lương này đang chạy.");
        }
        List<HrPayrollDelivery> failed = deliveryRepository.findByCampaignIdAndStatus(campaignId, HrPayrollDeliveryStatus.FAILED);
        if (failed.isEmpty()) throw HrApiException.badRequest("PAYROLL_NO_FAILED_DELIVERIES", "Đợt gửi không có dòng thất bại để gửi lại.");
        failed.forEach(delivery -> { delivery.setStatus(HrPayrollDeliveryStatus.RETRY); delivery.setAttemptCount(0); delivery.setLastError(null); deliveryRepository.save(delivery); });
        campaign.setStatus(HrPayrollCampaignStatus.QUEUED); campaign.setFinishedAt(null); campaign.setUpdatedByActor(actor.subject());
        return toResponse(campaignRepository.save(campaign));
    }

    public void process(String campaignId) {
        HrPayrollCampaign campaign = transactionTemplate.execute(status -> {
            HrPayrollCampaign current = campaignRepository.findByIdForUpdate(campaignId).orElseThrow();
            if (current.getStatus() == HrPayrollCampaignStatus.SENDING
                    || current.getStatus() == HrPayrollCampaignStatus.COMPLETED
                    || current.getStatus() == HrPayrollCampaignStatus.COMPLETED_WITH_WARNING) return null;
            current.setStatus(HrPayrollCampaignStatus.SENDING); current.setStartedAt(now());
            return campaignRepository.save(current);
        });
        if (campaign == null) {
            return;
        }
        while (true) {
            List<HrPayrollDelivery> items = transactionTemplate.execute(status -> {
                List<HrPayrollDelivery> next = deliveryRepository.findTop50ByCampaignIdAndStatusInOrderByCreatedAt(campaignId, List.of(HrPayrollDeliveryStatus.PENDING, HrPayrollDeliveryStatus.RETRY));
                next.forEach(delivery -> { delivery.setStatus(HrPayrollDeliveryStatus.SENDING); delivery.setAttemptCount(delivery.getAttemptCount() + 1); deliveryRepository.save(delivery); });
                return next;
            });
            if (items.isEmpty()) break;
            for (HrPayrollDelivery delivery : items) {
                boolean sent = false;
                try { sent = botClient.sendText(delivery.getTelegramChatId(), message(delivery)); }
                catch (RuntimeException exception) { delivery.setLastError(exception.getMessage()); }
                boolean delivered = sent;
                transactionTemplate.execute(status -> {
                    HrPayrollDelivery current = deliveryRepository.findById(delivery.getId()).orElseThrow();
                    if (delivered) { current.setStatus(HrPayrollDeliveryStatus.SENT); current.setSentAt(now()); current.setLastError(null); }
                    else { current.setLastError("Telegram không xác nhận gửi tin nhắn."); current.setStatus(current.getAttemptCount() < MAX_ATTEMPTS ? HrPayrollDeliveryStatus.RETRY : HrPayrollDeliveryStatus.FAILED); }
                    return deliveryRepository.save(current);
                });
                try { Thread.sleep(300); } catch (InterruptedException exception) { Thread.currentThread().interrupt(); return; }
            }
            transactionTemplate.execute(status -> {
                HrPayrollCampaign current = campaignRepository.findByIdForUpdate(campaignId).orElseThrow();
                refreshCounts(current);
                return campaignRepository.save(current);
            });
        }
        transactionTemplate.execute(status -> {
            HrPayrollCampaign current = campaignRepository.findByIdForUpdate(campaignId).orElseThrow();
            refreshCounts(current); current.setStatus(current.getFailedCount() > 0 ? HrPayrollCampaignStatus.COMPLETED_WITH_WARNING : HrPayrollCampaignStatus.COMPLETED); current.setFinishedAt(now());
            return campaignRepository.save(current);
        });
    }

    @Transactional(readOnly = true)
    public HrPayrollDtos.CampaignResponse campaign(String id) { return toResponse(campaignRepository.findById(id).orElseThrow(() -> HrApiException.notFound("PAYROLL_CAMPAIGN_NOT_FOUND", "Không tìm thấy đợt gửi lương."))); }
    @Transactional(readOnly = true)
    public HrPageResponse<HrPayrollDtos.PayrollDeliveryResponse> deliveries(String id, int page, int size) { campaign(id); return HrPageResponse.from(deliveryRepository.findByCampaignIdOrderByCreatedAt(id, org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100))), this::toDeliveryResponse); }

    private void refreshCounts(HrPayrollCampaign campaign) { campaign.setPendingCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.PENDING)); campaign.setSendingCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.SENDING)); campaign.setSentCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.SENT)); campaign.setRetryCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.RETRY)); campaign.setFailedCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.FAILED)); campaign.setSkippedCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.SKIPPED)); }
    private String message(HrPayrollDelivery delivery) {
        Map<String, Object> value; try { value = objectMapper.readValue(delivery.getImportRow().getPayloadJson(), new TypeReference<>() {}); } catch (Exception exception) { throw HrApiException.badRequest("PAYROLL_PAYLOAD_INVALID", "Không đọc được dữ liệu lương của " + delivery.getEmployeeCode()); }
        return "PHIẾU LƯƠNG THÁNG " + campaignMonth(delivery) + "\n\nKính gửi anh/chị: " + delivery.getEmployeeName() + "\nMã NV: " + delivery.getEmployeeCode() + "\nSố tài khoản: " + text(value, "stk") + "\n\nCHI TIẾT LƯƠNG\nSố công: " + text(value, "cong") + "\nTiền lương: " + money(value, "tienLuong") + " đ\nTổng thu: " + money(value, "tongThu") + " đ\n\nKHẤU TRỪ / ĐÓNG GÓP\nBHXH 10,5%: " + money(value, "bhxh") + " đ\nB giặt: " + money(value, "baoGiat") + " đ\nHTKK: " + money(value, "htkk") + " đ\nĐảng phí: " + money(value, "thuDangPhi") + " đ\nĐoàn phí: " + money(value, "doanPhi") + " đ\nThuế TNCN: " + money(value, "ttn") + " đ\nASXH: " + money(value, "asxh") + " đ\nXHHC: " + money(value, "xhhc") + " đ\n\nTHỰC LĨNH CHUYỂN KHOẢN\n" + money(value, "nganHangChuyen") + " đ\n\nNếu có thắc mắc về phiếu lương, vui lòng liên hệ phòng Kế toán.";
    }
    private String campaignMonth(HrPayrollDelivery delivery) { return delivery.getCampaign().getPayrollImport().getPayrollMonth(); }
    private static String text(Map<String, Object> value, String key) { return value.getOrDefault(key, "").toString(); }
    private static String money(Map<String, Object> value, String key) { try { return new BigDecimal(value.getOrDefault(key, 0).toString()).setScale(0, java.math.RoundingMode.HALF_UP).toPlainString().replaceAll("\\B(?=(\\d{3})+(?!\\d))", "."); } catch (Exception ignored) { return "0"; } }
    private HrPayrollDtos.CampaignResponse toResponse(HrPayrollCampaign c) { return new HrPayrollDtos.CampaignResponse(c.getId(), c.getPayrollImport().getId(), c.getPayrollImport().getSourceFileName(), c.getPayrollImport().getPayrollMonth(), c.getStatus(), c.getTotalCount(), c.getPendingCount(), c.getSendingCount(), c.getSentCount(), c.getRetryCount(), c.getFailedCount(), c.getSkippedCount(), c.getBatchSize(), c.getStartedAt(), c.getFinishedAt(), c.getLastError()); }
    private HrPayrollDtos.PayrollDeliveryResponse toDeliveryResponse(HrPayrollDelivery d) { return new HrPayrollDtos.PayrollDeliveryResponse(d.getId(), d.getEmployeeCode(), d.getEmployeeName(), d.getStatus(), d.getAttemptCount(), d.getLastError(), d.getSentAt()); }
    private static LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }
}
