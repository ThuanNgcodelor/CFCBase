package com.booking.system.hr.api.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record HrPageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    public HrPageResponse {
        content = List.copyOf(content);
    }

    public static <S, T> HrPageResponse<T> from(Page<S> source, Function<S, T> mapper) {
        return new HrPageResponse<>(
                source.getContent().stream().map(mapper).toList(),
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.isFirst(),
                source.isLast()
        );
    }
}
