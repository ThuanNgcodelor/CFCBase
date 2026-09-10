package com.booking.system.hr.service;

import org.springframework.messaging.simp.stomp.StompCommand;

/** Keeps broker-resolved OCR queues private without changing existing exact notification routes. */
public final class HrOcrSocketPolicy {
    private HrOcrSocketPolicy() {}
    public static boolean allowed(StompCommand command, String destination) {
        if (command != StompCommand.SUBSCRIBE && command != StompCommand.SEND) return true;
        if (destination == null) return false;
        // Wildcard subscriptions can otherwise match a broker-resolved private OCR queue.
        if (destination.contains("*") || destination.contains("#")) return false;
        if (!destination.contains("ocr-capture")) return true;
        return command == StompCommand.SUBSCRIBE && "/user/queue/ocr-capture".equals(destination);
    }
}
