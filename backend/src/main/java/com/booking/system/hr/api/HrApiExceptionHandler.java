package com.booking.system.hr.api;

import com.booking.system.dto.ApiResponse;
import com.booking.system.hr.importer.HrBaselineImportException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.io.IOException;
import java.util.Set;

@RestControllerAdvice(assignableTypes = {
        HrActivityController.class,
        HrImportController.class,
        HrManagementController.class,
        HrWorkforceController.class
})
public class HrApiExceptionHandler {

    private static final Set<String> CONFLICT_CODES = Set.of(
            "BASELINE_ROSTER_ALREADY_EXISTS",
            "BATCH_ALREADY_CONFIRMED",
            "BATCH_NOT_PARSED",
            "BATCH_NOT_VALIDATED",
            "BATCH_NOT_CONFIRMED",
            "CONFIRMATION_KEY_ALREADY_USED",
            "EMPLOYEE_CODE_ALREADY_EXISTS",
            "INVALID_ROWS_BLOCK_CONFIRM",
            "PAYLOAD_PURGED",
            "ROLLBACK_GUARD_FAILED",
            "ROLLBACK_HAS_DOWNSTREAM_DATA",
            "STAGING_NOT_READY",
            "STAGING_ROW_COUNT_MISMATCH",
            "WARNINGS_REQUIRE_ACKNOWLEDGEMENT",
            "WORKFORCE_BOOTSTRAP_POSTCONDITION_FAILED",
            "WORKFORCE_SNAPSHOT_ALREADY_APPLIED",
            "WORKFORCE_SNAPSHOT_EMPLOYEE_MISSING",
            "WORKFORCE_SNAPSHOT_HISTORY_INCONSISTENT",
            "WORKFORCE_SNAPSHOT_NOT_APPLICABLE",
            "WORKFORCE_SNAPSHOT_POSTCONDITION_FAILED",
            "WORKFORCE_SNAPSHOT_ROSTER_ALREADY_EXISTS",
            "WORKFORCE_SNAPSHOT_SOURCE_ROSTER_INVALID"
    );

    @ExceptionHandler(HrBaselineImportException.class)
    public ResponseEntity<ApiResponse<Void>> handleImportFailure(HrBaselineImportException exception) {
        HttpStatus status;
        if ("BATCH_NOT_FOUND".equals(exception.getCode())) {
            status = HttpStatus.NOT_FOUND;
        } else if (CONFLICT_CODES.contains(exception.getCode())) {
            status = HttpStatus.CONFLICT;
        } else {
            status = HttpStatus.BAD_REQUEST;
        }
        return error(status, exception.getMessage());
    }

    @ExceptionHandler(HrApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApiFailure(HrApiException exception) {
        return error(exception.status(), exception.getMessage());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> handleOptimisticConflict() {
        return error(HttpStatus.CONFLICT,
                "Dữ liệu đã được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataConflict() {
        return error(HttpStatus.CONFLICT,
                "Dữ liệu bị trùng hoặc đang được hồ sơ khác sử dụng.");
    }

    @ExceptionHandler({
            IllegalArgumentException.class,
            ConstraintViolationException.class,
            HttpMessageNotReadableException.class,
            MethodArgumentNotValidException.class,
            MissingServletRequestPartException.class,
            MultipartException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(Exception exception) {
        String message = exception instanceof MethodArgumentNotValidException validationException
                ? validationException.getBindingResult().getFieldErrors().stream()
                        .findFirst()
                        .map(fieldError -> fieldError.getDefaultMessage())
                        .orElse("Dữ liệu yêu cầu không hợp lệ.")
                : safeBadRequestMessage(exception);
        return error(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleUploadTooLarge() {
        return error(HttpStatus.BAD_REQUEST, "File upload vượt quá dung lượng cho phép.");
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiResponse<Void>> handleUploadReadFailure() {
        return error(HttpStatus.BAD_REQUEST, "Không thể đọc file upload.");
    }

    private static String safeBadRequestMessage(Exception exception) {
        if (exception instanceof IllegalArgumentException && exception.getMessage() != null) {
            return exception.getMessage();
        }
        return "Dữ liệu yêu cầu không hợp lệ.";
    }

    private static ResponseEntity<ApiResponse<Void>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(ApiResponse.error(status.value(), message));
    }
}
