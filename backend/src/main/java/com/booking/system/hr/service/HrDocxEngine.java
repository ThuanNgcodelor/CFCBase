package com.booking.system.hr.service;

import com.booking.system.hr.api.HrApiException;
import org.w3c.dom.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.*;
import java.util.*;
import java.util.regex.Pattern;
import java.util.zip.*;

/** Replaces text across Word runs, preserving the surrounding paragraph and run formatting. */
public final class HrDocxEngine {
    public static final int MAX_BYTES = 15 * 1024 * 1024;
    private static final String W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final Pattern TOKEN = Pattern.compile("\\{\\{[A-Z0-9_]+}}");
    private HrDocxEngine() { }

    public static Set<String> tokens(byte[] bytes) {
        Set<String> tokens = new TreeSet<>();
        transform(bytes, null, tokens);
        return tokens;
    }
    public static byte[] fill(byte[] bytes, Map<String, String> values) {
        Set<String> tokens = tokens(bytes);
        if (tokens.isEmpty() || !values.keySet().containsAll(tokens)) {
            throw invalid("Mẫu không có biến hoặc chứa biến chưa được hỗ trợ: " + tokens.stream().filter(t -> !values.containsKey(t)).toList());
        }
        return transform(bytes, values, new TreeSet<>());
    }
    private static byte[] transform(byte[] bytes, Map<String, String> values, Set<String> tokens) {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_BYTES) throw invalid("File Word phải có dung lượng từ 1 byte đến 15 MB.");
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes)); var out = new ByteArrayOutputStream(); var result = new ZipOutputStream(out)) {
            int total = 0, entries = 0;
            boolean main = false, contentTypes = false;
            Set<String> names = new HashSet<>();
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (++entries > 2000 || !names.add(name) || name.contains("..") || name.startsWith("/") || name.toLowerCase(Locale.ROOT).contains("vbaproject")) throw invalid("Cấu trúc file Word không được hỗ trợ.");
                byte[] data = zip.readNBytes(50 * 1024 * 1024 - total + 1);
                total += data.length;
                if (total > 50 * 1024 * 1024) throw invalid("Nội dung giải nén Word quá lớn.");
                if (name.equals("[Content_Types].xml")) contentTypes = true;
                if (name.equals("word/document.xml")) main = true;
                if (name.startsWith("word/") && name.endsWith(".xml")) {
                    var factory = DocumentBuilderFactory.newInstance();
                    factory.setNamespaceAware(true);
                    factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
                    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
                    Document doc = factory.newDocumentBuilder().parse(new ByteArrayInputStream(data));
                    NodeList paragraphs = doc.getElementsByTagNameNS(W, "p");
                    for (int i = 0; i < paragraphs.getLength(); i++) {
                        Element p = (Element) paragraphs.item(i);
                        NodeList all = p.getElementsByTagNameNS(W, "t");
                        List<Element> textNodes = new ArrayList<>();
                        StringBuilder text = new StringBuilder();
                        for (int j = 0; j < all.getLength(); j++) {
                            Element t = (Element) all.item(j);
                            Node parent = t.getParentNode();
                            while (parent != null && !(W.equals(parent.getNamespaceURI()) && "p".equals(parent.getLocalName()))) parent = parent.getParentNode();
                            if (parent == p) { textNodes.add(t); text.append(t.getTextContent()); }
                        }
                        var matcher = TOKEN.matcher(text);
                        List<int[]> matches = new ArrayList<>();
                        List<String> keys = new ArrayList<>();
                        while (matcher.find()) { tokens.add(matcher.group()); matches.add(new int[]{matcher.start(), matcher.end()}); keys.add(matcher.group()); }
                        if (values == null) continue;
                        for (int k = matches.size() - 1; k >= 0; k--) {
                            int start = matches.get(k)[0], end = matches.get(k)[1], offset = 0;
                            for (Element t : textNodes) {
                                String old = t.getTextContent(); int next = offset + old.length();
                                if (next > start && offset < end) {
                                    String replacement = (offset <= start ? old.substring(0, start - offset) + values.get(keys.get(k)) : "")
                                            + (next >= end ? old.substring(end - offset) : "");
                                    t.setTextContent(replacement);
                                    t.setAttributeNS(XMLConstants.XML_NS_URI, "xml:space", "preserve");
                                }
                                offset = next;
                            }
                        }
                    }
                    if (values != null) {
                        var tf = TransformerFactory.newInstance(); tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, ""); tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
                        var xml = new ByteArrayOutputStream(); tf.newTransformer().transform(new DOMSource(doc), new StreamResult(xml)); data = xml.toByteArray();
                    }
                }
                result.putNextEntry(new ZipEntry(name)); result.write(data); result.closeEntry();
            }
            if (!main || !contentTypes) throw invalid("Đây không phải file Word .docx hợp lệ.");
            result.finish();
            if (out.size() > MAX_BYTES) throw invalid("File Word kết quả vượt quá 15 MB.");
            return out.toByteArray();
        } catch (HrApiException e) { throw e; }
        catch (Exception e) { throw invalid("Không đọc được file Word. Hãy lưu lại dưới dạng .docx và thử lại."); }
    }
    private static HrApiException invalid(String message) { return HrApiException.badRequest("DOCX_INVALID", message); }
}
