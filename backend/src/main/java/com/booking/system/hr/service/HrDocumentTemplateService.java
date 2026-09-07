package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.importer.HrImportActor;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.security.MessageDigest;
import java.util.*;

@Service
@RequiredArgsConstructor
public class HrDocumentTemplateService {
    private final JdbcTemplate jdbc;
    public record Revision(String id, String kind, String fileName, String sha256, String note,
                           LocalDateTime createdAt, String actor, boolean active) { }
    public record TemplateFile(String fileName, byte[] bytes) { }
    public static String builtInName(String kind) {
        return switch (kind) {
            case "OFFICE" -> "employment-contract-office-template.docx";
            case "GENERAL_LABOR" -> "employment-contract-general-labor-template.docx";
            case "PROBATION" -> "probation-contract-template.docx";
            default -> throw HrApiException.badRequest("TEMPLATE_KIND_INVALID", "Loại mẫu không hợp lệ.");
        };
    }
    public static TemplateFile builtIn(String kind) {
        String name = builtInName(kind);
        try (var in = HrDocumentTemplateService.class.getResourceAsStream("/hr/templates/" + name)) {
            if (in == null) throw new IllegalStateException("Thiếu mẫu " + name);
            return new TemplateFile(name, in.readAllBytes());
        } catch (java.io.IOException e) { throw new IllegalStateException("Không đọc được mẫu.", e); }
    }
    @Transactional(readOnly = true)
    public List<Revision> list(String kind, int page) {
        builtInName(kind);
        return jdbc.query("""
            SELECT r.id, r.template_kind, r.file_name, r.file_sha256, r.note, r.created_at, r.created_by_actor,
                   CASE WHEN f.active_version_id = r.id THEN TRUE ELSE FALSE END AS active
            FROM hr_document_template_revisions r JOIN hr_document_template_families f ON f.template_kind=r.template_kind
            WHERE r.template_kind=? ORDER BY r.created_at DESC, r.id DESC LIMIT 20 OFFSET ?
            """, (rs, n) -> new Revision(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                rs.getTimestamp(6).toLocalDateTime(), rs.getString(7), rs.getBoolean(8)), kind, (long) Math.max(0, page) * 20);
    }
    @Transactional(readOnly = true)
    public TemplateFile active(String kind) {
        builtInName(kind);
        var files = jdbc.query("""
            SELECT r.file_name,r.content FROM hr_document_template_families f
            JOIN hr_document_template_revisions r ON r.id=f.active_version_id WHERE f.template_kind=?
            """, (rs,n) -> new TemplateFile(rs.getString(1),rs.getBytes(2)), kind);
        return files.isEmpty() ? builtIn(kind) : files.getFirst();
    }
    @Transactional(readOnly = true)
    public TemplateFile download(String kind, String id) {
        if ("builtin".equals(id)) return builtIn(kind);
        return jdbc.query("SELECT file_name,content FROM hr_document_template_revisions WHERE template_kind=? AND id=?",
                (rs,n) -> new TemplateFile(rs.getString(1),rs.getBytes(2)),kind,id).stream().findFirst()
                .orElseThrow(() -> HrApiException.notFound("TEMPLATE_NOT_FOUND", "Không tìm thấy phiên bản mẫu."));
    }
    @Transactional
    public String upload(String kind, String name, byte[] bytes, String note, HrImportActor actor) {
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".docx") || name.length() > 255) throw HrApiException.badRequest("TEMPLATE_FILE_INVALID", "Chọn file .docx có tên tối đa 255 ký tự.");
        if (note == null || note.isBlank() || note.length() > 1000) throw HrApiException.badRequest("TEMPLATE_NOTE_REQUIRED", "Nhập ghi chú thay đổi, tối đa 1000 ký tự.");
        Set<String> expected = HrDocxEngine.tokens(builtIn(kind).bytes());
        Set<String> actual = HrDocxEngine.tokens(bytes);
        if (!actual.equals(expected)) throw HrApiException.badRequest("TEMPLATE_TOKENS_INVALID", "Mẫu phải giữ đúng các biến: " + String.join(", ", expected));
        jdbc.queryForObject("SELECT template_kind FROM hr_document_template_families WHERE template_kind=? FOR UPDATE", String.class, kind);
        String hash = hash(bytes);
        var duplicate = jdbc.queryForList("SELECT id FROM hr_document_template_revisions WHERE template_kind=? AND file_sha256=?", String.class, kind, hash);
        if (!duplicate.isEmpty()) return duplicate.getFirst();
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO hr_document_template_revisions(id,template_kind,file_name,file_sha256,content,created_at,created_by_actor,note) VALUES(?,?,?,?,?,?,?,?)",
                id, kind, name, hash, bytes, LocalDateTime.now(ZoneOffset.UTC), actor.subject(), note.trim());
        return id;
    }
    @Transactional
    public void activate(String kind, String id, HrImportActor actor) {
        builtInName(kind);
        jdbc.queryForObject("SELECT template_kind FROM hr_document_template_families WHERE template_kind=? FOR UPDATE", String.class, kind);
        download(kind,id);
        jdbc.update("UPDATE hr_document_template_families SET active_version_id=? WHERE template_kind=?", "builtin".equals(id) ? null : id,kind);
        jdbc.update("INSERT INTO hr_audit_events(actor_subject,actor_display_name,actor_role,action,entity_type,entity_id,occurred_at) VALUES(?,?,?,?,?,?,?)",
                actor.subject(),actor.displayName(),actor.role(),"HR_DOCUMENT_TEMPLATE_ACTIVATED","HR_DOCUMENT_TEMPLATE", "builtin".equals(id) ? null : id,LocalDateTime.now(ZoneOffset.UTC));
    }
    public static String hash(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
