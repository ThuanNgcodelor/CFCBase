package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import com.booking.system.hr.importer.HrImportActor;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class HrWordEditorService {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final HrWordEditorSettings settings;
    private final HrWordEditorTokens tokens;
    private final HrWordEditorDownload download;
    private final HrDocumentTemplateService templates;
    private final HrEmploymentContractDocumentService contracts;
    public record Session(String id, String type, String kind, String sourceId, String fileName, String owner,
                          String ownerName, String role, String status, String resultId, LocalDateTime expiresAt) { }
    public record OpenRequest(String type, String kind, String sourceId, String draftId) { }
    public record OpenResponse(String id, String scriptUrl, Map<String,Object> config) { }

    public OpenResponse open(OpenRequest request, HrImportActor actor) {
        settings.requireConfigured();
        return tx.execute(status -> {
            String type=request.type(), kind=request.kind(), source=request.sourceId(), name;
            byte[] bytes;
            if (request.draftId() != null) {
                var old=owned(request.draftId(),actor);
                if (!List.of("READY", "UNCHANGED").contains(old.status())) throw conflict("Bản nháp chưa sẵn sàng để mở lại.");
                type=old.type(); kind=old.kind(); source=old.sourceId(); name=old.fileName(); bytes=content(old.id());
            } else if ("TEMPLATE".equals(type)) {
                HrDocumentTemplateService.builtInName(kind);
                var file="active".equals(source) ? templates.active(kind) : templates.download(kind,source);
                name=file.fileName(); bytes=file.bytes();
            } else if ("CONTRACT".equals(type)) {
                var file=contracts.download(source); name=file.fileName(); bytes=file.bytes(); kind=null;
            } else throw conflict("Loại tài liệu không được hỗ trợ.");
            String id=UUID.randomUUID().toString(); var now=LocalDateTime.now(ZoneOffset.UTC);
            jdbc.update("INSERT INTO hr_word_editor_sessions(id,target_type,template_kind,source_id,file_name,content,owner_subject,owner_name,owner_role,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,'OPEN',?,?)",
                    id,type,kind,source,name,bytes,actor.subject(),actor.displayName(),actor.role(),now,now.plusDays(1));
            return configuration(owned(id,actor));
        });
    }
    public OpenResponse resume(String id,HrImportActor actor) {
        settings.requireConfigured(); var session=owned(id,actor); requireLive(session);
        if (!"OPEN".equals(session.status())) throw conflict("Phiên sửa đã kết thúc; hãy xem bản đã lưu hoặc mở phiên mới.");
        return configuration(session);
    }
    private OpenResponse configuration(Session s) {
        String root=settings.backendOrigin()+"/api/v1/word-editor/"+s.id();
        Map<String,Object> config=new LinkedHashMap<>();
        config.put("documentType","word"); config.put("width","100%"); config.put("height","100%");
        config.put("document",Map.of("fileType","docx","key",s.id(),"title",s.fileName(),
                "url",root+"/content?ticket="+tokens.sign(Map.of("purpose","word-content","session",s.id())),
                "permissions",Map.of("edit",true,"download",false,"print",false)));
        config.put("editorConfig",Map.of("mode","edit","lang","vi","callbackUrl",root+"/callback",
                "user",Map.of("id",s.id(),"name",s.ownerName()==null ? "Nhân sự" : s.ownerName()),
                "customization",Map.of("forcesave",false,"autosave",true)));
        config.put("token",tokens.sign(config));
        return new OpenResponse(s.id(),settings.serverOrigin()+"/web-apps/apps/api/documents/api.js",config);
    }
    public Session owned(String id,HrImportActor actor) {
        var s=find(id);
        if (!s.owner().equals(actor.subject())) throw HrApiException.notFound("WORD_SESSION_NOT_FOUND","Không tìm thấy phiên sửa của bạn.");
        return s;
    }
    private Session find(String id) {
        return jdbc.query("SELECT id,target_type,template_kind,source_id,file_name,owner_subject,owner_name,owner_role,status,result_id,expires_at FROM hr_word_editor_sessions WHERE id=?",
                (rs,n)->new Session(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getString(9),rs.getString(10),rs.getTimestamp(11).toLocalDateTime()),id)
                .stream().findFirst().orElseThrow(()->HrApiException.notFound("WORD_SESSION_NOT_FOUND","Không tìm thấy phiên sửa."));
    }
    private byte[] content(String id) { return jdbc.queryForObject("SELECT content FROM hr_word_editor_sessions WHERE id=?",byte[].class,id); }
    public byte[] source(String id,String ticket) {
        var claims=tokens.verify(ticket);
        if (!"word-content".equals(claims.get("purpose")) || !id.equals(claims.get("session"))) throw new IllegalArgumentException("Invalid ticket");
        var s=find(id); requireLive(s);
        if (!"OPEN".equals(s.status())) throw new IllegalArgumentException("Closed session");
        return content(id);
    }
    public byte[] draft(String id,HrImportActor actor) { owned(id,actor); return content(id); }

    /** Only signed callback claims are consumed; unsigned request fields are never trusted. */
    public void callback(String id,String token) throws Exception {
        var claims=tokens.verify(token);
        // ONLYOFFICE uses payload wrapper for header JWT and direct fields for body JWT.
        Map<?,?> payload=claims.get("payload") instanceof Map<?,?> p ? p : claims;
        if (!id.equals(payload.get("key")) || !(payload.get("status") instanceof Number number)) throw new IllegalArgumentException("Invalid callback");
        int status=number.intValue(); var s=find(id); requireLive(s);
        if (List.of("READY","PUBLISHED","CANCELLED").contains(s.status())) return; // replay cannot overwrite a final save or cancelled session
        if (status==1 || status==6 || status==7) return; // force-save is disabled; final save owns the revision
        if (status==4) { jdbc.update("UPDATE hr_word_editor_sessions SET status='UNCHANGED' WHERE id=? AND status='OPEN'",id); return; }
        if (status!=2) throw new IllegalArgumentException("Document save failed");
        if (!(payload.get("url") instanceof String url)) throw new IllegalArgumentException("Missing file URL");
        byte[] bytes=download.fetch(url);
        // Conditional update means two simultaneous callbacks cannot overwrite one another.
        jdbc.update("UPDATE hr_word_editor_sessions SET content=?,status='READY' WHERE id=? AND status IN ('OPEN','UNCHANGED')",bytes,id);
    }
    public String publish(String id,String note,HrImportActor actor) {
        return tx.execute(status -> {
            jdbc.queryForObject("SELECT id FROM hr_word_editor_sessions WHERE id=? FOR UPDATE",String.class,id);
            var s=owned(id,actor);
            if ("PUBLISHED".equals(s.status())) return s.resultId();
            if (!List.of("READY","UNCHANGED").contains(s.status())) throw conflict("Chưa nhận được bản Word cuối từ Document Server. Vui lòng chờ lưu xong.");
            byte[] bytes=content(id);
            String result;
            if ("TEMPLATE".equals(s.type())) {
                result=templates.upload(s.kind(),s.fileName(),bytes,note,actor);
                templates.activate(s.kind(),result,actor);
            } else {
                result=contracts.uploadRevision(s.sourceId(),s.fileName(),bytes,note,actor).id();
            }
            jdbc.update("UPDATE hr_word_editor_sessions SET status='PUBLISHED',result_id=? WHERE id=?",result,id);
            return result;
        });
    }
    public void cancel(String id,HrImportActor actor) {
        tx.executeWithoutResult(status -> {
            jdbc.queryForObject("SELECT id FROM hr_word_editor_sessions WHERE id=? FOR UPDATE",String.class,id);
            var s=owned(id,actor);
            if ("PUBLISHED".equals(s.status())) throw conflict("Phiên bản đã được lưu nên không thể hủy.");
            if (!"CANCELLED".equals(s.status())) {
                jdbc.update("UPDATE hr_word_editor_sessions SET status='CANCELLED' WHERE id=?",id);
            }
        });
    }
    private void requireLive(Session s) { if (s.expiresAt().isBefore(LocalDateTime.now(ZoneOffset.UTC))) throw conflict("Phiên sửa hết hạn sau 24 giờ. Bản đã nhận vẫn được giữ để đối chiếu."); }
    private static HrApiException conflict(String message) { return HrApiException.conflict("WORD_EDITOR_STATE",message); }
}
