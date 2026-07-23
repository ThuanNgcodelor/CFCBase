#!/usr/bin/env python3
"""Build the locked June 2026 baseline workbook with 339 employees.

The user-formatted workbook remains an immutable source. This builder makes
only deterministic OOXML corrections required by the import contract:

- normalizes the three sheet names to ``TĂNG``, ``GIẢM`` and ``T6-26``;
- completes the ten G074..G083 entries in the TĂNG report;
- fixes the one-row derived-total mismatch at A441;
- clears the copied CCCD value at G083 instead of guessing legal identity data;
- trims blank formatting outside the 34-column baseline contract; and
- expands the filter to all 339 active rows.

There is intentionally no hidden 329-person sheet. The confirmed historical
truth is one closed June roster, ``T6-26 = 339``.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import stat
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "Baseline-value-339-2026.xlsx"
)
DEFAULT_OUTPUT = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "workforce-baseline-339-2026.xlsx"
)

SOURCE_SHA256 = "f229ddb4157a54fcf5fb60b5dce64fe1e8bbc3a38746739a3d94d83bc8e83043"
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

CELL_RE = re.compile(rb"(?:<c\b[^>]*/>|<c\b[^>]*>.*?</c>)", re.DOTALL)
COL_RE = re.compile(rb"<col\b[^>]*/>")
CELL_REF_RE = re.compile(r"^([A-Z]{1,3})([0-9]+)$")


class WorkforceUpdateBuildError(RuntimeError):
    """Raised when the source or generated artifact breaks the locked contract."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def column_number(column: str) -> int:
    result = 0
    for character in column:
        result = result * 26 + ord(character) - ord("A") + 1
    return result


def split_cell_reference(reference: str) -> tuple[str, int]:
    match = CELL_REF_RE.fullmatch(reference)
    if not match:
        raise WorkforceUpdateBuildError(f"Tọa độ ô không hợp lệ: {reference}")
    return match.group(1), int(match.group(2))


def cell_reference(cell: bytes) -> str:
    match = re.search(rb'\br="([A-Z]{1,3}[0-9]+)"', cell)
    if not match:
        raise WorkforceUpdateBuildError("Cell không có tọa độ.")
    return match.group(1).decode("ascii")


def replace_cell(source: bytes, reference: str, replacement: bytes) -> bytes:
    found = 0

    def replace(match: re.Match[bytes]) -> bytes:
        nonlocal found
        cell = match.group(0)
        if cell_reference(cell) != reference:
            return cell
        found += 1
        return replacement

    patched = CELL_RE.sub(replace, source)
    if found != 1:
        raise WorkforceUpdateBuildError(
            f"Cần patch đúng một ô {reference}, thực tế {found}."
        )
    return patched


def inline_string_cell(reference: str, style: int, value: str) -> bytes:
    escaped = (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return (
        f'<c r="{reference}" s="{style}" t="inlineStr"><is><t>{escaped}</t></is></c>'
    ).encode("utf-8")


def numeric_cell(reference: str, style: int, value: int) -> bytes:
    return f'<c r="{reference}" s="{style}" t="n"><v>{value}</v></c>'.encode()


def value_only_inline_string_cell(reference: str, value: str) -> bytes:
    escaped = (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return (
        f'<c r="{reference}" t="inlineStr"><is>'
        f'<t xml:space="preserve">{escaped}</t></is></c>'
    ).encode("utf-8")


def value_only_scalar_cell(reference: str, cell_type: str | None, value: str) -> bytes:
    escaped = (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    type_attribute = f' t="{cell_type}"' if cell_type else ""
    return (
        f'<c r="{reference}"{type_attribute}><v>{escaped}</v></c>'
    ).encode("utf-8")


def trim_snapshot_cells(source: bytes) -> bytes:
    def keep(cell_match: re.Match[bytes]) -> bytes:
        cell = cell_match.group(0)
        column, row = split_cell_reference(cell_reference(cell))
        if column_number(column) > 34 or row > 343:
            return b""
        return cell

    return CELL_RE.sub(keep, source)


def trim_snapshot_columns(source: bytes) -> bytes:
    cols_match = re.search(rb"<cols>(.*?)</cols>", source, re.DOTALL)
    if not cols_match:
        raise WorkforceUpdateBuildError("Sheet T7-26 thiếu định nghĩa cột.")

    def keep(column_match: re.Match[bytes]) -> bytes:
        element = column_match.group(0)
        minimum_match = re.search(rb'\bmin="([0-9]+)"', element)
        maximum_match = re.search(rb'\bmax="([0-9]+)"', element)
        if not minimum_match or not maximum_match:
            raise WorkforceUpdateBuildError("Định nghĩa cột thiếu min/max.")
        minimum = int(minimum_match.group(1))
        maximum = int(maximum_match.group(1))
        if minimum > 34:
            return b""
        if maximum > 34:
            return re.sub(rb'\bmax="[0-9]+"', b'max="34"', element, count=1)
        return element

    patched_inner = COL_RE.sub(keep, cols_match.group(1))
    return (
        source[: cols_match.start()]
        + b"<cols>"
        + patched_inner
        + b"</cols>"
        + source[cols_match.end() :]
    )


def patch_workbook(source: bytes) -> bytes:
    replacements = (
        (b'name="Gi\xe1\xba\xa3m"', b'name="GI\xe1\xba\xa2M"'),
        (b'name="T6 12"', b'name="T6-26"'),
        (b"&apos;T6 12&apos;", b"&apos;T6-26&apos;"),
        (b"$A$4:$AH$333", b"$A$4:$AH$343"),
    )
    patched = source
    for old, new in replacements:
        if old not in patched:
            raise WorkforceUpdateBuildError(
                f"Không tìm thấy workbook marker cần sửa: {old!r}"
            )
        patched = patched.replace(old, new)

    return patched


def patch_increase_sheet(source: bytes) -> bytes:
    patched = source
    for offset, row in enumerate(range(47, 57)):
        code = f"G{74 + offset:03d}"
        patched = replace_cell(
            patched,
            f"C{row}",
            inline_string_cell(f"C{row}", 60, code),
        )

    # Reuse the shared-string entry already referenced by T6-26!E341.  This
    # avoids duplicating a person's name in the builder source.
    patched = replace_cell(
        patched,
        "D56",
        b'<c r="D56" s="46" t="s"><v>3228</v></c>',
    )
    patched = replace_cell(patched, "L56", numeric_cell("L56", 68, 41))
    return patched


def patch_snapshot_sheet(source: bytes) -> bytes:
    patched = trim_snapshot_cells(source)
    patched = trim_snapshot_columns(patched)
    patched, dimension_count = re.subn(
        rb'<dimension ref="[^"]+"/>',
        b'<dimension ref="A1:AH343"/>',
        patched,
        count=1,
    )
    if dimension_count != 1:
        raise WorkforceUpdateBuildError("Không patch được dimension T6-26.")
    patched, filter_count = re.subn(
        rb'<autoFilter ref="[^"]+">',
        b'<autoFilter ref="A4:AH343">',
        patched,
        count=1,
    )
    if filter_count != 1:
        raise WorkforceUpdateBuildError("Không patch được autoFilter T6-26.")

    patched = replace_cell(
        patched,
        "I90",
        numeric_cell("I90", 282, 6_579_000),
    )
    # G083 currently repeats G082's CCCD.  Keep the cell/style but do not
    # import an identity number that cannot be verified from the source.
    patched = replace_cell(patched, "U341", b'<c r="U341" s="438"/>')
    return patched


def workbook_sheet_parts(archive: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(
        archive.read("xl/_rels/workbook.xml.rels")
    )
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall("pr:Relationship", NS)
    }
    result: dict[str, str] = {}
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        relationship_id = sheet.attrib[
            f"{{{DOCUMENT_REL_NS}}}id"
        ]
        target = targets[relationship_id].lstrip("/")
        if not target.startswith("xl/"):
            target = f"xl/{target}"
        result[sheet.attrib["name"]] = target
    return result


def shared_string_values(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(
            text.text or ""
            for text in item.iter(f"{{{MAIN_NS}}}t")
        )
        for item in root.findall("m:si", NS)
    ]


def cell_data_value(
    cell: ET.Element,
    shared_strings: list[str],
) -> tuple[str, str] | None:
    cell_type = cell.attrib.get("t")
    value = cell.findtext("m:v", default=None, namespaces=NS)

    if cell_type == "s":
        if value is None:
            raise WorkforceUpdateBuildError("Ô shared string thiếu chỉ số.")
        index = int(value)
        if index < 0 or index >= len(shared_strings):
            raise WorkforceUpdateBuildError("Chỉ số shared string vượt phạm vi.")
        return "string", shared_strings[index]

    if cell_type == "inlineStr":
        inline = cell.find("m:is", NS)
        if inline is None:
            raise WorkforceUpdateBuildError("Ô inline string thiếu nội dung.")
        return (
            "string",
            "".join(
                text.text or ""
                for text in inline.iter(f"{{{MAIN_NS}}}t")
            ),
        )

    if cell_type == "str":
        return "string", value or ""

    if value is None:
        return None
    if cell_type not in {None, "n", "b", "e", "d"}:
        raise WorkforceUpdateBuildError(
            f"Kiểu ô baseline chưa được hỗ trợ: {cell_type}"
        )
    return cell_type or "n", value


def worksheet_data(
    worksheet: bytes,
    shared_strings: list[str],
) -> dict[str, tuple[str, str]]:
    root = ET.fromstring(worksheet)
    result: dict[str, tuple[str, str]] = {}
    for cell in root.findall("m:sheetData/m:row/m:c", NS):
        reference = cell.attrib.get("r")
        if not reference:
            raise WorkforceUpdateBuildError("Ô baseline thiếu tọa độ.")
        data = cell_data_value(cell, shared_strings)
        if data is not None:
            result[reference] = data
    return result


def deterministic_sheet_info(
    template: zipfile.ZipInfo,
    filename: str,
) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(filename=filename, date_time=template.date_time)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = template.create_system
    info.create_version = template.create_version
    info.extract_version = template.extract_version
    info.external_attr = template.external_attr
    info.internal_attr = template.internal_attr
    return info


def verify_output(archive: zipfile.ZipFile) -> None:
    sheets = workbook_sheet_parts(archive)
    if set(sheets) != {"TĂNG", "GIẢM", "T6-26"}:
        raise WorkforceUpdateBuildError("Danh sách sheet kết quả không đúng.")

    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    states = {
        sheet.attrib["name"]: sheet.attrib.get("state", "visible")
        for sheet in workbook.findall("m:sheets/m:sheet", NS)
    }
    if states != {
        "TĂNG": "visible",
        "GIẢM": "visible",
        "T6-26": "visible",
    }:
        raise WorkforceUpdateBuildError("Trạng thái ẩn/hiện của sheet không đúng.")

    snapshot_data = worksheet_data(
        archive.read(sheets["T6-26"]),
        shared_string_values(archive),
    )
    employee_codes = {
        snapshot_data[f"C{row}"][1]
        for row in range(5, 344)
        if f"C{row}" in snapshot_data
    }
    if len(employee_codes) != 339:
        raise WorkforceUpdateBuildError(
            "Sheet T6-26 phải có đúng 339 mã nhân viên duy nhất."
        )

    for name, part in sheets.items():
        worksheet = ET.fromstring(archive.read(part))
        if worksheet.findall(".//m:f", NS):
            raise WorkforceUpdateBuildError(
                f"Sheet {name} vẫn còn công thức."
            )


def build(source_path: Path, output_path: Path) -> None:
    if not source_path.is_file():
        raise WorkforceUpdateBuildError(f"Không tìm thấy file nguồn: {source_path}")
    actual_source_hash = sha256_file(source_path)
    if actual_source_hash != SOURCE_SHA256:
        raise WorkforceUpdateBuildError(
            "File nguồn 339 đã thay đổi; dừng build để tránh sửa nhầm dữ liệu."
        )
    with zipfile.ZipFile(source_path) as source_archive:
        bad_part = source_archive.testzip()
        if bad_part:
            raise WorkforceUpdateBuildError(f"Workbook nguồn hỏng tại {bad_part}.")
        sheet_parts = workbook_sheet_parts(source_archive)
        if set(sheet_parts) != {"TĂNG", "Giảm", "T6 12"}:
            raise WorkforceUpdateBuildError("Danh sách sheet nguồn không đúng.")

        patched_parts: dict[str, bytes] = {}
        for info in source_archive.infolist():
            data = source_archive.read(info.filename)
            if info.filename == "xl/workbook.xml":
                data = patch_workbook(data)
            elif info.filename == sheet_parts["TĂNG"]:
                data = patch_increase_sheet(data)
            elif info.filename == sheet_parts["T6 12"]:
                data = patch_snapshot_sheet(data)
            patched_parts[info.filename] = data

        output_path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            dir=output_path.parent,
        )
        os.close(descriptor)
        temporary_path = Path(temporary_name)
        try:
            with zipfile.ZipFile(
                temporary_path,
                "w",
                compression=zipfile.ZIP_DEFLATED,
                compresslevel=9,
            ) as output_archive:
                for info in source_archive.infolist():
                    output_archive.writestr(info, patched_parts[info.filename])
            with zipfile.ZipFile(temporary_path) as verification_archive:
                bad_part = verification_archive.testzip()
                if bad_part:
                    raise WorkforceUpdateBuildError(
                        f"Workbook kết quả hỏng tại {bad_part}."
                    )
                verify_output(verification_archive)
            os.replace(temporary_path, output_path)
            output_path.chmod(stat.S_IRUSR | stat.S_IWUSR)
        finally:
            temporary_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tạo artifact baseline T6-26 gồm 339 nhân sự."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    try:
        build(args.source, args.output)
    except (OSError, zipfile.BadZipFile, ET.ParseError, WorkforceUpdateBuildError) as exc:
        print(f"[HR Workforce Update Build] ERROR: {exc}")
        return 1

    print("[HR Workforce Update Build] PASS")
    print(f"  Output: {args.output}")
    print(f"  SHA-256: {sha256_file(args.output)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
