package com.booking.system.hr.api;

import org.springframework.http.HttpStatus;

public class HrApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public HrApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public static HrApiException badRequest(String code, String message) {
        return new HrApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static HrApiException notFound(String code, String message) {
        return new HrApiException(HttpStatus.NOT_FOUND, code, message);
    }

    public static HrApiException conflict(String code, String message) {
        return new HrApiException(HttpStatus.CONFLICT, code, message);
    }
}
