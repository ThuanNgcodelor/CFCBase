#!/usr/bin/env python3
"""Phase 0.1 contract for the clean 2026 HR baseline workbook.

The manually formatted workbook is an immutable build input.  The builder
performs a narrow OOXML cleanup without round-tripping through a spreadsheet
library, so cell styles, row heights, column widths, comments and cached
business values remain intact.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import posixpath
import re
import stat
import tempfile
import zipfile
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ORIGINAL = REPOSITORY_ROOT / "docs" / "Danh sách nhân sự 2026.xlsx"
DEFAULT_FORMATTED_SOURCE = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "archive"
    / "baseline-values-2026-user-formatted-source.xlsx"
)
DEFAULT_BASELINE = (
    REPOSITORY_ROOT / "docs" / "hr-template" / "baseline-values-2026.xlsx"
)
DEFAULT_MANIFEST = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "baseline-values-2026-manifest.json"
)

ORIGINAL_SHA256 = "3e88290c865b73870c6557ff06b8273fcff012f22225c094526d020c39359a60"
FORMATTED_SOURCE_SHA256 = (
    "8c4d54aa757fc75a16a5ab15b031c1245668a0dfdc4a99afb42f6ea143fef195"
)

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOCUMENT_REL_NS = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {
    "m": MAIN_NS,
    "r": DOCUMENT_REL_NS,
    "pr": PACKAGE_REL_NS,
}

VISIBLE_SHEETS = ("GIAM", "TĂNG", "T6-26")
SHEET_PARTS = {
    "GIAM": "xl/worksheets/sheet1.xml",
    "TĂNG": "xl/worksheets/sheet5.xml",
    "T6-26": "xl/worksheets/sheet7.xml",
}
KEEP_PARTS = frozenset(
    {
        "[Content_Types].xml",
        "_rels/.rels",
        "docProps/core.xml",
        "docProps/app.xml",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/theme/theme1.xml",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
        "xl/worksheets/_rels/sheet1.xml.rels",
        "xl/comments1.xml",
        "xl/drawings/vmlDrawing1.vml",
        "xl/worksheets/sheet5.xml",
        "xl/worksheets/sheet7.xml",
        "xl/worksheets/_rels/sheet7.xml.rels",
        "xl/comments7.xml",
        "xl/drawings/vmlDrawing4.vml",
    }
)

# New T6 column -> original T6 column.  AH is a new leave-days column.
T6_COLUMN_MAPPING = {
    "A": "A",
    "B": "B",
    "C": "C",
    "D": "D",
    "E": "E",
    "F": "F",
    "G": "G",
    "H": "H",
    "I": "I",
    "J": "J",
    "K": "L",
    "L": "M",
    "M": "N",
    "N": "O",
    "O": "P",
    "P": "Q",
    "Q": "T",
    "R": "U",
    "S": "V",
    "T": "W",
    "U": "X",
    "V": "AA",
    "W": "AB",
    "X": "AC",
    "Y": "AD",
    "Z": "AE",
    "AA": "AF",
    "AB": "AG",
    "AC": "AH",
    "AD": "AI",
    "AE": "AJ",
    "AF": "AK",
    "AG": "AL",
}

EXPECTED_T6_EMPLOYEES = 329
EXPECTED_T6_MAPPED_CELLS = 10_857
EXPECTED_INLINE_STRING_CONVERSIONS = 7_130
EXPECTED_LITERAL_NA_ERRORS = 29
EXPECTED_COMMENTS = {"GIAM": 2, "TĂNG": 0, "T6-26": 18}
EXPECTED_ORIGINAL_NONEMPTY = {"GIAM": 130, "TĂNG": 119}

CELL_RE = re.compile(rb"(?:<c\b[^>]*/>|<c\b[^>]*>.*?</c>)", re.DOTALL)
ROW_RE = re.compile(rb"(?:<row\b[^>]*/>|<row\b[^>]*>.*?</row>)", re.DOTALL)
COL_RE = re.compile(rb"<col\b[^>]*/>")
FORMULA_RE = re.compile(rb"(?:<f\b[^>]*/>|<f\b[^>]*>.*?</f>)", re.DOTALL)
CELL_REF_RE = re.compile(r"^([A-Z]{1,3})([0-9]+)$")


class Phase01ContractError(RuntimeError):
    """Raised when a source or generated workbook breaks the Phase 0.1 contract."""


@dataclass(frozen=True)
class CellSnapshot:
    style: str
    value_type: str
    value: str | None


def qname(namespace: str, local_name: str) -> str:
    return f"{{{namespace}}}{local_name}"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPOSITORY_ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def _require_file(path: Path, description: str) -> None:
    if not path.is_file():
        raise Phase01ContractError(f"Thiếu {description}: {display_path(path)}")


def _require_sha256(path: Path, expected: str, description: str) -> None:
    actual = sha256_file(path)
    if actual != expected:
        raise Phase01ContractError(
            f"{description} đã thay đổi: expected {expected}, actual {actual}."
        )


def validate_inputs(original: Path, formatted_source: Path) -> None:
    _require_file(original, "file nhân sự gốc")
    _require_file(formatted_source, "archive do người dùng format")
    _require_sha256(original, ORIGINAL_SHA256, "File nhân sự gốc")
    _require_sha256(
        formatted_source,
        FORMATTED_SOURCE_SHA256,
        "Archive do người dùng format",
    )
    for path in (original, formatted_source):
        with zipfile.ZipFile(path) as archive:
            bad_part = archive.testzip()
            if bad_part:
                raise Phase01ContractError(
                    f"ZIP workbook hỏng tại {bad_part}: {display_path(path)}"
                )


def column_number(column: str) -> int:
    result = 0
    for character in column:
        result = result * 26 + ord(character) - ord("A") + 1
    return result


def split_cell_reference(reference: str) -> tuple[str, int]:
    match = CELL_REF_RE.fullmatch(reference)
    if not match:
        raise Phase01ContractError(f"Tọa độ ô không hợp lệ: {reference}")
    return match.group(1), int(match.group(2))


def _attribute(element: bytes, name: bytes) -> bytes | None:
    match = re.search(rb"\b" + re.escape(name) + rb'="([^"]*)"', element)
    return match.group(1) if match else None


def _replace_exactly_once(
    source: bytes,
    pattern: re.Pattern[bytes],
    replacement: bytes,
    description: str,
) -> bytes:
    patched, count = pattern.subn(replacement, source, count=1)
    if count != 1:
        raise Phase01ContractError(
            f"{description}: cần patch đúng 1 node, thực tế {count}."
        )
    return patched


def _shared_string_fragments(archive: zipfile.ZipFile) -> list[bytes]:
    root = archive.read("xl/sharedStrings.xml")
    fragments = re.findall(rb"<si(?:\s[^>]*)?>(.*?)</si>", root, re.DOTALL)
    parsed = ET.fromstring(root)
    expected = len(parsed.findall("m:si", NS))
    if len(fragments) != expected:
        raise Phase01ContractError(
            f"Không đọc đủ shared strings: {len(fragments)}/{expected}."
        )
    return fragments


def _convert_shared_strings_to_inline(
    source: bytes, shared_strings: list[bytes]
) -> tuple[bytes, int]:
    converted = 0

    def convert(cell_match: re.Match[bytes]) -> bytes:
        nonlocal converted
        cell = cell_match.group(0)
        tag_end = cell.find(b">")
        start_tag = cell if tag_end < 0 else cell[: tag_end + 1]
        if not re.search(rb'\bt="s"', start_tag):
            return cell
        if cell.endswith(b"/>"):
            raise Phase01ContractError("Shared-string cell không có body.")
        value_match = re.search(rb"<v>([0-9]+)</v>", cell)
        if not value_match:
            raise Phase01ContractError("Shared-string cell không có index hợp lệ.")
        index = int(value_match.group(1))
        if not 0 <= index < len(shared_strings):
            raise Phase01ContractError(f"Shared-string index ngoài phạm vi: {index}")
        patched_start = re.sub(rb'\bt="s"', b't="inlineStr"', start_tag, count=1)
        converted += 1
        return (
            patched_start
            + b"<is>"
            + shared_strings[index]
            + b"</is></c>"
        )

    patched = CELL_RE.sub(convert, source)
    parsed = ET.fromstring(patched)
    remaining = [
        cell
        for cell in parsed.findall("m:sheetData/m:row/m:c", NS)
        if cell.get("t") == "s"
    ]
    if remaining:
        raise Phase01ContractError(
            f"Worksheet vẫn tham chiếu sharedStrings: {len(remaining)} cell."
        )
    return patched, converted


def _normalized_view(sheet_name: str) -> bytes:
    if sheet_name == "T6-26":
        return (
            b'<sheetViews><sheetView showGridLines="true" tabSelected="true" '
            b'zoomScale="65" zoomScaleNormal="65" workbookViewId="0">'
            b'<pane xSplit="5" ySplit="4" topLeftCell="F5" '
            b'activePane="bottomRight" state="frozen"/>'
            b'<selection pane="bottomRight" activeCell="F5" sqref="F5"/>'
            b"</sheetView></sheetViews>"
        )
    return (
        b'<sheetViews><sheetView showGridLines="true" tabSelected="false" '
        b'zoomScale="65" zoomScaleNormal="65" workbookViewId="0">'
        b'<pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/>'
        b'<selection pane="bottomLeft" activeCell="A9" sqref="A9"/>'
        b"</sheetView></sheetViews>"
    )


def _patch_view(source: bytes, sheet_name: str) -> bytes:
    return _replace_exactly_once(
        source,
        re.compile(rb"<sheetViews>.*?</sheetViews>", re.DOTALL),
        _normalized_view(sheet_name),
        f"sheetViews {sheet_name}",
    )


def _trim_t6_columns(source: bytes) -> bytes:
    def keep_column(match: re.Match[bytes]) -> bytes:
        element = match.group(0)
        minimum_raw = _attribute(element, b"min")
        maximum_raw = _attribute(element, b"max")
        if minimum_raw is None or maximum_raw is None:
            raise Phase01ContractError("T6 có col definition thiếu min/max.")
        minimum = int(minimum_raw)
        maximum = int(maximum_raw)
        if minimum > 34:
            return b""
        if maximum > 34:
            return re.sub(rb'\bmax="[0-9]+"', b'max="34"', element, count=1)
        return element

    cols_pattern = re.compile(rb"<cols>(.*?)</cols>", re.DOTALL)
    match = cols_pattern.search(source)
    if not match:
        raise Phase01ContractError("T6 thiếu node cols.")
    patched_inner = COL_RE.sub(keep_column, match.group(1))
    return source[: match.start()] + b"<cols>" + patched_inner + b"</cols>" + source[match.end() :]


def _trim_t6_sheet_data(source: bytes) -> tuple[bytes, int, int]:
    sheet_data_pattern = re.compile(rb"<sheetData>(.*?)</sheetData>", re.DOTALL)
    match = sheet_data_pattern.search(source)
    if not match:
        raise Phase01ContractError("T6 thiếu sheetData.")

    removed_rows = 0
    removed_cells = 0

    def keep_row(row_match: re.Match[bytes]) -> bytes:
        nonlocal removed_rows, removed_cells
        row = row_match.group(0)
        row_raw = _attribute(row, b"r")
        if row_raw is None:
            raise Phase01ContractError("T6 có row thiếu số dòng.")
        if int(row_raw) > 333:
            removed_rows += 1
            return b""
        if row.endswith(b"/>"):
            return row

        def keep_cell(cell_match: re.Match[bytes]) -> bytes:
            nonlocal removed_cells
            cell = cell_match.group(0)
            reference_raw = _attribute(cell, b"r")
            if reference_raw is None:
                raise Phase01ContractError("T6 có cell thiếu tọa độ.")
            column, _ = split_cell_reference(reference_raw.decode("ascii"))
            if column_number(column) > 34:
                removed_cells += 1
                return b""
            return cell

        return CELL_RE.sub(keep_cell, row)

    patched_inner = ROW_RE.sub(keep_row, match.group(1))
    patched = (
        source[: match.start()]
        + b"<sheetData>"
        + patched_inner
        + b"</sheetData>"
        + source[match.end() :]
    )
    return patched, removed_rows, removed_cells


def _patch_t6_sheet(source: bytes) -> tuple[bytes, dict[str, int]]:
    patched = _replace_exactly_once(
        source,
        re.compile(rb'<dimension\b[^>]*/>'),
        b'<dimension ref="A1:AH333"/>',
        "T6 dimension",
    )
    patched = _patch_view(patched, "T6-26")
    patched = _replace_exactly_once(
        patched,
        re.compile(rb"<pageSetUpPr\b[^>]*/>"),
        b'<pageSetUpPr fitToPage="true"/>',
        "T6 pageSetUpPr",
    )
    patched = _trim_t6_columns(patched)
    patched, removed_rows, removed_cells = _trim_t6_sheet_data(patched)

    patched, formula_count = FORMULA_RE.subn(b"", patched)
    if formula_count != EXPECTED_LITERAL_NA_ERRORS:
        raise Phase01ContractError(
            f"T6 phải flatten {EXPECTED_LITERAL_NA_ERRORS} pseudo-formula, "
            f"thực tế {formula_count}."
        )

    patched = _replace_exactly_once(
        patched,
        re.compile(rb"<mergeCells\b[^>]*>.*?</mergeCells>", re.DOTALL),
        (
            b'<mergeCells count="2"><mergeCell ref="B1:Q1"/>'
            b'<mergeCell ref="B2:Q2"/></mergeCells>'
        ),
        "T6 merged cells",
    )
    patched = _replace_exactly_once(
        patched,
        re.compile(rb"<pageSetup\b[^>]*/>"),
        (
            b'<pageSetup paperSize="9" fitToWidth="1" fitToHeight="0" '
            b'pageOrder="downThenOver" orientation="landscape" '
            b'blackAndWhite="false" draft="false" cellComments="none" '
            b'horizontalDpi="300" verticalDpi="300" copies="1"/>'
        ),
        "T6 page setup",
    )
    patched, drawing_count = re.subn(
        rb'<drawing\b[^>]*\br:id="rId2"[^>]*/>', b"", patched
    )
    if drawing_count != 1:
        raise Phase01ContractError(
            f"T6 cần xóa đúng 1 empty drawing, thực tế {drawing_count}."
        )
    if not re.search(rb'<autoFilter\b[^>]*\bref="A4:AH333"', patched):
        raise Phase01ContractError("T6 autoFilter không còn A4:AH333.")
    if FORMULA_RE.search(patched):
        raise Phase01ContractError("T6 vẫn còn formula node sau cleanup.")
    ET.fromstring(patched)
    return patched, {
        "removed_rows": removed_rows,
        "removed_cells": removed_cells,
        "flattened_pseudo_formulas": formula_count,
    }


def _patch_workbook(source: bytes) -> bytes:
    def patch_workbook_view(match: re.Match[bytes]) -> bytes:
        element = match.group(0)
        element = re.sub(rb'\bfirstSheet="[0-9]+"', b'firstSheet="0"', element)
        element = re.sub(rb'\bactiveTab="[0-9]+"', b'activeTab="2"', element)
        return element

    patched, count = re.subn(
        rb"<workbookView\b[^>]*/>", patch_workbook_view, source, count=1
    )
    if count != 1:
        raise Phase01ContractError("Không patch được workbookView.")

    sheets = (
        b'<sheets><sheet name="GIAM" sheetId="1" state="visible" r:id="rId3"/>'
        b'<sheet name="T\xc4\x82NG" sheetId="5" state="visible" r:id="rId7"/>'
        b'<sheet name="T6-26" sheetId="7" state="visible" r:id="rId9"/></sheets>'
    )
    patched = _replace_exactly_once(
        patched,
        re.compile(rb"<sheets>.*?</sheets>", re.DOTALL),
        sheets,
        "workbook sheets",
    )
    defined_names = (
        b'<definedNames><definedName function="false" hidden="true" '
        b'localSheetId="2" name="_xlnm._FilterDatabase" vbProcedure="false">'
        b'&apos;T6-26&apos;!$A$4:$AH$333</definedName>'
        b'<definedName function="false" hidden="false" localSheetId="2" '
        b'name="_xlnm.Print_Area" vbProcedure="false">'
        b'&apos;T6-26&apos;!$A$1:$AH$333</definedName>'
        b'<definedName function="false" hidden="false" localSheetId="2" '
        b'name="_xlnm.Print_Titles" vbProcedure="false">'
        b'&apos;T6-26&apos;!$1:$4</definedName></definedNames>'
    )
    patched = _replace_exactly_once(
        patched,
        re.compile(rb"<definedNames>.*?</definedNames>", re.DOTALL),
        defined_names,
        "workbook defined names",
    )
    ET.fromstring(patched)
    return patched


CONTENT_TYPES_XML = b'''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet7.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/><Override PartName="/xl/comments7.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/><Override PartName="/xl/drawings/vmlDrawing1.vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/drawings/vmlDrawing4.vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''

ROOT_RELATIONSHIPS_XML = b'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''

WORKBOOK_RELATIONSHIPS_XML = b'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet7.xml"/></Relationships>'''

SHEET1_RELATIONSHIPS_XML = b'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/></Relationships>'''

SHEET7_RELATIONSHIPS_XML = b'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments7.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing4.vml"/></Relationships>'''

APP_PROPERTIES_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>BookingBase HR Phase 0.1</Application><AppVersion>1.0</AppVersion><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>3</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="3" baseType="lpstr"><vt:lpstr>GIAM</vt:lpstr><vt:lpstr>TĂNG</vt:lpstr><vt:lpstr>T6-26</vt:lpstr></vt:vector></TitlesOfParts></Properties>'''.encode("utf-8")


def build_phase01_bytes(formatted_source: Path) -> tuple[bytes, dict[str, int]]:
    """Return deterministic Phase 0.1 XLSX bytes and cleanup counters."""

    with zipfile.ZipFile(formatted_source) as source_archive:
        shared_strings = _shared_string_fragments(source_archive)
        missing = KEEP_PARTS.difference(source_archive.namelist()).difference(
            {"[Content_Types].xml", "docProps/app.xml"}
        )
        if missing:
            raise Phase01ContractError(
                f"Formatted source thiếu OOXML parts: {sorted(missing)}"
            )

        sheet1 = _patch_view(source_archive.read(SHEET_PARTS["GIAM"]), "GIAM")
        sheet5 = _patch_view(source_archive.read(SHEET_PARTS["TĂNG"]), "TĂNG")
        sheet7, cleanup = _patch_t6_sheet(
            source_archive.read(SHEET_PARTS["T6-26"])
        )

        converted_total = 0
        patched_sheets: dict[str, bytes] = {}
        for part, sheet in (
            (SHEET_PARTS["GIAM"], sheet1),
            (SHEET_PARTS["TĂNG"], sheet5),
            (SHEET_PARTS["T6-26"], sheet7),
        ):
            converted, count = _convert_shared_strings_to_inline(
                sheet, shared_strings
            )
            ET.fromstring(converted)
            patched_sheets[part] = converted
            converted_total += count
        if converted_total != EXPECTED_INLINE_STRING_CONVERSIONS:
            raise Phase01ContractError(
                "Số shared-string cells không đúng contract: "
                f"{converted_total}/{EXPECTED_INLINE_STRING_CONVERSIONS}."
            )

        replacements = {
            "[Content_Types].xml": CONTENT_TYPES_XML,
            "_rels/.rels": ROOT_RELATIONSHIPS_XML,
            "docProps/app.xml": APP_PROPERTIES_XML,
            "xl/workbook.xml": _patch_workbook(
                source_archive.read("xl/workbook.xml")
            ),
            "xl/_rels/workbook.xml.rels": WORKBOOK_RELATIONSHIPS_XML,
            "xl/worksheets/_rels/sheet1.xml.rels": SHEET1_RELATIONSHIPS_XML,
            "xl/worksheets/_rels/sheet7.xml.rels": SHEET7_RELATIONSHIPS_XML,
            **patched_sheets,
        }

        output_stream = io.BytesIO()
        with zipfile.ZipFile(
            output_stream, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
        ) as output_archive:
            written: set[str] = set()
            for info in source_archive.infolist():
                if info.filename not in KEEP_PARTS:
                    continue
                data = replacements.get(info.filename, source_archive.read(info.filename))
                output_archive.writestr(
                    info,
                    data,
                    compress_type=info.compress_type,
                    compresslevel=9,
                )
                written.add(info.filename)
            if written != KEEP_PARTS:
                raise Phase01ContractError(
                    f"OOXML parts ghi ra không đúng contract: {sorted(written)}"
                )

    result = output_stream.getvalue()
    cleanup["inline_string_cells"] = converted_total
    cleanup["removed_physical_sheets"] = 25
    cleanup["final_ooxml_parts"] = len(KEEP_PARTS)
    return result, cleanup


def write_bytes_atomic(
    path: Path,
    data: bytes,
    mode: int = 0o600,
    validate_temporary: Callable[[Path], None] | None = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        if validate_temporary is not None:
            validate_temporary(temporary)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def write_json_atomic(path: Path, value: dict) -> None:
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _relationship_target(base_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_part), target))


def _sheet_part_map(archive: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.get("Id", ""): _relationship_target(
            "xl/workbook.xml", relationship.get("Target", "")
        )
        for relationship in relationships.findall("pr:Relationship", NS)
    }
    result: dict[str, str] = {}
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        relationship_id = sheet.get(qname(DOCUMENT_REL_NS, "id"), "")
        if relationship_id not in targets:
            raise Phase01ContractError(
                f"Sheet {sheet.get('name')} thiếu relationship."
            )
        result[sheet.get("name", "")] = targets[relationship_id]
    return result


def _semantic_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(text.text or "" for text in item.iter(qname(MAIN_NS, "t")))
        for item in root.findall("m:si", NS)
    ]


def _canonical_number(value: str) -> str:
    try:
        decimal = Decimal(value)
    except InvalidOperation:
        return value
    if decimal == 0:
        return "0"
    normalized = decimal.normalize()
    return format(normalized, "f")


def _decode_cell(cell: ET.Element, strings: list[str]) -> CellSnapshot:
    cell_type = cell.get("t", "n")
    style = cell.get("s", "")
    value_node = cell.find("m:v", NS)
    value = value_node.text if value_node is not None else None

    if cell_type == "s":
        if value is None:
            decoded = None
        else:
            index = int(value)
            if not 0 <= index < len(strings):
                raise Phase01ContractError(f"Shared string index sai: {index}")
            decoded = strings[index]
        return CellSnapshot(style, "string" if decoded is not None else "blank", decoded)
    if cell_type == "inlineStr":
        inline = cell.find("m:is", NS)
        decoded = (
            "".join(text.text or "" for text in inline.iter(qname(MAIN_NS, "t")))
            if inline is not None
            else None
        )
        return CellSnapshot(style, "string" if decoded is not None else "blank", decoded)
    if value is None or value == "":
        return CellSnapshot(style, "blank", None)
    if cell_type == "e":
        return CellSnapshot(style, "error", value)
    if cell_type == "b":
        return CellSnapshot(style, "boolean", value)
    if cell_type in {"str", "d"}:
        return CellSnapshot(style, "string" if cell_type == "str" else "date", value)
    return CellSnapshot(style, "number", _canonical_number(value))


def read_sheet_cells(path: Path, sheet_name: str) -> dict[str, CellSnapshot]:
    with zipfile.ZipFile(path) as archive:
        part_map = _sheet_part_map(archive)
        if sheet_name not in part_map:
            raise Phase01ContractError(
                f"Không tìm thấy sheet {sheet_name} trong {display_path(path)}."
            )
        strings = _semantic_shared_strings(archive)
        root = ET.fromstring(archive.read(part_map[sheet_name]))
        result: dict[str, CellSnapshot] = {}
        for cell in root.findall("m:sheetData/m:row/m:c", NS):
            reference = cell.get("r")
            if reference:
                result[reference] = _decode_cell(cell, strings)
        return result


def _nonempty_values(cells: dict[str, CellSnapshot]) -> dict[str, str]:
    return {
        reference: snapshot.value
        for reference, snapshot in cells.items()
        if snapshot.value not in {None, ""}
    }


def _comments_for_sheet(path: Path, sheet_name: str) -> dict[str, str]:
    with zipfile.ZipFile(path) as archive:
        sheet_part = _sheet_part_map(archive).get(sheet_name)
        if not sheet_part:
            raise Phase01ContractError(f"Không tìm thấy sheet comments: {sheet_name}")
        directory, filename = posixpath.split(sheet_part)
        rels_part = posixpath.join(directory, "_rels", f"{filename}.rels")
        if rels_part not in archive.namelist():
            return {}
        relationships = ET.fromstring(archive.read(rels_part))
        comments_part = None
        for relationship in relationships.findall("pr:Relationship", NS):
            if relationship.get("Type", "").endswith("/comments"):
                comments_part = _relationship_target(
                    sheet_part, relationship.get("Target", "")
                )
                break
        if not comments_part:
            return {}
        root = ET.fromstring(archive.read(comments_part))
        return {
            comment.get("ref", ""): "".join(
                text.text or "" for text in comment.iter(qname(MAIN_NS, "t"))
            )
            for comment in root.findall("m:commentList/m:comment", NS)
        }


def compare_with_original(original: Path, baseline: Path) -> dict:
    original_t6 = read_sheet_cells(original, "T6-26")
    baseline_t6 = read_sheet_cells(baseline, "T6-26")
    mismatches: list[str] = []
    checked = 0
    for row in range(5, 334):
        for new_column, source_column in T6_COLUMN_MAPPING.items():
            checked += 1
            new_reference = f"{new_column}{row}"
            source_reference = f"{source_column}{row}"
            new_value = baseline_t6.get(
                new_reference, CellSnapshot("", "blank", None)
            ).value
            source_value = original_t6.get(
                source_reference, CellSnapshot("", "blank", None)
            ).value
            if new_value != source_value:
                mismatches.append(f"{new_reference}<-{source_reference}")
    if checked != EXPECTED_T6_MAPPED_CELLS or mismatches:
        raise Phase01ContractError(
            "Đối chiếu T6 với file gốc thất bại: "
            f"checked={checked}, mismatches={mismatches[:10]}"
        )

    operational: dict[str, dict[str, int]] = {}
    for sheet_name in ("GIAM", "TĂNG"):
        original_values = _nonempty_values(read_sheet_cells(original, sheet_name))
        baseline_values = _nonempty_values(read_sheet_cells(baseline, sheet_name))
        coordinates = set(original_values) | set(baseline_values)
        sheet_mismatches = [
            reference
            for reference in coordinates
            if original_values.get(reference) != baseline_values.get(reference)
        ]
        if (
            len(coordinates) != EXPECTED_ORIGINAL_NONEMPTY[sheet_name]
            or sheet_mismatches
        ):
            raise Phase01ContractError(
                f"Đối chiếu {sheet_name} thất bại: cells={len(coordinates)}, "
                f"mismatches={sheet_mismatches[:10]}"
            )
        operational[sheet_name] = {
            "nonempty_cells_checked": len(coordinates),
            "mismatches": 0,
        }

    source_comments = _comments_for_sheet(original, "T6-26")
    baseline_comments = _comments_for_sheet(baseline, "T6-26")
    source_to_new = {source: new for new, source in T6_COLUMN_MAPPING.items()}
    mapped_comments: dict[str, str] = {}
    for reference, text in source_comments.items():
        column, row = split_cell_reference(reference)
        if column in source_to_new:
            mapped_comments[f"{source_to_new[column]}{row}"] = text
    if mapped_comments != baseline_comments:
        raise Phase01ContractError(
            "Comment T6 không khớp file gốc sau mapping cột."
        )

    return {
        "T6-26": {
            "employee_rows": EXPECTED_T6_EMPLOYEES,
            "mapped_columns": len(T6_COLUMN_MAPPING),
            "cells_checked": checked,
            "mismatches": 0,
            "comments_checked": len(mapped_comments),
            "comment_mismatches": 0,
        },
        **operational,
    }


def _filter_retained_cells(
    cells: dict[str, CellSnapshot], sheet_name: str
) -> dict[str, CellSnapshot]:
    if sheet_name != "T6-26":
        return cells
    result: dict[str, CellSnapshot] = {}
    for reference, snapshot in cells.items():
        column, row = split_cell_reference(reference)
        if row <= 333 and column_number(column) <= 34:
            result[reference] = snapshot
    return result


def compare_with_formatted_source(
    formatted_source: Path, baseline: Path
) -> dict[str, dict[str, int]]:
    result: dict[str, dict[str, int]] = {}
    for sheet_name in VISIBLE_SHEETS:
        source_cells = _filter_retained_cells(
            read_sheet_cells(formatted_source, sheet_name), sheet_name
        )
        baseline_cells = read_sheet_cells(baseline, sheet_name)
        if source_cells != baseline_cells:
            coordinates = sorted(set(source_cells) | set(baseline_cells))
            mismatches = [
                reference
                for reference in coordinates
                if source_cells.get(reference) != baseline_cells.get(reference)
            ]
            raise Phase01ContractError(
                f"Cell/style snapshot {sheet_name} đổi ngoài ý muốn: "
                f"{mismatches[:10]}"
            )
        result[sheet_name] = {
            "retained_cells": len(source_cells),
            "cell_or_style_mismatches": 0,
        }

    with zipfile.ZipFile(formatted_source) as source_archive, zipfile.ZipFile(
        baseline
    ) as baseline_archive:
        if source_archive.read("xl/styles.xml") != baseline_archive.read(
            "xl/styles.xml"
        ):
            raise Phase01ContractError("styles.xml đã bị thay đổi.")
        for part in (
            "xl/comments1.xml",
            "xl/comments7.xml",
            "xl/drawings/vmlDrawing1.vml",
            "xl/drawings/vmlDrawing4.vml",
        ):
            if source_archive.read(part) != baseline_archive.read(part):
                raise Phase01ContractError(f"Part comment/VML bị thay đổi: {part}")
    return result


def _relationship_source_part(rels_part: str) -> str:
    if rels_part == "_rels/.rels":
        return ""
    directory, filename = posixpath.split(rels_part)
    if posixpath.basename(directory) != "_rels" or not filename.endswith(".rels"):
        raise Phase01ContractError(f"Relationship part sai cấu trúc: {rels_part}")
    source_directory = posixpath.dirname(directory)
    return posixpath.join(source_directory, filename[: -len(".rels")])


def _verify_relationships(archive: zipfile.ZipFile) -> None:
    names = set(archive.namelist())
    for rels_part in sorted(name for name in names if name.endswith(".rels")):
        source_part = _relationship_source_part(rels_part)
        root = ET.fromstring(archive.read(rels_part))
        for relationship in root.findall("pr:Relationship", NS):
            if relationship.get("TargetMode") == "External":
                raise Phase01ContractError("Final workbook có external relationship.")
            target = _relationship_target(
                source_part, relationship.get("Target", "")
            )
            if target not in names:
                raise Phase01ContractError(
                    f"Dangling relationship {rels_part} -> {target}"
                )


def inspect_baseline(path: Path) -> dict:
    _require_file(path, "Phase 0.1 baseline")
    with zipfile.ZipFile(path) as archive:
        bad_part = archive.testzip()
        if bad_part:
            raise Phase01ContractError(f"Final ZIP hỏng tại {bad_part}.")
        names = set(archive.namelist())
        if names != KEEP_PARTS:
            raise Phase01ContractError(
                "Final OOXML parts không đúng contract. "
                f"missing={sorted(KEEP_PARTS - names)}, extra={sorted(names - KEEP_PARTS)}"
            )
        _verify_relationships(archive)

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet_nodes = workbook.findall("m:sheets/m:sheet", NS)
        sheet_names = tuple(sheet.get("name", "") for sheet in sheet_nodes)
        if sheet_names != VISIBLE_SHEETS:
            raise Phase01ContractError(f"Sai danh sách sheet: {sheet_names}")
        if any(sheet.get("state", "visible") != "visible" for sheet in sheet_nodes):
            raise Phase01ContractError("Final workbook vẫn còn sheet ẩn.")
        workbook_view = workbook.find("m:bookViews/m:workbookView", NS)
        if workbook_view is None or workbook_view.get("activeTab") != "2":
            raise Phase01ContractError("Active tab không phải T6-26.")
        defined_names = {
            (node.get("name", ""), node.get("localSheetId", "")): node.text
            for node in workbook.findall("m:definedNames/m:definedName", NS)
        }
        expected_names = {
            ("_xlnm._FilterDatabase", "2"): "'T6-26'!$A$4:$AH$333",
            ("_xlnm.Print_Area", "2"): "'T6-26'!$A$1:$AH$333",
            ("_xlnm.Print_Titles", "2"): "'T6-26'!$1:$4",
        }
        if defined_names != expected_names:
            raise Phase01ContractError(f"Defined names sai: {defined_names}")

        formula_count = 0
        shared_string_refs = 0
        for part in SHEET_PARTS.values():
            payload = archive.read(part)
            formula_count += len(FORMULA_RE.findall(payload))
            shared_string_refs += len(
                re.findall(rb'<c\b[^>]*\bt="s"', payload)
            )
        if formula_count or shared_string_refs:
            raise Phase01ContractError(
                f"Final còn formula/shared-string refs: {formula_count}/{shared_string_refs}."
            )

        t6_root = ET.fromstring(archive.read(SHEET_PARTS["T6-26"]))
        dimension = t6_root.find("m:dimension", NS)
        auto_filter = t6_root.find("m:autoFilter", NS)
        if dimension is None or dimension.get("ref") != "A1:AH333":
            raise Phase01ContractError("T6 dimension không phải A1:AH333.")
        if auto_filter is None or auto_filter.get("ref") != "A4:AH333":
            raise Phase01ContractError("T6 filter không phải A4:AH333.")
        merge_refs = [
            merge.get("ref", "")
            for merge in t6_root.findall("m:mergeCells/m:mergeCell", NS)
        ]
        if merge_refs != ["B1:Q1", "B2:Q2"]:
            raise Phase01ContractError(f"T6 merge cells sai: {merge_refs}")

        pane = t6_root.find("m:sheetViews/m:sheetView/m:pane", NS)
        expected_pane = {
            "xSplit": "5",
            "ySplit": "4",
            "topLeftCell": "F5",
            "activePane": "bottomRight",
            "state": "frozen",
        }
        if pane is None or any(pane.get(key) != value for key, value in expected_pane.items()):
            raise Phase01ContractError("T6 freeze pane không đúng F5.")

        page_setup = t6_root.find("m:pageSetup", NS)
        if page_setup is None or any(
            page_setup.get(key) != value
            for key, value in {
                "paperSize": "9",
                "fitToWidth": "1",
                "fitToHeight": "0",
                "orientation": "landscape",
            }.items()
        ):
            raise Phase01ContractError("T6 print setup không đúng contract.")

        max_row = 0
        max_column = 0
        literal_na_errors = 0
        for cell in t6_root.findall("m:sheetData/m:row/m:c", NS):
            reference = cell.get("r", "")
            column, row = split_cell_reference(reference)
            max_row = max(max_row, row)
            max_column = max(max_column, column_number(column))
            value = cell.find("m:v", NS)
            if cell.get("t") == "e" and value is not None and value.text == "#N/A":
                literal_na_errors += 1
        if max_row != 333 or max_column != 34:
            raise Phase01ContractError(
                f"T6 cell bounds sai: row={max_row}, col={max_column}."
            )
        if literal_na_errors != EXPECTED_LITERAL_NA_ERRORS:
            raise Phase01ContractError(
                f"T6 #N/A literal sai: {literal_na_errors}/{EXPECTED_LITERAL_NA_ERRORS}."
            )

        comment_counts = {
            sheet_name: len(_comments_for_sheet(path, sheet_name))
            for sheet_name in VISIBLE_SHEETS
        }
        if comment_counts != EXPECTED_COMMENTS:
            raise Phase01ContractError(f"Comment counts sai: {comment_counts}")

    cells = read_sheet_cells(path, "T6-26")
    codes = [cells[f"C{row}"].value for row in range(5, 334)]
    if any(code in {None, ""} for code in codes) or len(set(codes)) != 329:
        raise Phase01ContractError("T6 không còn đủ 329 mã nhân viên duy nhất.")
    leave_values = [cells[f"AH{row}"].value for row in range(5, 334)]
    if any(value not in {None, ""} for value in leave_values):
        raise Phase01ContractError("Cột ngày nghỉ phép AH chưa để trống.")
    if cells["AH4"].value != "NGÀY NGHỈ PHÉP":
        raise Phase01ContractError("Header AH4 không phải NGÀY NGHỈ PHÉP.")

    mode = stat.S_IMODE(path.stat().st_mode)
    if mode != 0o600:
        raise Phase01ContractError(f"Baseline permission phải là 0600, actual {mode:04o}.")

    return {
        "sheet_count": 3,
        "visible_sheets": list(VISIBLE_SHEETS),
        "hidden_sheet_count": 0,
        "formula_count": 0,
        "shared_strings_part": False,
        "ooxml_part_count": len(KEEP_PARTS),
        "T6-26": {
            "range": "A1:AH333",
            "employee_rows": len(codes),
            "unique_employee_codes": len(set(codes)),
            "leave_column": "AH",
            "leave_values_nonempty": 0,
            "literal_na_errors": EXPECTED_LITERAL_NA_ERRORS,
            "comments": EXPECTED_COMMENTS["T6-26"],
            "freeze_pane": "F5",
            "print_area": "A1:AH333",
        },
        "comments": comment_counts,
        "permissions": "0600",
    }


def _file_metadata(path: Path) -> dict[str, str | int]:
    return {
        "path": display_path(path),
        "sha256": sha256_file(path),
        "size_bytes": path.stat().st_size,
    }


def build_manifest(
    original: Path,
    formatted_source: Path,
    baseline: Path,
    cleanup: dict[str, int] | None = None,
) -> dict:
    inspection = inspect_baseline(baseline)
    original_comparison = compare_with_original(original, baseline)
    formatted_comparison = compare_with_formatted_source(formatted_source, baseline)
    cleanup_values = cleanup or {
        "removed_rows": 667,
        "removed_cells": 0,
        "flattened_pseudo_formulas": EXPECTED_LITERAL_NA_ERRORS,
        "inline_string_cells": EXPECTED_INLINE_STRING_CONVERSIONS,
        "removed_physical_sheets": 25,
        "final_ooxml_parts": len(KEEP_PARTS),
    }
    return {
        "schema_version": 1,
        "phase": "0.1",
        "status": "COMPLETE",
        "artifacts": {
            "original": _file_metadata(original),
            "formatted_source_archive": _file_metadata(formatted_source),
            "baseline": _file_metadata(baseline),
        },
        "contract": inspection,
        "comparison_to_original": original_comparison,
        "comparison_to_formatted_source": formatted_comparison,
        "cleanup": cleanup_values,
        "privacy": {
            "contains_personal_employee_data": True,
            "git_ignored": True,
            "shareable_blank_template": False,
            "manifest_contains_employee_values": False,
        },
    }


def create_phase01(
    original: Path,
    formatted_source: Path,
    baseline: Path,
    manifest: Path,
) -> dict:
    paths = tuple(path.resolve() for path in (original, formatted_source, baseline, manifest))
    original, formatted_source, baseline, manifest = paths
    if len(set(paths)) != len(paths):
        raise Phase01ContractError("Input/output paths của Phase 0.1 phải khác nhau.")
    validate_inputs(original, formatted_source)
    output_bytes, cleanup = build_phase01_bytes(formatted_source)

    def verify_temporary(candidate: Path) -> None:
        inspect_baseline(candidate)
        compare_with_original(original, candidate)
        compare_with_formatted_source(formatted_source, candidate)

    write_bytes_atomic(
        baseline,
        output_bytes,
        mode=0o600,
        validate_temporary=verify_temporary,
    )
    result = build_manifest(original, formatted_source, baseline, cleanup)
    write_json_atomic(manifest, result)
    return result


def verify_phase01(
    original: Path,
    formatted_source: Path,
    baseline: Path,
    manifest: Path,
) -> dict:
    original = original.resolve()
    formatted_source = formatted_source.resolve()
    baseline = baseline.resolve()
    manifest = manifest.resolve()
    validate_inputs(original, formatted_source)
    _require_file(manifest, "Phase 0.1 manifest")

    expected_bytes, cleanup = build_phase01_bytes(formatted_source)
    actual_bytes = baseline.read_bytes()
    if actual_bytes != expected_bytes:
        raise Phase01ContractError(
            "Baseline không byte-identical với deterministic Phase 0.1 transform."
        )
    expected = build_manifest(original, formatted_source, baseline, cleanup)
    actual = json.loads(manifest.read_text(encoding="utf-8"))
    if actual != expected:
        raise Phase01ContractError("Manifest không khớp workbook/contract hiện tại.")
    return expected
