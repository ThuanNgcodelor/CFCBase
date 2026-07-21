#!/usr/bin/env python3
"""Create and verify the frozen HR Excel template without a workbook round-trip.

The source workbook contains formulas, cached values, VML comments, printer
settings and an external link.  This module therefore patches one worksheet
part directly and asserts that every other OOXML part remains unchanged.
"""

from __future__ import annotations

import hashlib
import json
import os
import posixpath
import re
import stat
import tempfile
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPOSITORY_ROOT / "docs" / "Danh sách nhân sự 2026.xlsx"
DEFAULT_TEMPLATE = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "Danh sách nhân sự 2026 - template-v1.xlsx"
)
DEFAULT_MANIFEST = (
    REPOSITORY_ROOT / "docs" / "hr-template" / "template-v1-manifest.json"
)

SOURCE_SHA256 = "3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60"
CANONICAL_SHEET_NAME = "T6-26"
CANONICAL_SHEET_PART = "xl/worksheets/sheet12.xml"
LEAVE_COLUMN = "AM"
LEAVE_HEADER = "NGÀY NGHỈ PHÉP"
LEAVE_HEADER_ROW = 4
FIRST_EMPLOYEE_ROW = 5
LAST_EMPLOYEE_ROW = 333

PRIVACY_CONTRACT = {
    "manifest_contains_pii": False,
    "workbooks_contain_pii": True,
    "workbook_files_are_local_only": True,
    "workbooks_must_not_be_packaged_in_application_jar": True,
}
CANONICAL_TEMPLATE_RULE = {
    "sheet": CANONICAL_SHEET_NAME,
    "source_is_immutable": True,
    "allowlisted_cells": "T6-26!AM4:AM333",
    "column_operation": "WRITE_IN_EXISTING_BLANK_COLUMN_DO_NOT_INSERT",
    "header_cell": "T6-26!AM4",
    "header_value": LEAVE_HEADER,
    "body_cells": "T6-26!AM5:AM333",
    "body_values": "BLANK",
    "body_style_source": "AL_ON_SAME_ROW_OR_AL_COLUMN_DEFAULT",
    "protected_main_roster_columns": "A:AL",
    "protected_auxiliary_columns": "AN:CQ",
}

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOCUMENT_REL_NS = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": PACKAGE_REL_NS}


class TemplateContractError(RuntimeError):
    """Raised when the source or generated template violates the contract."""


def validate_contract_paths(source: Path, template: Path, manifest: Path) -> None:
    """Reject path aliases that could overwrite the immutable source workbook."""

    paths = {
        "source": source.resolve(),
        "template": template.resolve(),
        "manifest": manifest.resolve(),
    }
    if paths["source"].suffix.lower() != ".xlsx":
        raise TemplateContractError("File nguồn phải có đuôi .xlsx.")
    if paths["template"].suffix.lower() != ".xlsx":
        raise TemplateContractError("File template đầu ra phải có đuôi .xlsx.")
    if paths["manifest"].suffix.lower() != ".json":
        raise TemplateContractError("File manifest phải có đuôi .json.")
    if len(set(paths.values())) != len(paths):
        raise TemplateContractError(
            "Source, template và manifest phải là ba đường dẫn khác nhau."
        )

    entries = list(paths.items())
    for index, (left_name, left_path) in enumerate(entries):
        if not left_path.exists():
            continue
        for right_name, right_path in entries[index + 1 :]:
            if right_path.exists() and os.path.samefile(left_path, right_path):
                raise TemplateContractError(
                    f"{left_name} và {right_name} đang trỏ tới cùng một file."
                )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _column_number(column_name: str) -> int:
    result = 0
    for character in column_name:
        result = result * 26 + ord(character) - ord("A") + 1
    return result


def _relationship_target(base_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_part), target))


def _worksheet_relationship_part(worksheet_part: str) -> str:
    directory, filename = posixpath.split(worksheet_part)
    return posixpath.join(directory, "_rels", f"{filename}.rels")


def _xml_attribute(element: str, name: str) -> str | None:
    match = re.search(rf'\b{re.escape(name)}="([^"]*)"', element)
    return match.group(1) if match else None


def _set_xml_attribute(element: str, name: str, value: str) -> str:
    updated, count = re.subn(
        rf'(\b{re.escape(name)}=")[^"]*(")',
        rf"\g<1>{value}\g<2>",
        element,
        count=1,
    )
    if count != 1:
        raise TemplateContractError(f"Không tìm thấy attribute {name} trong {element}")
    return updated


def _patch_columns(xml_text: str) -> tuple[str, str]:
    cols_match = re.search(r"<cols>(?P<body>.*?)</cols>", xml_text, re.DOTALL)
    if not cols_match:
        raise TemplateContractError("T6-26 không có phần định nghĩa cột <cols>.")

    column_elements = list(re.finditer(r"<col\b[^>]*/>", cols_match.group("body")))
    al_element = None
    default_after_al = None
    for match in column_elements:
        element = match.group(0)
        minimum = _xml_attribute(element, "min")
        maximum = _xml_attribute(element, "max")
        if minimum == "38" and maximum == "38":
            al_element = element
        if minimum == "39" and maximum == "16384":
            default_after_al = element

    if al_element is None or default_after_al is None:
        raise TemplateContractError(
            "Cấu trúc cột AL/AM của T6-26 không còn đúng baseline Phase 0."
        )

    al_default_style = _xml_attribute(al_element, "style")
    if al_default_style is None:
        raise TemplateContractError("Cột AL không có default style trong baseline.")

    am_element = _set_xml_attribute(al_element, "min", "39")
    am_element = _set_xml_attribute(am_element, "max", "39")
    remaining_element = _set_xml_attribute(default_after_al, "min", "40")
    replacement = am_element + remaining_element

    cols_body = cols_match.group("body")
    if cols_body.count(default_after_al) != 1:
        raise TemplateContractError("Không thể xác định duy nhất dải cột bắt đầu từ AM.")
    patched_body = cols_body.replace(default_after_al, replacement, 1)
    return (
        xml_text[: cols_match.start("body")]
        + patched_body
        + xml_text[cols_match.end("body") :],
        al_default_style,
    )


def _patch_row(row_xml: str, row_number: int, al_default_style: str) -> str:
    if re.search(rf'<c\b[^>]*\br="{LEAVE_COLUMN}{row_number}"(?:\s|/|>)', row_xml):
        raise TemplateContractError(
            f"{CANONICAL_SHEET_NAME}!{LEAVE_COLUMN}{row_number} không còn trống."
        )

    source_cell_match = re.search(
        rf'<c\b(?=[^>]*\br="AL{row_number}")[^>]*(?:/>|>.*?</c>)',
        row_xml,
        re.DOTALL,
    )
    if not source_cell_match and row_number == LEAVE_HEADER_ROW:
        raise TemplateContractError(
            f"Không tìm thấy ô AL{row_number} để sao chép style sang AM."
        )
    style_id = (
        _xml_attribute(source_cell_match.group(0), "s")
        if source_cell_match
        else al_default_style
    )
    if style_id is None:
        raise TemplateContractError(f"Ô AL{row_number} không có style id.")

    start_tag_end = row_xml.find(">")
    if start_tag_end < 0:
        raise TemplateContractError(f"Row {row_number} có XML không hợp lệ.")
    start_tag = row_xml[: start_tag_end + 1]
    body = row_xml[start_tag_end + 1 : -len("</row>")]

    spans = _xml_attribute(start_tag, "spans")
    if spans:
        span_start, span_end = (int(value) for value in spans.split(":", 1))
        if span_end < 39:
            start_tag = _set_xml_attribute(start_tag, "spans", f"{span_start}:39")

    if row_number == LEAVE_HEADER_ROW:
        new_cell = (
            f'<c r="{LEAVE_COLUMN}{row_number}" s="{style_id}" t="inlineStr">'
            f"<is><t>{LEAVE_HEADER}</t></is></c>"
        )
    else:
        new_cell = f'<c r="{LEAVE_COLUMN}{row_number}" s="{style_id}"/>'

    insertion_point = len(body)
    for cell_match in re.finditer(r'<c\b[^>]*\br="([A-Z]{1,3})(\d+)"', body):
        column_name, coordinate_row = cell_match.groups()
        if int(coordinate_row) != row_number:
            raise TemplateContractError(
                f"Row {row_number} chứa tọa độ ô không đồng nhất: "
                f"{column_name}{coordinate_row}."
            )
        if _column_number(column_name) > 39:
            insertion_point = cell_match.start()
            break

    return (
        start_tag
        + body[:insertion_point]
        + new_cell
        + body[insertion_point:]
        + "</row>"
    )


def patch_canonical_sheet(source_xml: bytes) -> bytes:
    """Apply the only allowed Phase-0 mutation to T6-26."""

    try:
        xml_text = source_xml.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise TemplateContractError("sheet12.xml không dùng UTF-8.") from exc

    xml_text, al_default_style = _patch_columns(xml_text)
    row_pattern = re.compile(r'<row\b[^>]*\br="(\d+)"[^>]*>.*?</row>', re.DOTALL)
    patched_rows: set[int] = set()

    def replace_row(match: re.Match[str]) -> str:
        row_number = int(match.group(1))
        if LEAVE_HEADER_ROW <= row_number <= LAST_EMPLOYEE_ROW:
            patched_rows.add(row_number)
            return _patch_row(match.group(0), row_number, al_default_style)
        return match.group(0)

    patched_text = row_pattern.sub(replace_row, xml_text)
    expected_rows = set(range(LEAVE_HEADER_ROW, LAST_EMPLOYEE_ROW + 1))
    missing_rows = sorted(expected_rows - patched_rows)
    if missing_rows:
        raise TemplateContractError(
            f"Thiếu row trong vùng template AM4:AM333: {missing_rows[:10]}"
        )

    patched_bytes = patched_text.encode("utf-8")
    try:
        ET.fromstring(patched_bytes)
    except ET.ParseError as exc:
        raise TemplateContractError("XML T6-26 sau khi patch không hợp lệ.") from exc
    return patched_bytes


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    result: list[str] = []
    for item in root.findall("m:si", NS):
        result.append("".join(node.text or "" for node in item.findall(".//m:t", NS)))
    return result


def _cell_text(cell: ET.Element, shared_strings: list[str]) -> str | None:
    cell_type = cell.get("t")
    if cell_type == "inlineStr":
        inline = cell.find("m:is", NS)
        if inline is None:
            return None
        return "".join(node.text or "" for node in inline.findall(".//m:t", NS))
    value = cell.find("m:v", NS)
    if value is None or value.text is None:
        return None
    if cell_type == "s":
        index = int(value.text)
        return shared_strings[index]
    return value.text


def _cell_has_content(cell: ET.Element) -> bool:
    return any(
        cell.find(path, NS) is not None for path in ("m:f", "m:v", "m:is")
    )


def _formula_fingerprint(sheet_root: ET.Element) -> str:
    records: list[dict[str, object]] = []
    for cell in sheet_root.findall(".//m:c", NS):
        formula = cell.find("m:f", NS)
        if formula is None:
            continue
        records.append(
            {
                "cell": cell.get("r"),
                "attributes": sorted(formula.attrib.items()),
                "formula": formula.text or "",
            }
        )
    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    return sha256_bytes(payload.encode("utf-8"))


def _sheet_mapping(archive: zipfile.ZipFile) -> list[dict[str, str]]:
    workbook_part = "xl/workbook.xml"
    workbook_root = ET.fromstring(archive.read(workbook_part))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.get("Id"): _relationship_target(
            workbook_part, relationship.get("Target", "")
        )
        for relationship in relationships.findall("r:Relationship", NS)
    }

    sheets: list[dict[str, str]] = []
    for sheet in workbook_root.findall("m:sheets/m:sheet", NS):
        relationship_id = sheet.get(f"{{{DOCUMENT_REL_NS}}}id")
        if relationship_id not in targets:
            raise TemplateContractError(
                f"Không tìm thấy relationship của sheet {sheet.get('name')}."
            )
        sheets.append(
            {
                "name": sheet.get("name", ""),
                "state": sheet.get("state", "visible"),
                "part": targets[relationship_id],
            }
        )
    return sheets


def _canonical_relationships(archive: zipfile.ZipFile) -> dict[str, str]:
    rel_part = _worksheet_relationship_part(CANONICAL_SHEET_PART)
    root = ET.fromstring(archive.read(rel_part))
    result: dict[str, str] = {}
    for relationship in root.findall("r:Relationship", NS):
        relationship_type = relationship.get("Type", "").rsplit("/", 1)[-1]
        result[relationship_type] = _relationship_target(
            CANONICAL_SHEET_PART, relationship.get("Target", "")
        )
    return result


def inspect_workbook(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path, "r") as archive:
        bad_member = archive.testzip()
        if bad_member:
            raise TemplateContractError(f"ZIP bị lỗi tại part: {bad_member}")

        member_names = archive.namelist()
        sheets = _sheet_mapping(archive)
        shared_strings = _shared_strings(archive)
        total_formula_count = 0
        total_merge_count = 0
        total_hidden_rows = 0
        total_hidden_column_ranges = 0
        whole_error_counts: Counter[str] = Counter()
        workbook_formula_records: list[tuple[str, str]] = []

        canonical_root = None
        for sheet in sheets:
            root = ET.fromstring(archive.read(sheet["part"]))
            formulas = root.findall(".//m:f", NS)
            total_formula_count += len(formulas)
            total_merge_count += len(root.findall(".//m:mergeCells/m:mergeCell", NS))
            total_hidden_rows += sum(
                row.get("hidden") in {"1", "true"}
                for row in root.findall(".//m:sheetData/m:row", NS)
            )
            total_hidden_column_ranges += sum(
                column.get("hidden") in {"1", "true"}
                for column in root.findall(".//m:cols/m:col", NS)
            )
            for cell in root.findall(".//m:c", NS):
                formula = cell.find("m:f", NS)
                if formula is not None:
                    workbook_formula_records.append(
                        (
                            f"{sheet['name']}!{cell.get('r')}",
                            ET.tostring(formula, encoding="unicode"),
                        )
                    )
                if cell.get("t") == "e":
                    value = cell.find("m:v", NS)
                    whole_error_counts[value.text if value is not None else ""] += 1
            if sheet["name"] == CANONICAL_SHEET_NAME:
                canonical_root = root

        if canonical_root is None:
            raise TemplateContractError(f"Không tìm thấy sheet {CANONICAL_SHEET_NAME}.")

        canonical_cells = {
            cell.get("r", ""): cell
            for cell in canonical_root.findall(".//m:c", NS)
        }
        canonical_error_counts: Counter[str] = Counter()
        for cell in canonical_cells.values():
            if cell.get("t") == "e":
                value = cell.find("m:v", NS)
                canonical_error_counts[value.text if value is not None else ""] += 1

        employee_codes: list[str] = []
        employee_row_count = 0
        for row_number in range(FIRST_EMPLOYEE_ROW, LAST_EMPLOYEE_ROW + 1):
            code_cell = canonical_cells.get(f"C{row_number}")
            name_cell = canonical_cells.get(f"E{row_number}")
            if (code_cell is not None and _cell_has_content(code_cell)) or (
                name_cell is not None and _cell_has_content(name_cell)
            ):
                employee_row_count += 1
            if code_cell is not None:
                code = _cell_text(code_cell, shared_strings)
                if code is not None:
                    employee_codes.append(code)

        am_cells = {
            coordinate: cell
            for coordinate, cell in canonical_cells.items()
            if re.fullmatch(r"AM\d+", coordinate)
        }
        al_column_style = None
        for column in canonical_root.findall("m:cols/m:col", NS):
            minimum = int(column.get("min", "0"))
            maximum = int(column.get("max", "0"))
            if minimum <= 38 <= maximum:
                al_column_style = column.get("style")
                break
        styles_match = al_column_style is not None and all(
            canonical_cells.get(f"AM{row_number}") is not None
            and canonical_cells[f"AM{row_number}"].get("s")
            == (
                canonical_cells[f"AL{row_number}"].get("s")
                if canonical_cells.get(f"AL{row_number}") is not None
                else al_column_style
            )
            for row_number in range(FIRST_EMPLOYEE_ROW, LAST_EMPLOYEE_ROW + 1)
        )

        dimension = canonical_root.find("m:dimension", NS)
        auto_filter = canonical_root.find("m:autoFilter", NS)
        pane = canonical_root.find("m:sheetViews/m:sheetView/m:pane", NS)
        merge_refs = [
            item.get("ref", "")
            for item in canonical_root.findall("m:mergeCells/m:mergeCell", NS)
        ]
        auxiliary_count = sum(
            1
            for coordinate, cell in canonical_cells.items()
            if re.fullmatch(r"[A-Z]+101", coordinate)
            and _column_number(re.match(r"[A-Z]+", coordinate).group(0)) >= 40
            and _cell_has_content(cell)
        )

        styles_root = ET.fromstring(archive.read("xl/styles.xml"))
        cell_xfs = styles_root.find("m:cellXfs", NS)
        comments_parts = [
            name
            for name in member_names
            if re.fullmatch(r"xl/comments\d+\.xml", name)
        ]
        comment_count = 0
        for part in comments_parts:
            root = ET.fromstring(archive.read(part))
            comment_count += len(root.findall(".//m:comment", NS))

        canonical_relationships = _canonical_relationships(archive)
        canonical_comment_count = 0
        comment_part = canonical_relationships.get("comments")
        if comment_part:
            comment_root = ET.fromstring(archive.read(comment_part))
            canonical_comment_count = len(comment_root.findall(".//m:comment", NS))

        formula_payload = json.dumps(
            workbook_formula_records,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")

        return {
            "file": {
                "name": path.name,
                "size_bytes": path.stat().st_size,
                "sha256": sha256_file(path),
                "zip_part_count": len(member_names),
            },
            "workbook": {
                "sheet_count": len(sheets),
                "visible_sheet_count": sum(
                    sheet["state"] == "visible" for sheet in sheets
                ),
                "hidden_sheet_count": sum(
                    sheet["state"] != "visible" for sheet in sheets
                ),
                "sheets": sheets,
                "formula_count": total_formula_count,
                "formula_fingerprint_sha256": sha256_bytes(formula_payload),
                "merge_count": total_merge_count,
                "comment_count": comment_count,
                "comment_part_count": len(comments_parts),
                "hidden_row_count": total_hidden_rows,
                "hidden_column_range_count": total_hidden_column_ranges,
                "cached_formula_errors": dict(sorted(whole_error_counts.items())),
                "external_link_count": len(
                    [
                        name
                        for name in member_names
                        if re.fullmatch(r"xl/externalLinks/externalLink\d+\.xml", name)
                    ]
                ),
                "printer_settings_part_count": len(
                    [
                        name
                        for name in member_names
                        if name.startswith("xl/printerSettings/")
                    ]
                ),
                "vml_drawing_part_count": len(
                    [
                        name
                        for name in member_names
                        if name.startswith("xl/drawings/") and name.endswith(".vml")
                    ]
                ),
                "cell_style_count": int(cell_xfs.get("count", "0"))
                if cell_xfs is not None
                else 0,
                "has_calc_chain": "xl/calcChain.xml" in member_names,
            },
            "canonical_sheet": {
                "name": CANONICAL_SHEET_NAME,
                "part": CANONICAL_SHEET_PART,
                "dimension": dimension.get("ref") if dimension is not None else None,
                "auto_filter": auto_filter.get("ref")
                if auto_filter is not None
                else None,
                "freeze_pane": dict(sorted(pane.attrib.items())) if pane is not None else {},
                "merge_refs": merge_refs,
                "cell_count": len(canonical_cells),
                "nonempty_cell_count": sum(
                    _cell_has_content(cell) for cell in canonical_cells.values()
                ),
                "formula_count": len(canonical_root.findall(".//m:f", NS)),
                "formula_fingerprint_sha256": _formula_fingerprint(canonical_root),
                "comment_count": canonical_comment_count,
                "cached_formula_errors": dict(sorted(canonical_error_counts.items())),
                "employee_row_range": f"{FIRST_EMPLOYEE_ROW}:{LAST_EMPLOYEE_ROW}",
                "employee_row_count": employee_row_count,
                "unique_employee_code_count": len(set(employee_codes)),
                "leave_column": LEAVE_COLUMN,
                "leave_cell_count": len(am_cells),
                "leave_header": _cell_text(
                    canonical_cells[f"{LEAVE_COLUMN}{LEAVE_HEADER_ROW}"], shared_strings
                )
                if f"{LEAVE_COLUMN}{LEAVE_HEADER_ROW}" in canonical_cells
                else None,
                "leave_body_styles_match_al": styles_match,
                "auxiliary_nonempty_cell_count_an_to_cq_row_101": auxiliary_count,
                "relationships": canonical_relationships,
            },
        }


def _assert_baseline(snapshot: dict[str, object]) -> None:
    workbook = snapshot["workbook"]
    sheet = snapshot["canonical_sheet"]
    expected = {
        "sheet_count": 33,
        "hidden_sheet_count": 5,
        "formula_count": 27343,
        "merge_count": 191,
        "comment_count": 261,
        "external_link_count": 1,
        "cell_style_count": 1370,
        "has_calc_chain": True,
    }
    for key, value in expected.items():
        if workbook[key] != value:
            raise TemplateContractError(
                f"Baseline workbook sai {key}: cần {value}, thực tế {workbook[key]}."
            )

    sheet_expected = {
        "dimension": "A1:CQ720",
        "auto_filter": "A4:CQ362",
        "formula_count": 4150,
        "comment_count": 18,
        "employee_row_count": 329,
        "unique_employee_code_count": 329,
        "merge_refs": ["B1:T1", "B2:T2", "A335:B335", "A336:B336"],
    }
    for key, value in sheet_expected.items():
        if sheet[key] != value:
            raise TemplateContractError(
                f"Baseline T6-26 sai {key}: cần {value}, thực tế {sheet[key]}."
            )


def verify_packages(source: Path, template: Path) -> tuple[dict[str, object], dict[str, object]]:
    if not source.is_file():
        raise TemplateContractError(f"Không tìm thấy file nguồn: {source}")
    if not template.is_file():
        raise TemplateContractError(f"Không tìm thấy file template: {template}")
    if sha256_file(source) != SOURCE_SHA256:
        raise TemplateContractError(
            "SHA-256 file nguồn đã thay đổi; dừng để tránh dùng sai baseline T6-26."
        )

    with zipfile.ZipFile(source, "r") as source_archive, zipfile.ZipFile(
        template, "r"
    ) as template_archive:
        source_bad = source_archive.testzip()
        template_bad = template_archive.testzip()
        if source_bad or template_bad:
            raise TemplateContractError(
                f"OOXML ZIP không hợp lệ (source={source_bad}, template={template_bad})."
            )
        source_members = source_archive.namelist()
        template_members = template_archive.namelist()
        if source_members != template_members:
            raise TemplateContractError("Danh sách/thứ tự OOXML part đã thay đổi.")

        for member in source_members:
            source_content = source_archive.read(member)
            template_content = template_archive.read(member)
            if member == CANONICAL_SHEET_PART:
                expected_content = patch_canonical_sheet(source_content)
                if template_content != expected_content:
                    raise TemplateContractError(
                        "sheet12.xml có thay đổi ngoài allowlist AM4:AM333/cột AM."
                    )
            elif source_content != template_content:
                raise TemplateContractError(
                    f"OOXML part ngoài allowlist đã thay đổi: {member}"
                )

    source_snapshot = inspect_workbook(source)
    template_snapshot = inspect_workbook(template)
    _assert_baseline(source_snapshot)

    source_workbook = source_snapshot["workbook"]
    template_workbook = template_snapshot["workbook"]
    for key in (
        "sheet_count",
        "visible_sheet_count",
        "hidden_sheet_count",
        "sheets",
        "formula_count",
        "formula_fingerprint_sha256",
        "merge_count",
        "comment_count",
        "comment_part_count",
        "hidden_row_count",
        "hidden_column_range_count",
        "cached_formula_errors",
        "external_link_count",
        "printer_settings_part_count",
        "vml_drawing_part_count",
        "cell_style_count",
        "has_calc_chain",
    ):
        if source_workbook[key] != template_workbook[key]:
            raise TemplateContractError(f"Workbook invariant bị đổi: {key}")

    source_sheet = source_snapshot["canonical_sheet"]
    template_sheet = template_snapshot["canonical_sheet"]
    for key in (
        "name",
        "part",
        "dimension",
        "auto_filter",
        "freeze_pane",
        "merge_refs",
        "formula_count",
        "formula_fingerprint_sha256",
        "comment_count",
        "cached_formula_errors",
        "employee_row_range",
        "employee_row_count",
        "unique_employee_code_count",
        "auxiliary_nonempty_cell_count_an_to_cq_row_101",
        "relationships",
    ):
        if source_sheet[key] != template_sheet[key]:
            raise TemplateContractError(f"T6-26 invariant bị đổi: {key}")

    if source_sheet["leave_cell_count"] != 0:
        raise TemplateContractError("Cột AM của file nguồn không còn trống hoàn toàn.")
    expected_leave_cell_count = LAST_EMPLOYEE_ROW - LEAVE_HEADER_ROW + 1
    if template_sheet["leave_cell_count"] != expected_leave_cell_count:
        raise TemplateContractError(
            f"Template cần {expected_leave_cell_count} ô AM4:AM333."
        )
    if template_sheet["leave_header"] != LEAVE_HEADER:
        raise TemplateContractError("Header NGÀY NGHỈ PHÉP không đúng tại AM4.")
    if not template_sheet["leave_body_styles_match_al"]:
        raise TemplateContractError("Style AM5:AM333 chưa khớp với AL theo từng dòng.")
    if template_sheet["nonempty_cell_count"] != source_sheet["nonempty_cell_count"] + 1:
        raise TemplateContractError("Template phát sinh giá trị ngoài header AM4.")
    if template_sheet["cell_count"] != source_sheet["cell_count"] + expected_leave_cell_count:
        raise TemplateContractError("Số ô scaffold AM4:AM333 không đúng.")

    return source_snapshot, template_snapshot


def build_manifest(
    source_snapshot: dict[str, object], template_snapshot: dict[str, object]
) -> dict[str, object]:
    return {
        "contract_version": 1,
        "generated_at_utc": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
        "privacy": dict(PRIVACY_CONTRACT),
        "source": source_snapshot["file"],
        "template": template_snapshot["file"],
        "canonical_template_rule": dict(CANONICAL_TEMPLATE_RULE),
        "baseline": {
            "workbook": source_snapshot["workbook"],
            "canonical_sheet": source_snapshot["canonical_sheet"],
        },
        "template_invariants": {
            "workbook": template_snapshot["workbook"],
            "canonical_sheet": template_snapshot["canonical_sheet"],
        },
    }


def write_json_atomic(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary_name, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def create_template(source: Path, template: Path, manifest: Path) -> dict[str, object]:
    validate_contract_paths(source, template, manifest)
    if not source.is_file():
        raise TemplateContractError(f"Không tìm thấy file nguồn: {source}")
    if sha256_file(source) != SOURCE_SHA256:
        raise TemplateContractError(
            "SHA-256 file nguồn khác baseline đã duyệt; không tạo template."
        )

    if template.exists():
        source_snapshot, template_snapshot = verify_packages(source, template)
        manifest_value = build_manifest(source_snapshot, template_snapshot)
        if manifest.exists():
            return verify_manifest(source, template, manifest)
        write_json_atomic(manifest, manifest_value)
        return manifest_value

    template.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{template.name}.", suffix=".tmp", dir=template.parent
    )
    os.close(file_descriptor)
    temporary_path = Path(temporary_name)
    try:
        with zipfile.ZipFile(source, "r") as source_archive, zipfile.ZipFile(
            temporary_path, "w", allowZip64=True
        ) as template_archive:
            template_archive.comment = source_archive.comment
            for info in source_archive.infolist():
                content = source_archive.read(info.filename)
                if info.filename == CANONICAL_SHEET_PART:
                    content = patch_canonical_sheet(content)
                template_archive.writestr(info, content)
        os.chmod(temporary_path, stat.S_IRUSR | stat.S_IWUSR)
        verify_packages(source, temporary_path)
        os.replace(temporary_path, template)
        source_snapshot, template_snapshot = verify_packages(source, template)
        manifest_value = build_manifest(source_snapshot, template_snapshot)
        write_json_atomic(manifest, manifest_value)
        verify_manifest(source, template, manifest)
        return manifest_value
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def verify_manifest(source: Path, template: Path, manifest: Path) -> dict[str, object]:
    validate_contract_paths(source, template, manifest)
    if not manifest.is_file():
        raise TemplateContractError(f"Không tìm thấy manifest: {manifest}")
    manifest_value = json.loads(manifest.read_text(encoding="utf-8"))
    source_snapshot, template_snapshot = verify_packages(source, template)
    if manifest_value.get("contract_version") != 1:
        raise TemplateContractError("Manifest contract_version không được hỗ trợ.")
    if manifest_value.get("privacy") != PRIVACY_CONTRACT:
        raise TemplateContractError("Khai báo privacy trong manifest không đúng.")
    if manifest_value.get("canonical_template_rule") != CANONICAL_TEMPLATE_RULE:
        raise TemplateContractError("Allowlist trong manifest không đúng hợp đồng Phase 0.")
    if manifest_value.get("source") != source_snapshot["file"]:
        raise TemplateContractError("Thông tin source trong manifest không khớp.")
    if manifest_value.get("template") != template_snapshot["file"]:
        raise TemplateContractError("Thông tin template trong manifest không khớp.")
    baseline = manifest_value.get("baseline", {})
    if baseline.get("workbook") != source_snapshot["workbook"] or baseline.get(
        "canonical_sheet"
    ) != source_snapshot["canonical_sheet"]:
        raise TemplateContractError("Baseline aggregate trong manifest không khớp.")
    invariants = manifest_value.get("template_invariants", {})
    if invariants.get("workbook") != template_snapshot["workbook"] or invariants.get(
        "canonical_sheet"
    ) != template_snapshot["canonical_sheet"]:
        raise TemplateContractError("Template invariants trong manifest không khớp.")
    return manifest_value


def secure_workbook_permissions(*paths: Path) -> None:
    for path in paths:
        if path.exists():
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPOSITORY_ROOT))
    except ValueError:
        return str(path.resolve())
