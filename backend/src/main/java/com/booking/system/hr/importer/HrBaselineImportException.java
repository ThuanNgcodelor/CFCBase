package com.booking.system.hr.importer;

public class HrBaselineImportException extends RuntimeException {

    private final String code;

    public HrBaselineImportException(String code, String message) {
        super(message);
        this.code = code;
    }

    public HrBaselineImportException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
