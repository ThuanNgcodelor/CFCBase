package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.importer.HrImportActor;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.io.*;
import java.nio.file.Files;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** DB owns the snapshot. WebSocket delivers invalidations only, never documents/PII. */
@Service
public class HrOcrCaptureService {
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final HrOcrService ocr;
    private final SimpMessagingTemplate messaging;
    private final ObjectMapper json = new ObjectMapper();
    private final long ttlMinutes;
    private final ExecutorService workers = new ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(8), Thread.ofPlatform().daemon().name("hr-ocr-capture-", 0).factory(),
            new ThreadPoolExecutor.AbortPolicy());

    public HrOcrCaptureService(JdbcTemplate jdbc, TransactionTemplate tx, HrOcrService ocr,
                              SimpMessagingTemplate messaging,
                              @Value("${app.hr.ocr-capture.ttl-minutes:${HR_OCR_CAPTURE_TTL_MINUTES:30}}") long ttlMinutes) {
        this.jdbc = jdbc; this.tx = tx; this.ocr = ocr; this.messaging = messaging;
        this.ttlMinutes = Math.max(5, Math.min(120, ttlMinutes));
    }

    public record ImageInfo(String id, String kind) {}
    public record Snapshot(String id, String status, long revision, boolean paired, String expiresAt,
                           List<ImageInfo> images, Map<String, Object> result, String error) {}
    public record ImageFile(String type, byte[] bytes) {}
    private record Session(String id, String owner, String status, long revision, boolean paired,
                           String result, String error, String runId, LocalDateTime expiresAt) {}
    private record Run(String id, String runId) {}

    public Snapshot open(String id, HrImportActor actor) {
        uuid(id);
        return tx.execute(ignored -> {
            var existing = jdbc.query("SELECT * FROM hr_ocr_capture_sessions WHERE id=?", this::session, id);
            if (!existing.isEmpty()) return snapshot(owned(id, actor));
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM hr_ocr_capture_sessions WHERE owner_subject=? AND expires_at>? AND status NOT IN ('CANCELLED','COMPLETED')", Integer.class, actor.subject(), now());
            if (count != null && count >= 5) throw HrApiException.conflict("CAPTURE_LIMIT", "Đã có 5 phiên chụp. Hãy hủy phiên cũ hoặc chờ hết hạn.");
            jdbc.update("INSERT INTO hr_ocr_capture_sessions(id,owner_subject,status,created_at,expires_at) VALUES(?,?,'OPEN',?,?)",
                    id, actor.subject(), now(), now().plusMinutes(ttlMinutes));
            return snapshot(owned(id, actor));
        });
    }

    public Snapshot get(String id, HrImportActor actor) {
        return tx.execute(ignored -> snapshot(owned(id, actor)));
    }

    public Snapshot pair(String id, HrImportActor actor) {
        return tx.execute(ignored -> {
            Session s = editable(id, actor);
            if (!s.paired()) {
                jdbc.update("UPDATE hr_ocr_capture_sessions SET paired=TRUE,revision=revision+1 WHERE id=?", id);
                changed(s);
            }
            return snapshot(owned(id, actor));
        });
    }

    public Snapshot upload(String id, String clientId, String kind, MultipartFile file, HrImportActor actor) throws IOException {
        uuid(clientId);
        if (!Set.of("FRONT", "BACK", "OTHER").contains(kind)) throw HrApiException.badRequest("CAPTURE_KIND", "Loại ảnh không hợp lệ.");
        // Ownership is checked before decoding/reading large untrusted content.
        tx.execute(ignored -> editable(id, actor));
        if (file == null || file.isEmpty() || file.getSize() > MAX_IMAGE_BYTES)
            throw HrApiException.badRequest("CAPTURE_SIZE", "Mỗi ảnh tối đa 5 MB.");
        byte[] bytes = file.getBytes();
        String type = validateImage(bytes);
        String hash = HrDocumentTemplateService.hash(bytes);
        return tx.execute(ignored -> {
            Session s = editable(id, actor);
            var duplicate = jdbc.query("SELECT sha256,kind,content IS NULL AS removed FROM hr_ocr_capture_images WHERE session_id=? AND client_id=?",
                    (rs,n) -> Map.of("hash", rs.getString(1), "kind", rs.getString(2), "removed", rs.getBoolean(3)), id, clientId);
            if (!duplicate.isEmpty()) {
                var receipt = duplicate.getFirst();
                if (!hash.equals(receipt.get("hash")) || !kind.equals(receipt.get("kind"))) throw HrApiException.conflict("CAPTURE_RETRY", "Lượt tải này đã dùng cho ảnh khác.");
                if (Boolean.TRUE.equals(receipt.get("removed"))) throw HrApiException.conflict("CAPTURE_REMOVED", "Ảnh của lượt gửi này đã bị bỏ hoặc thay thế. Hãy bỏ ảnh chờ gửi và chụp lại.");
                return snapshot(s);
            }
            Integer receipts = jdbc.queryForObject("SELECT COUNT(*) FROM hr_ocr_capture_images WHERE session_id=?", Integer.class, id);
            if (receipts != null && receipts >= 60) throw HrApiException.conflict("CAPTURE_UPLOAD_LIMIT", "Phiên đã nhận 60 lượt chụp. Hãy kết thúc và tạo phiên mới.");
            // Keep a content-free receipt until session expiry: delayed retries cannot resurrect removed photos.
            if (!"OTHER".equals(kind)) jdbc.update("UPDATE hr_ocr_capture_images SET content=NULL WHERE session_id=? AND kind=?", id, kind);
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM hr_ocr_capture_images WHERE session_id=? AND content IS NOT NULL", Integer.class, id);
            if (count != null && count >= 6) throw HrApiException.badRequest("CAPTURE_IMAGES", "Tối đa 6 ảnh mỗi hồ sơ.");
            jdbc.update("INSERT INTO hr_ocr_capture_images(id,session_id,client_id,kind,content_type,sha256,content,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    UUID.randomUUID().toString(), id, clientId, kind, type, hash, bytes, now());
            invalidate(s);
            return snapshot(owned(id, actor));
        });
    }

    public Snapshot remove(String id, String imageId, HrImportActor actor) {
        return tx.execute(ignored -> {
            Session s = editable(id, actor);
            if (jdbc.update("UPDATE hr_ocr_capture_images SET content=NULL WHERE session_id=? AND id=? AND content IS NOT NULL", id, imageId) > 0) invalidate(s);
            return snapshot(owned(id, actor));
        });
    }

    public ImageFile image(String id, String imageId, HrImportActor actor) {
        return tx.execute(ignored -> {
            editable(id, actor);
            return jdbc.query("SELECT content_type,content FROM hr_ocr_capture_images WHERE session_id=? AND id=? AND content IS NOT NULL",
                    (rs, n) -> new ImageFile(rs.getString(1), rs.getBytes(2)), id, imageId).stream().findFirst()
                    .orElseThrow(() -> HrApiException.notFound("CAPTURE_IMAGE", "Ảnh đã được xóa hoặc thay thế."));
        });
    }

    public Snapshot scan(String id, long revision, HrImportActor actor) {
        Run run = tx.execute(ignored -> {
            Session s = editable(id, actor);
            if (s.revision() != revision) throw HrApiException.conflict("CAPTURE_CHANGED", "Bộ ảnh vừa thay đổi. Kiểm tra lại trước khi đọc.");
            if (Set.of("SCANNING", "READY").contains(s.status())) return null;
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM hr_ocr_capture_images WHERE session_id=? AND content IS NOT NULL", Integer.class, id);
            if (count == null || count == 0) throw HrApiException.badRequest("CAPTURE_EMPTY", "Chụp ít nhất một ảnh trước khi đọc.");
            String runId = UUID.randomUUID().toString();
            jdbc.update("UPDATE hr_ocr_capture_sessions SET status='SCANNING',revision=revision+1,run_id=?,run_started_at=?,error_message=NULL WHERE id=?", runId, now(), id);
            changed(s);
            return new Run(id, runId);
        });
        if (run != null) {
            try { workers.execute(() -> execute(run, actor)); }
            catch (RejectedExecutionException e) { finish(run, actor, null, "OCR đang bận. Vui lòng thử lại sau."); }
        }
        return get(id, actor);
    }

    private void execute(Run run, HrImportActor actor) {
        try {
            // Do not queue PII in memory or send a cancelled/expired queued job to the provider.
            List<MultipartFile> files = tx.execute(ignored -> {
                var sessions = jdbc.query("SELECT * FROM hr_ocr_capture_sessions WHERE id=? FOR UPDATE", this::session, run.id());
                if (sessions.isEmpty()) return null;
                Session s = sessions.getFirst();
                if (!"SCANNING".equals(s.status()) || !Objects.equals(s.runId(), run.runId())
                        || !s.expiresAt().isAfter(now()) || !s.owner().equals(actor.subject())) return null;
                return jdbc.query("SELECT content_type,content FROM hr_ocr_capture_images WHERE session_id=? AND content IS NOT NULL ORDER BY created_at,id",
                        (rs,n) -> new StoredImage(rs.getString(1), rs.getBytes(2)), run.id());
            });
            if (files == null) return;
            var result = json.valueToTree(ocr.extractProfile(files, actor));
            // Raw provider output is not needed for form filling or cross-device delivery.
            ((com.fasterxml.jackson.databind.node.ObjectNode) result).remove("rawOcrText");
            finish(run, actor, json.writeValueAsString(result), null);
        } catch (Exception e) {
            // Do not persist/log provider bodies, keys or identity data.
            finish(run, actor, null, "Không đọc được hồ sơ. Kiểm tra ảnh và cấu hình OCR, rồi thử lại.");
        }
    }

    private void finish(Run run, HrImportActor actor, String result, String error) {
        tx.executeWithoutResult(ignored -> {
            var rows = jdbc.query("SELECT * FROM hr_ocr_capture_sessions WHERE id=? FOR UPDATE", this::session, run.id());
            if (rows.isEmpty()) return;
            Session s = rows.getFirst();
            if (!"SCANNING".equals(s.status()) || !Objects.equals(s.runId(), run.runId())
                    || !s.expiresAt().isAfter(now()) || !s.owner().equals(actor.subject())) return;
            jdbc.update("UPDATE hr_ocr_capture_sessions SET status=?,result_json=?,error_message=?,run_id=NULL,revision=revision+1 WHERE id=?",
                    error == null ? "READY" : "FAILED", result, error, run.id());
            changed(s);
        });
    }

    public Snapshot close(String id, boolean completed, HrImportActor actor) {
        return tx.execute(ignored -> {
            Session s = owned(id, actor);
            if (!Set.of("CANCELLED", "COMPLETED").contains(s.status())) {
                jdbc.update("DELETE FROM hr_ocr_capture_images WHERE session_id=?", id);
                jdbc.update("UPDATE hr_ocr_capture_sessions SET status=?,result_json=NULL,error_message=NULL,run_id=NULL,revision=revision+1 WHERE id=?",
                        completed ? "COMPLETED" : "CANCELLED", id);
                changed(s);
            }
            return snapshot(owned(id, actor));
        });
    }

    private void invalidate(Session s) {
        jdbc.update("UPDATE hr_ocr_capture_sessions SET status='OPEN',result_json=NULL,error_message=NULL,run_id=NULL,revision=revision+1 WHERE id=?", s.id());
        changed(s);
    }

    private Session owned(String id, HrImportActor actor) {
        uuid(id);
        Session s = jdbc.query("SELECT * FROM hr_ocr_capture_sessions WHERE id=? FOR UPDATE", this::session, id).stream().findFirst()
                .orElseThrow(() -> HrApiException.notFound("CAPTURE_MISSING", "Không tìm thấy phiên chụp. Hãy tạo QR mới trên máy tính."));
        if (!s.owner().equals(actor.subject())) throw new HrApiException(HttpStatus.FORBIDDEN, "CAPTURE_OWNER", "Điện thoại phải đăng nhập cùng tài khoản với máy tính đã tạo QR.");
        if (!s.expiresAt().isAfter(now())) throw new HrApiException(HttpStatus.GONE, "CAPTURE_EXPIRED", "Phiên chụp đã hết hạn. Hãy tạo QR mới trên máy tính.");
        return s;
    }

    private Session editable(String id, HrImportActor actor) {
        Session s = owned(id, actor);
        if (Set.of("CANCELLED", "COMPLETED").contains(s.status())) throw HrApiException.conflict("CAPTURE_CLOSED", "Phiên chụp đã kết thúc, không nhận thêm ảnh.");
        return s;
    }

    private Session session(ResultSet rs, int row) throws SQLException {
        return new Session(rs.getString("id"), rs.getString("owner_subject"), rs.getString("status"),
                rs.getLong("revision"), rs.getBoolean("paired"), rs.getString("result_json"), rs.getString("error_message"),
                rs.getString("run_id"), rs.getTimestamp("expires_at").toLocalDateTime());
    }

    private Snapshot snapshot(Session s) {
        Map<String, Object> result = null;
        try { if (s.result() != null) result = json.readValue(s.result(), new com.fasterxml.jackson.core.type.TypeReference<>() {}); }
        catch (IOException e) { throw new IllegalStateException("Không đọc được kết quả OCR đã lưu."); }
        var images = jdbc.query("SELECT id,kind FROM hr_ocr_capture_images WHERE session_id=? AND content IS NOT NULL ORDER BY created_at,id",
                (rs,n) -> new ImageInfo(rs.getString(1),rs.getString(2)), s.id());
        return new Snapshot(s.id(), s.status(), s.revision(), s.paired(), s.expiresAt().atOffset(ZoneOffset.UTC).toString(), images, result, s.error());
    }

    private void changed(Session s) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {
                    if (s.owner().startsWith("USER:")) messaging.convertAndSendToUser(s.owner().substring(5), "/queue/ocr-capture", Map.of("sessionId", s.id()));
                } catch (RuntimeException ignored) { /* Snapshot polling recovers delivery failure. */ }
            }
        });
    }

    @Scheduled(fixedDelay = 60000)
    public void cleanup() {
        tx.executeWithoutResult(ignored -> {
            // FK cascade removes temporary photos. Completed/cancelled sessions already have no PII.
            jdbc.update("DELETE FROM hr_ocr_capture_sessions WHERE expires_at<=?", now());
            jdbc.update("UPDATE hr_ocr_capture_sessions SET status='FAILED',run_id=NULL,revision=revision+1,error_message=? WHERE status='SCANNING' AND run_started_at<?",
                    "OCR bị gián đoạn. Vui lòng thử đọc lại.", now().minusMinutes(3));
        });
    }

    @PreDestroy public void shutdown() {
        workers.shutdownNow();
        try { workers.awaitTermination(5, TimeUnit.SECONDS); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
    private static LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }
    private static void uuid(String value) {
        if (value == null || !value.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))
            throw HrApiException.badRequest("CAPTURE_ID", "Mã phiên/lượt chụp không hợp lệ.");
    }
    private static String validateImage(byte[] bytes) throws IOException {
        if (bytes.length > MAX_IMAGE_BYTES) throw HrApiException.badRequest("CAPTURE_SIZE", "Mỗi ảnh tối đa 5 MB.");
        try (var input = new javax.imageio.stream.MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw HrApiException.badRequest("CAPTURE_FORMAT", "Chọn ảnh JPEG hoặc PNG rõ nét.");
            var reader = readers.next();
            try {
                reader.setInput(input);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!Set.of("jpeg", "png").contains(format) || (long) reader.getWidth(0) * reader.getHeight(0) > 25_000_000)
                    throw HrApiException.badRequest("CAPTURE_FORMAT", "Chọn ảnh JPEG/PNG tối đa 25 megapixel.");
                if (reader.read(0) == null) throw new IOException("Invalid image");
                return "jpeg".equals(format) ? "image/jpeg" : "image/png";
            } finally { reader.dispose(); }
        }
    }

    private record StoredImage(String type, byte[] bytes) implements MultipartFile {
        public String getName() { return "files"; }
        public String getOriginalFilename() { return "capture." + (type.equals("image/png") ? "png" : "jpg"); }
        public String getContentType() { return type; }
        public boolean isEmpty() { return bytes.length == 0; }
        public long getSize() { return bytes.length; }
        public byte[] getBytes() { return bytes; }
        public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
        public void transferTo(File dest) throws IOException { Files.write(dest.toPath(), bytes); }
    }
}
