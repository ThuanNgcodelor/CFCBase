#!/usr/bin/env python3
"""Distill two PII-free runtime templates from the approved HDLD.docx reference.

The source file is a 49-contract reference bundle and must never be shipped as a
runtime resource. This script copies one approved structural block for each
workforce group, removes all other contracts, and replaces employee data with
contiguous OOXML placeholders consumed by the backend renderer.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


EXPECTED_SOURCE_SHA256 = "c9db4d20f1525c8b538971152783591012babce9ea95cee7f648945f2613fd00"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W_P = f"{{{W_NS}}}p"
W_T = f"{{{W_NS}}}t"
W_BODY = f"{{{W_NS}}}body"
W_SECT_PR = f"{{{W_NS}}}sectPr"
W_P_PR = f"{{{W_NS}}}pPr"

VARIANTS = {
    "office": {
        "anchor": "PHAN THỊ NGỌC THƠ",
        "file_name": "employment-contract-office-template.docx",
    },
    "general-labor": {
        "anchor": "LƯƠNG NGUYỄN PHÚC THỊNH",
        "file_name": "employment-contract-general-labor-template.docx",
    },
}

REQUIRED_PLACEHOLDERS = {
    "{{CONTRACT_NUMBER}}",
    "{{SIGN_DAY}}",
    "{{SIGN_MONTH}}",
    "{{SIGN_YEAR}}",
    "{{EMPLOYEE_TITLE}}",
    "{{FULL_NAME}}",
    "{{NATIONALITY}}",
    "{{DATE_OF_BIRTH}}",
    "{{BIRTH_PLACE}}",
    "{{PERMANENT_ADDRESS}}",
    "{{CITIZEN_ID}}",
    "{{CITIZEN_ID_ISSUED_DATE}}",
    "{{CITIZEN_ID_ISSUED_PLACE}}",
    "{{CONTRACT_TYPE}}",
    "{{CONTRACT_PERIOD}}",
    "{{DEPARTMENT_NAME}}",
    "{{POSITION_NAME}}",
    "{{JOB_DESCRIPTION}}",
    "{{WORKPLACE}}",
    "{{BASE_SALARY_TEXT}}",
    "{{ALLOWANCE_TEXT}}",
    "{{SALARY_NOTE}}",
    "{{DEPARTMENT_RULE_NOTE}}",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def register_namespaces(xml: bytes) -> None:
    seen: set[tuple[str, str]] = set()
    for _, (prefix, uri) in ET.iterparse(io.BytesIO(xml), events=("start-ns",)):
        key = (prefix or "", uri)
        if key in seen:
            continue
        seen.add(key)
        ET.register_namespace(prefix or "", uri)


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.iter(W_T))


def set_paragraph_text(paragraph: ET.Element, value: str) -> None:
    text_nodes = list(paragraph.iter(W_T))
    if not text_nodes:
        run = ET.SubElement(paragraph, f"{{{W_NS}}}r")
        text_nodes = [ET.SubElement(run, W_T)]
    text_nodes[0].text = value
    if value.startswith(" ") or value.endswith(" "):
        text_nodes[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for node in text_nodes[1:]:
        node.text = ""


def empty_paragraph(paragraph: ET.Element) -> None:
    for child in list(paragraph):
        if child.tag != W_P_PR:
            paragraph.remove(child)


def contract_ranges(body: ET.Element) -> list[tuple[int, int]]:
    children = list(body)
    starts = [
        index
        for index, child in enumerate(children)
        if child.tag == W_P and paragraph_text(child).strip() == "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"
    ]
    section_index = next((index for index, child in enumerate(children) if child.tag == W_SECT_PR), len(children))
    return [
        (start, starts[index + 1] if index + 1 < len(starts) else section_index)
        for index, start in enumerate(starts)
    ]


def select_contract(body: ET.Element, anchor: str) -> list[ET.Element]:
    children = list(body)
    matches: list[list[ET.Element]] = []
    for start, end in contract_ranges(body):
        block = children[start:end]
        text = "\n".join(paragraph_text(child) for child in block if child.tag == W_P)
        if anchor in text:
            matches.append(block)
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one source contract containing {anchor!r}, found {len(matches)}")
    return matches[0]


def find_paragraph_index(paragraphs: list[ET.Element], predicate, description: str) -> int:
    matches = [index for index, paragraph in enumerate(paragraphs) if predicate(paragraph_text(paragraph).strip())]
    if len(matches) != 1:
        raise ValueError(f"Expected one paragraph for {description}, found {len(matches)}")
    return matches[0]


def replace_dynamic_paragraphs(body: ET.Element) -> None:
    paragraphs = [child for child in body if child.tag == W_P]
    replacements = 0

    for paragraph in paragraphs:
        text = paragraph_text(paragraph)
        stripped = text.strip()
        replacement: str | None = None

        if stripped.startswith("Số:") and "HĐLĐ" in stripped:
            replacement = "Số: {{CONTRACT_NUMBER}}"
        elif stripped.startswith("Hôm nay, ngày"):
            replacement = (
                "Hôm nay, ngày {{SIGN_DAY}} tháng {{SIGN_MONTH}} năm {{SIGN_YEAR}} "
                "tại Công ty CP Phân bón và Hóa chất Cần Thơ."
            )
        elif stripped.casefold().startswith("và một bên là"):
            replacement = "Và một bên là {{EMPLOYEE_TITLE}}: {{FULL_NAME}}    Quốc tịch: {{NATIONALITY}}"
        elif stripped.startswith("Ngày sinh:"):
            replacement = "Ngày sinh: {{DATE_OF_BIRTH}} tại: {{BIRTH_PLACE}}"
        elif stripped.startswith("Địa chỉ thường trú:"):
            replacement = "Địa chỉ thường trú: {{PERMANENT_ADDRESS}}"
        elif stripped.startswith("Số CCCD:"):
            replacement = (
                "Số CCCD: {{CITIZEN_ID}}    Ngày cấp: {{CITIZEN_ID_ISSUED_DATE}}    "
                "Nơi cấp: {{CITIZEN_ID_ISSUED_PLACE}}"
            )
        elif stripped.startswith("Thỏa thuận ký kết hợp đồng lao động"):
            replacement = "Thỏa thuận ký kết hợp đồng lao động và cam kết làm đúng những điều khoản sau đây:"
        elif stripped.startswith("- Loại hợp đồng:"):
            replacement = "- Loại hợp đồng: {{CONTRACT_TYPE}}."
        elif stripped.startswith("- Từ ngày:"):
            replacement = "- {{CONTRACT_PERIOD}}"
        elif "Chức danh chuyên môn (vị trí công tác):" in stripped or stripped.startswith("- Chức danh công việc:"):
            replacement = "- Chức danh chuyên môn (vị trí công tác): {{POSITION_NAME}}."
        elif stripped.startswith("- Chức vụ (nếu có):"):
            replacement = "- Phòng ban/Bộ phận: {{DEPARTMENT_NAME}}."
        elif stripped.startswith("- Công việc phải làm:"):
            replacement = "- Công việc phải làm: {{JOB_DESCRIPTION}}"
        elif stripped.startswith("-Địa điểm làm việc:") or stripped.startswith("- Địa điểm làm việc:"):
            replacement = "- Địa điểm làm việc: {{WORKPLACE}}"
        elif stripped.startswith("- Mức lương chính:"):
            replacement = "- Mức lương chính: {{BASE_SALARY_TEXT}}."
        elif stripped.startswith("+ Các khoản khác"):
            replacement = "+ Các khoản khác: {{ALLOWANCE_TEXT}}. {{SALARY_NOTE}}"

        if replacement is not None:
            set_paragraph_text(paragraph, replacement)
            replacements += 1

    duties_start = find_paragraph_index(
        paragraphs,
        lambda value: value.startswith("3.2. Nghĩa vụ:"),
        "employee duties heading",
    )
    duties_end = find_paragraph_index(
        paragraphs,
        lambda value: value.startswith("Điều 4:"),
        "employer duties heading",
    )
    duty_paragraphs = [
        paragraph for paragraph in paragraphs[duties_start + 1:duties_end]
        if paragraph_text(paragraph).strip()
    ]
    if len(duty_paragraphs) < 2:
        raise ValueError("The source contract does not contain the expected employee-duty paragraphs")
    set_paragraph_text(
        duty_paragraphs[0],
        "- Hoàn thành công việc theo hợp đồng và sự phân công hợp pháp của Ban lãnh đạo Công ty.",
    )
    set_paragraph_text(
        duty_paragraphs[1],
        "- Chấp hành nội quy lao động, quy định an toàn và sự điều hành của {{DEPARTMENT_NAME}}. "
        "{{DEPARTMENT_RULE_NOTE}}",
    )
    for paragraph in duty_paragraphs[2:]:
        empty_paragraph(paragraph)

    if replacements < 15:
        raise ValueError(f"Too few dynamic paragraphs were replaced: {replacements}")


def clean_obvious_typography(body: ET.Element) -> None:
    replacements = {
        "ngày12/11/2020": "ngày 12/11/2020",
        "BHYT,BHTN": "BHYT, BHTN",
        "Điều 4:Nghĩa": "Điều 4: Nghĩa",
        "Điều 5:Điều": "Điều 5: Điều",
        "lao độngđược": "lao động được",
        "một bảncó": "một bản có",
    }
    for paragraph in [child for child in body if child.tag == W_P]:
        original = paragraph_text(paragraph)
        cleaned = original
        for source, target in replacements.items():
            cleaned = cleaned.replace(source, target)
        if cleaned != original:
            set_paragraph_text(paragraph, cleaned)


def build_document_xml(source_xml: bytes, anchor: str) -> bytes:
    register_namespaces(source_xml)
    root = ET.fromstring(source_xml)
    body = root.find(W_BODY)
    if body is None:
        raise ValueError("word/document.xml does not contain w:body")
    section_properties = next((copy.deepcopy(child) for child in body if child.tag == W_SECT_PR), None)
    if section_properties is None:
        raise ValueError("word/document.xml does not contain final section properties")
    selected = [copy.deepcopy(child) for child in select_contract(body, anchor)]

    for child in list(body):
        body.remove(child)
    for child in selected:
        body.append(child)
    body.append(section_properties)

    replace_dynamic_paragraphs(body)
    clean_obvious_typography(body)
    result = ET.tostring(root, encoding="utf-8", xml_declaration=False)
    return b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + result


def sanitize_package_part(name: str, data: bytes) -> bytes:
    if name == "docProps/core.xml":
        data = re.sub(rb"<dc:creator>.*?</dc:creator>", b"<dc:creator>CFC HR</dc:creator>", data)
        data = re.sub(
            rb"<cp:lastModifiedBy>.*?</cp:lastModifiedBy>",
            b"<cp:lastModifiedBy>CFC HR</cp:lastModifiedBy>",
            data,
        )
        data = re.sub(rb"<cp:revision>.*?</cp:revision>", b"<cp:revision>1</cp:revision>", data)
    elif name == "docProps/app.xml":
        for element, value in {
            b"Pages": b"3",
            b"Words": b"0",
            b"Characters": b"0",
            b"Lines": b"0",
            b"Paragraphs": b"0",
            b"CharactersWithSpaces": b"0",
        }.items():
            data = re.sub(rb"<" + element + rb">.*?</" + element + rb">", b"<" + element + b">" + value + b"</" + element + b">", data)
    return data


def build_template(source_bytes: bytes, anchor: str) -> bytes:
    source_buffer = io.BytesIO(source_bytes)
    output_buffer = io.BytesIO()
    with zipfile.ZipFile(source_buffer, "r") as source_zip, zipfile.ZipFile(output_buffer, "w") as output_zip:
        source_xml = source_zip.read("word/document.xml")
        generated_xml = build_document_xml(source_xml, anchor)
        for info in source_zip.infolist():
            data = generated_xml if info.filename == "word/document.xml" else source_zip.read(info.filename)
            output_zip.writestr(info, sanitize_package_part(info.filename, data))
    return output_buffer.getvalue()


def validate_template(data: bytes, anchor: str) -> None:
    with zipfile.ZipFile(io.BytesIO(data), "r") as archive:
        xml = archive.read("word/document.xml")
    text = "\n".join(paragraph_text(paragraph) for paragraph in ET.fromstring(xml).iter(W_P))
    missing = sorted(token for token in REQUIRED_PLACEHOLDERS if token not in text)
    unresolved_employee_numbers = re.findall(r"(?<!\d)\d{12}(?!\d)", text)
    if missing:
        raise ValueError(f"Generated template is missing placeholders: {', '.join(missing)}")
    if anchor in text:
        raise ValueError(f"Generated template still contains source employee name {anchor!r}")
    if unresolved_employee_numbers:
        raise ValueError("Generated template still contains a 12-digit employee identity number")
    if text.count("HỢP ĐỒNG LAO ĐỘNG") != 1:
        raise ValueError("Generated template must contain exactly one employment contract")
    if "hợp đồng lao động thử việc" in text.casefold():
        raise ValueError("Generated employment-contract template still contains probation wording")


def parse_args() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=repository_root / "backend/src/main/resources/hr/templates/HDLD.docx",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=repository_root / "backend/src/main/resources/hr/templates",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_bytes = args.source.read_bytes()
    actual_source_sha = sha256(source_bytes)
    if actual_source_sha != EXPECTED_SOURCE_SHA256:
        raise ValueError(
            f"HDLD.docx checksum mismatch: expected {EXPECTED_SOURCE_SHA256}, got {actual_source_sha}"
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, config in VARIANTS.items():
        generated = build_template(source_bytes, config["anchor"])
        validate_template(generated, config["anchor"])
        output = args.output_dir / config["file_name"]
        output.write_bytes(generated)
        print(f"{name}: {output} ({len(generated)} bytes, sha256={sha256(generated)})")

    if sha256(args.source.read_bytes()) != actual_source_sha:
        raise RuntimeError("Source HDLD.docx changed while building templates")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
