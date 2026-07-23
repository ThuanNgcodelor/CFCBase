package com.booking.system.hr.importer;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Isolated JSON codec for HR staging, audit and monthly snapshot payloads.
 *
 * <p>The project currently uses Jackson 2 directly while Spring Boot 4 no
 * longer brings Jackson 2's JSR-310 module into this application's classpath.
 * Keep the import contract self-contained and persist dates as ISO-8601
 * strings without requiring or changing a shared application ObjectMapper.</p>
 */
@Component
public class HrImportJsonCodec {

    private final ObjectMapper mapper;

    public HrImportJsonCodec() {
        this.mapper = new ObjectMapper();
        SimpleModule module = new SimpleModule("hr-import-local-date");
        module.addSerializer(LocalDate.class, new LocalDateIsoSerializer());
        module.addDeserializer(LocalDate.class, new LocalDateIsoDeserializer());
        this.mapper.registerModule(module);
    }

    public String write(Object value) throws JsonProcessingException {
        return mapper.writeValueAsString(value);
    }

    public <T> T read(String value, Class<T> type) throws JsonProcessingException {
        return mapper.readValue(unwrapJsonString(value), type);
    }

    public <T> T read(String value, TypeReference<T> type) throws JsonProcessingException {
        return mapper.readValue(unwrapJsonString(value), type);
    }

    private String unwrapJsonString(String value) throws JsonProcessingException {
        // H2's MySQL compatibility mode returns a JSON column containing a
        // pre-serialized String as a JSON scalar. MySQL returns the object
        // text directly. Hibernate can also add one nesting level when a
        // loaded JSON scalar is updated. Accept the bounded equivalent forms
        // so the same contract is verified on H2 and MySQL.
        String current = value;
        for (int depth = 0; depth < 8; depth++) {
            JsonNode root = mapper.readTree(current);
            if (root == null || !root.isTextual()) return current;
            current = root.textValue();
        }
        return current;
    }

    private static final class LocalDateIsoSerializer extends JsonSerializer<LocalDate> {
        @Override
        public void serialize(LocalDate value, JsonGenerator generator, SerializerProvider serializers)
                throws IOException {
            generator.writeString(DateTimeFormatter.ISO_LOCAL_DATE.format(value));
        }
    }

    private static final class LocalDateIsoDeserializer extends JsonDeserializer<LocalDate> {
        @Override
        public LocalDate deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            return LocalDate.parse(parser.getValueAsString(), DateTimeFormatter.ISO_LOCAL_DATE);
        }
    }
}
