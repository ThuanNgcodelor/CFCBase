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
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class HrPayrollCampaignService {
    private final HrPayrollCampaignRepository campaignRepository;
    private final HrPayrollDeliveryRepository deliveryRepository;
    private final HrPayrollImportRepository importRepository;
    private final HrPayrollImportRowRepository rowRepository;
    private final TelegramBotClient botClient;
    private final com.booking.system.hr.repository.HrEmployeeTelegramBindingRepository bindingRepository;
    private final TransactionTemplate transactionTemplate;

    @Transactional
    public HrPayrollDtos.CampaignResponse create(String importId, HrPayrollDtos.CreateCampaignRequest request, HrImportActor actor) {
        String deliveryMode = request == null || request.deliveryMode() == null || request.deliveryMode().isBlank()
                ? "PDF" : request.deliveryMode().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PDF", "TEXT").contains(deliveryMode))
            throw HrApiException.badRequest("PAYROLL_MODE_UNSUPPORTED", "Kiểu gửi phiếu lương không hợp lệ.");
        HrPayrollImport payrollImport = importRepository.findByIdForUpdate(importId).orElseThrow(() -> HrApiException.notFound("PAYROLL_IMPORT_NOT_FOUND", "Không tìm thấy lần nhập lương."));
        if (campaignRepository.existsByStatusIn(List.of(HrPayrollCampaignStatus.QUEUED, HrPayrollCampaignStatus.SENDING))) throw HrApiException.conflict("PAYROLL_CAMPAIGN_ACTIVE", "Đang có một đợt gửi lương khác đang chạy.");
        List<HrPayrollImportRow> allRows = rowRepository.findByPayrollImportIdOrderBySourceRowNumber(importId);
        String selectionMode = request == null || request.selectionMode() == null || request.selectionMode().isBlank()
                ? "ALL_ELIGIBLE" : request.selectionMode().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("ALL_ELIGIBLE", "SELECTED", "SINGLE").contains(selectionMode)) {
            throw HrApiException.badRequest("PAYROLL_SELECTION_MODE_INVALID", "Kiểu chọn người nhận không hợp lệ.");
        }
        Set<String> selectedIds = request == null || request.rowIds() == null ? Set.of() : new HashSet<>(request.rowIds());
        List<HrPayrollImportRow> rows = "ALL_ELIGIBLE".equals(selectionMode)
                ? allRows.stream().filter(row -> row.getStatus() == HrPayrollRowStatus.READY).toList()
                : allRows.stream().filter(row -> selectedIds.contains(row.getId())).toList();
        if (("SINGLE".equals(selectionMode) && rows.size() != 1) || ("SELECTED".equals(selectionMode) && rows.isEmpty())) {
            throw HrApiException.badRequest("PAYROLL_SELECTION_EMPTY", "Hãy chọn đúng người nhận trước khi tạo hàng đợi.");
        }
        if (rows.isEmpty()) throw HrApiException.badRequest("PAYROLL_NO_ELIGIBLE_ROWS", "Không có nhân viên đủ điều kiện để gửi.");
        HrPayrollCampaign campaign = new HrPayrollCampaign(); campaign.setPayrollImport(payrollImport); campaign.setStatus(HrPayrollCampaignStatus.QUEUED); campaign.setDeliveryMode(deliveryMode); campaign.setSelectionMode(selectionMode); campaign.setBatchSize(50); campaign.setTotalCount(rows.size()); campaign.setCreatedByActor(actor.subject()); campaign.setUpdatedByActor(actor.subject());
        int pending = 0, skipped = 0;
        campaign = campaignRepository.save(campaign);
        for (HrPayrollImportRow row : rows) {
            HrPayrollDelivery delivery = new HrPayrollDelivery(); delivery.setCampaign(campaign); delivery.setImportRow(row); delivery.setEmployee(row.getEmployee()); delivery.setEmployeeCode(row.getEmployeeCode()); delivery.setEmployeeName(row.getEmployeeName()); delivery.setTelegramChatId(row.getTelegramChatId()); delivery.setCreatedByActor(actor.subject()); delivery.setUpdatedByActor(actor.subject());
            boolean alreadyQueuedOrSent = deliveryRepository.existsByImportRowIdAndStatusIn(row.getId(), List.of(
                    HrPayrollDeliveryStatus.PENDING, HrPayrollDeliveryStatus.SENDING,
                    HrPayrollDeliveryStatus.RETRY, HrPayrollDeliveryStatus.SENT));
            if (row.getStatus() == HrPayrollRowStatus.READY && row.getTelegramChatId() != null && !alreadyQueuedOrSent) {
                delivery.setMessageSnapshot(HrPayrollMessageRenderer.officialCaption(row, payrollImport.getPayrollMonth()));
                if ("PDF".equals(deliveryMode)) {
                    HrPayrollPdfRenderer.PayrollPdf pdf = HrPayrollPdfRenderer.render(row, payrollImport.getPayrollMonth(), false);
                    delivery.setDocumentSnapshot(pdf.bytes());
                    delivery.setDocumentFileName(pdf.fileName());
                }
                delivery.setStatus(HrPayrollDeliveryStatus.PENDING); pending++;
            }
            else { delivery.setStatus(HrPayrollDeliveryStatus.SKIPPED); skipped++; delivery.setLastError(alreadyQueuedOrSent ? "Phiếu lương này đã được xếp hàng hoặc gửi chính thức trước đó." : row.getErrorMessage()); }
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
        List<HrPayrollDelivery> failed = deliveryRepository.findByCampaignIdAndStatus(campaignId, HrPayrollDeliveryStatus.FAILED)
                .stream().filter(d -> d.getLastError() != null && (d.getLastError().startsWith("RETRYABLE:") || d.getLastError().startsWith("REJECTED:"))).toList();
        if (failed.isEmpty()) throw HrApiException.badRequest("PAYROLL_NO_FAILED_DELIVERIES", "Không có dòng lỗi được phép gửi lại. Dòng chưa rõ đã gửi hay chưa cần đối soát riêng.");
        failed.forEach(delivery -> { delivery.setStatus(HrPayrollDeliveryStatus.RETRY); delivery.setLastError(null); delivery.setUpdatedByActor(actor.subject()); deliveryRepository.save(delivery); });
        refreshCounts(campaign);
        campaign.setStatus(HrPayrollCampaignStatus.QUEUED); campaign.setFinishedAt(null); campaign.setUpdatedByActor(actor.subject());
        return toResponse(campaignRepository.save(campaign));
    }

    @Transactional
    public HrPayrollDtos.CampaignResponse resendSent(String campaignId, String deliveryId,
                                                       HrPayrollDtos.ResendRequest request, HrImportActor actor) {
        String reason = request == null || request.reason() == null ? "" : request.reason().trim();
        if (reason.isBlank()) throw HrApiException.badRequest("PAYROLL_RESEND_REASON_REQUIRED", "Lý do gửi lại là bắt buộc.");
        HrPayrollCampaign campaign = campaignRepository.findByIdForUpdate(campaignId)
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_CAMPAIGN_NOT_FOUND", "Không tìm thấy đợt gửi lương."));
        if (campaign.getStatus() == HrPayrollCampaignStatus.QUEUED
                || campaign.getStatus() == HrPayrollCampaignStatus.SENDING) {
            throw HrApiException.conflict("PAYROLL_CAMPAIGN_ACTIVE", "Đợt gửi này đang chạy, chưa thể gửi lại riêng lẻ.");
        }
        if (campaignRepository.existsByStatusIn(List.of(HrPayrollCampaignStatus.QUEUED, HrPayrollCampaignStatus.SENDING))) {
            throw HrApiException.conflict("PAYROLL_CAMPAIGN_ACTIVE", "Đang có một đợt gửi lương khác chạy.");
        }
        HrPayrollDelivery delivery = deliveryRepository.findById(deliveryId)
                .filter(value -> value.getCampaign().getId().equals(campaignId))
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_DELIVERY_NOT_FOUND", "Không tìm thấy phiếu lương trong đợt này."));
        if (delivery.getStatus() != HrPayrollDeliveryStatus.SENT) {
            throw HrApiException.conflict("PAYROLL_DELIVERY_NOT_SENT", "Chỉ dùng gửi lại bản sao cho phiếu đã gửi thành công.");
        }
        delivery.setStatus(HrPayrollDeliveryStatus.RETRY);
        delivery.setLastResendReason(reason);
        delivery.setLastError(null);
        delivery.setUpdatedByActor(actor.subject());
        deliveryRepository.save(delivery);
        campaign.setStatus(HrPayrollCampaignStatus.QUEUED);
        campaign.setFinishedAt(null);
        campaign.setUpdatedByActor(actor.subject());
        refreshCounts(campaign);
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
                boolean recipientValid = Boolean.TRUE.equals(transactionTemplate.execute(status ->
                        delivery.getEmployee() != null && HrPayrollRecipientPolicy.matches(delivery,
                                bindingRepository.findByEmployeeId(delivery.getEmployee().getId()).orElse(null))));
                if (!recipientValid) {
                    transactionTemplate.execute(status -> {
                        var current = deliveryRepository.findById(delivery.getId()).orElseThrow();
                        current.setStatus(HrPayrollDeliveryStatus.SKIPPED);
                        current.setLastError("Liên kết Telegram đã thay đổi hoặc bị thu hồi sau khi import. Chưa gửi phiếu lương.");
                        return deliveryRepository.save(current);
                    });
                    continue;
                }
                TelegramBotClient.PayrollSendResult result;
                try {
                    result = hasPdf(delivery)
                            ? botClient.sendPayrollPdf(delivery.getTelegramChatId(), delivery.getDocumentSnapshot(),
                                    delivery.getDocumentFileName(), outboundMessage(delivery))
                            : botClient.sendPayrollText(delivery.getTelegramChatId(), outboundMessage(delivery));
                }
                catch (RuntimeException exception) { result = new TelegramBotClient.PayrollSendResult(false, "UNCERTAIN: Lỗi xử lý; cần đối soát trước khi gửi lại."); }
                var outcome = result;
                transactionTemplate.execute(status -> {
                    HrPayrollDelivery current = deliveryRepository.findById(delivery.getId()).orElseThrow();
                    if (outcome.sent()) { current.setStatus(HrPayrollDeliveryStatus.SENT); current.setSentAt(now()); current.setLastError(null); }
                    else { current.setLastError(outcome.error()); current.setStatus(HrPayrollDeliveryStatus.FAILED); }
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
            refreshCounts(current); current.setStatus(current.getFailedCount() > 0 || current.getSkippedCount() > 0 ? HrPayrollCampaignStatus.COMPLETED_WITH_WARNING : HrPayrollCampaignStatus.COMPLETED); current.setFinishedAt(now());
            return campaignRepository.save(current);
        });
    }

    @Transactional(readOnly = true)
    public String previewMessage(String campaignId, String deliveryId) {
        var delivery = deliveryRepository.findById(deliveryId).orElseThrow(() -> HrApiException.notFound("PAYROLL_DELIVERY_NOT_FOUND", "Không tìm thấy dòng gửi."));
        if (!delivery.getCampaign().getId().equals(campaignId)) throw HrApiException.notFound("PAYROLL_DELIVERY_NOT_FOUND", "Không tìm thấy dòng gửi trong đợt này.");
        if (delivery.getMessageSnapshot() == null) throw HrApiException.conflict("PAYROLL_MESSAGE_NOT_SAVED", "Đợt cũ hoặc dòng bỏ qua chưa lưu nội dung tin nhắn; không có bản đối chiếu chính xác.");
        return delivery.getMessageSnapshot();
    }

    @Transactional(readOnly = true)
    public PayrollDocument previewDocument(String campaignId, String deliveryId) {
        HrPayrollDelivery delivery = deliveryRepository.findById(deliveryId)
                .filter(value -> value.getCampaign().getId().equals(campaignId))
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_DELIVERY_NOT_FOUND", "Không tìm thấy phiếu lương trong đợt này."));
        if (!hasPdf(delivery)) {
            throw HrApiException.conflict("PAYROLL_DOCUMENT_NOT_SAVED", "Đợt cũ này chỉ lưu tin nhắn TEXT; chưa có PDF để xem lại.");
        }
        return new PayrollDocument(delivery.getDocumentSnapshot(), delivery.getDocumentFileName());
    }

    @Transactional(readOnly = true)
    public HrPayrollDtos.CampaignResponse campaignForImport(String importId) {
        if (!importRepository.existsById(importId)) throw HrApiException.notFound("PAYROLL_IMPORT_NOT_FOUND", "Không tìm thấy lần nhập lương.");
        return campaignRepository.findTopByPayrollImportIdOrderByCreatedAtDesc(importId).map(this::toResponse).orElse(null);
    }

    @Transactional
    public void deletePreviewImport(String importId) {
        HrPayrollImport payrollImport = importRepository.findByIdForUpdate(importId)
                .orElseThrow(() -> HrApiException.notFound("PAYROLL_IMPORT_NOT_FOUND", "Không tìm thấy lần nhập lương."));
        List<HrPayrollCampaign> campaigns = campaignRepository.findAllByPayrollImportIdOrderByCreatedAtDesc(importId);
        boolean hasStartedCampaign = campaigns.stream().anyMatch(campaign ->
                campaign.getStartedAt() != null
                        || campaign.getStatus() != HrPayrollCampaignStatus.QUEUED
                        || campaign.getSentCount() > 0
                        || campaign.getSendingCount() > 0
                        || campaign.getRetryCount() > 0
                        || campaign.getFailedCount() > 0);
        if (hasStartedCampaign) {
            throw HrApiException.conflict("PAYROLL_IMPORT_ALREADY_STARTED",
                    "File đã bắt đầu gửi hoặc có lịch sử xử lý nên không thể xoá.");
        }
        if (payrollImport.getStatus() != HrPayrollImportStatus.PREVIEWED
                && payrollImport.getStatus() != HrPayrollImportStatus.QUEUED) {
            throw HrApiException.conflict("PAYROLL_IMPORT_NOT_DELETABLE",
                    "Chỉ có thể xoá file xem trước hoặc hàng đợi chưa bắt đầu gửi.");
        }
        if (!campaigns.isEmpty()) campaignRepository.deleteAllByPayrollImportId(importId);
        importRepository.deleteById(importId);
    }

    @Transactional(readOnly = true)
    public HrPayrollDtos.CampaignResponse campaign(String id) { return toResponse(campaignRepository.findById(id).orElseThrow(() -> HrApiException.notFound("PAYROLL_CAMPAIGN_NOT_FOUND", "Không tìm thấy đợt gửi lương."))); }
    @Transactional(readOnly = true)
    public HrPageResponse<HrPayrollDtos.PayrollDeliveryResponse> deliveries(String id, int page, int size) { campaign(id); return HrPageResponse.from(deliveryRepository.findByCampaignIdOrderByCreatedAt(id, org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100))), this::toDeliveryResponse); }

    private void refreshCounts(HrPayrollCampaign campaign) { campaign.setPendingCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.PENDING)); campaign.setSendingCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.SENDING)); campaign.setSentCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.SENT)); campaign.setRetryCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.RETRY)); campaign.setFailedCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.FAILED)); campaign.setSkippedCount((int) deliveryRepository.countByCampaignIdAndStatus(campaign.getId(), HrPayrollDeliveryStatus.SKIPPED)); }
    private String message(HrPayrollDelivery delivery) {
        if (delivery.getMessageSnapshot() != null) return delivery.getMessageSnapshot();
        return HrPayrollMessageRenderer.render(delivery.getImportRow(), campaignMonth(delivery));
    }
    private String outboundMessage(HrPayrollDelivery delivery) {
        String content = message(delivery);
        if (delivery.getLastResendReason() == null || delivery.getLastResendReason().isBlank()) return content;
        return "PHIẾU LƯƠNG GỬI LẠI\n\n" + content;
    }
    private String campaignMonth(HrPayrollDelivery delivery) { return delivery.getCampaign().getPayrollImport().getPayrollMonth(); }
    private HrPayrollDtos.CampaignResponse toResponse(HrPayrollCampaign c) { return new HrPayrollDtos.CampaignResponse(c.getId(), c.getPayrollImport().getId(), c.getPayrollImport().getSourceFileName(), c.getPayrollImport().getPayrollMonth(), c.getStatus(), c.getTotalCount(), c.getPendingCount(), c.getSendingCount(), c.getSentCount(), c.getRetryCount(), c.getFailedCount(), c.getSkippedCount(), c.getBatchSize(), c.getStartedAt(), c.getFinishedAt(), c.getLastError()); }
    private HrPayrollDtos.PayrollDeliveryResponse toDeliveryResponse(HrPayrollDelivery d) { return new HrPayrollDtos.PayrollDeliveryResponse(d.getId(), d.getEmployeeCode(), d.getEmployeeName(), d.getStatus(), d.getAttemptCount(), d.getLastError(), d.getSentAt(), hasPdf(d)); }
    private static boolean hasPdf(HrPayrollDelivery delivery) { return delivery.getDocumentSnapshot() != null && delivery.getDocumentSnapshot().length > 0 && StringUtils.hasText(delivery.getDocumentFileName()); }
    public record PayrollDocument(byte[] bytes, String fileName) { }
    private static LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }
}
