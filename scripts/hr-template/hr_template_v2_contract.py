#!/usr/bin/env python3
"""Build and verify the clean-view HR template v2.

Template v2 is derived from the verified v1 package.  It does not delete or
round-trip any worksheet.  Only workbook visibility metadata and the GIAM tab
label are changed, so every formula dependency remains available.
"""

from __future__ import annotations

import json
import os
import re
import stat
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

from hr_template_contract import (
    DEFAULT_MANIFEST,
    DEFAULT_SOURCE,
    DEFAULT_TEMPLATE,
    PRIVACY_CONTRACT,
    REPOSITORY_ROOT,
    TemplateContractError,
    inspect_workbook,
    secure_workbook_permissions,
    sha256_file,
    validate_contract_paths,
    verify_manifest as verify_v1_manifest,
    write_json_atomic,
)


DEFAULT_V2_TEMPLATE = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "Danh sách nhân sự 2026 - template-v2-clean.xlsx"
)
DEFAULT_V2_MANIFEST = (
    REPOSITORY_ROOT
    / "docs"
    / "hr-template"
    / "template-v2-clean-manifest.json"
)

V1_TEMPLATE_SHA256 = "03f5b8dd8da693220f0229db42e2f7e776b6349931957dada1d03f43c3cb2357"
WORKBOOK_PART = "xl/workbook.xml"
ALLOWED_CHANGED_PARTS = (WORKBOOK_PART,)

VISIBLE_SOURCE_SHEETS = (
    "GIAM",
    "TĂNG",
    "T1-26",
    "T2-26",
    "T3-26",
    "T4-26 ",
    "T5-26",
    "T6-26",
)
VISIBLE_OUTPUT_SHEETS = (
    "GIAM",
    "TĂNG",
    "T1-26",
    "T2-26",
    "T3-26",
    "T4-26 ",
    "T5-26",
    "T6-26",
)

VISIBILITY_CONTRACT = {
    "mode": "CLEAN_VIEW_HIDE_UNUSED_SHEETS",
    "source_template_version": 1,
    "visible_sheets": list(VISIBLE_OUTPUT_SHEETS),
    "visible_business_sheet_count": len(VISIBLE_OUTPUT_SHEETS),
    "hidden_sheet_count": 25,
    "renamed_sheets": {},
    "active_sheet": "T6-26",
    "first_visible_sheet": "GIAM",
    "delete_worksheets": False,
    "preserve_formula_dependencies": True,
    "allowed_changed_ooxml_parts": list(ALLOWED_CHANGED_PARTS),
}

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def _set_sheet_state(sheet_tag: str, visible: bool) -> str:
    tag = re.sub(r'\sstate="(?:hidden|veryHidden)"', "", sheet_tag)
    if visible:
        return tag
    updated, count = re.subn(r'(\sr:id=")', r' state="hidden"\1', tag, count=1)
    if count != 1:
        raise TemplateContractError("Không tìm thấy r:id để ẩn worksheet.")
    return updated


def patch_workbook_visibility(source_xml: bytes) -> bytes:
    try:
        xml_text = source_xml.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise TemplateContractError("workbook.xml không dùng UTF-8.") from exc

    seen_names: list[str] = []
    visible_names: list[str] = []
    sheet_pattern = re.compile(r"<sheet\b[^>]*/>")

    def patch_sheet(match: re.Match[str]) -> str:
        tag = match.group(0)
        name_match = re.search(r'\bname="([^"]*)"', tag)
        if not name_match:
            raise TemplateContractError("Worksheet thiếu attribute name.")
        source_name = name_match.group(1)
        seen_names.append(source_name)
        visible = source_name in VISIBLE_SOURCE_SHEETS
        tag = _set_sheet_state(tag, visible)
        if visible:
            visible_names.append(source_name)
        return tag

    patched_text, sheet_count = sheet_pattern.subn(patch_sheet, xml_text)
    if sheet_count != 33 or len(seen_names) != 33:
        raise TemplateContractError(
            f"Workbook cần đúng 33 worksheet, thực tế {sheet_count}."
        )
    if tuple(visible_names) != VISIBLE_OUTPUT_SHEETS:
        raise TemplateContractError(
            f"Danh sách sheet hiển thị không đúng: {visible_names}"
        )

    workbook_view = re.search(r"<workbookView\b[^>]*/>", patched_text)
    if not workbook_view:
        raise TemplateContractError("Không tìm thấy workbookView.")
    view_tag = workbook_view.group(0)
    if 'activeTab="11"' not in view_tag:
        raise TemplateContractError("T6-26 không còn là activeTab baseline 11.")
    if re.search(r'\bfirstSheet="[^"]*"', view_tag):
        view_tag = re.sub(r'\bfirstSheet="[^"]*"', 'firstSheet="0"', view_tag)
    else:
        view_tag = view_tag[:-2] + ' firstSheet="0"/>'
    patched_text = (
        patched_text[: workbook_view.start()]
        + view_tag
        + patched_text[workbook_view.end() :]
    )

    patched_bytes = patched_text.encode("utf-8")
    try:
        ET.fromstring(patched_bytes)
    except ET.ParseError as exc:
        raise TemplateContractError("workbook.xml v2 không hợp lệ.") from exc
    return patched_bytes


def _patch_member(member: str, content: bytes) -> bytes:
    if member == WORKBOOK_PART:
        return patch_workbook_visibility(content)
    return content


def _workbook_view(path: Path) -> dict[str, str]:
    with zipfile.ZipFile(path, "r") as archive:
        root = ET.fromstring(archive.read(WORKBOOK_PART))
    view = root.find(f"{{{MAIN_NS}}}bookViews/{{{MAIN_NS}}}workbookView")
    if view is None:
        raise TemplateContractError("Không đọc được workbookView từ template v2.")
    return dict(sorted(view.attrib.items()))


def _validate_v2_paths(
    source: Path,
    v1_template: Path,
    v1_manifest: Path,
    v2_template: Path,
    v2_manifest: Path,
) -> None:
    validate_contract_paths(source, v1_template, v1_manifest)
    validate_contract_paths(source, v2_template, v2_manifest)
    paths = [
        source.resolve(),
        v1_template.resolve(),
        v1_manifest.resolve(),
        v2_template.resolve(),
        v2_manifest.resolve(),
    ]
    if len(set(paths)) != len(paths):
        raise TemplateContractError("Các đường dẫn source/v1/v2/manifest phải khác nhau.")
    for index, left in enumerate(paths):
        if not left.exists():
            continue
        for right in paths[index + 1 :]:
            if right.exists() and os.path.samefile(left, right):
                raise TemplateContractError("Có đường dẫn v1/v2 đang trỏ cùng một file.")


def verify_v2_packages(
    source: Path,
    v1_template: Path,
    v1_manifest: Path,
    v2_template: Path,
) -> tuple[dict[str, object], dict[str, object]]:
    verify_v1_manifest(source, v1_template, v1_manifest)
    if sha256_file(v1_template) != V1_TEMPLATE_SHA256:
        raise TemplateContractError("Template v1 không đúng checksum đã khóa.")
    if not v2_template.is_file():
        raise TemplateContractError(f"Không tìm thấy template v2: {v2_template}")

    with zipfile.ZipFile(v1_template, "r") as v1_archive, zipfile.ZipFile(
        v2_template, "r"
    ) as v2_archive:
        v1_bad = v1_archive.testzip()
        v2_bad = v2_archive.testzip()
        if v1_bad or v2_bad:
            raise TemplateContractError(
                f"OOXML ZIP lỗi (v1={v1_bad}, v2={v2_bad})."
            )
        if v1_archive.namelist() != v2_archive.namelist():
            raise TemplateContractError("Danh sách/thứ tự OOXML part v2 đã thay đổi.")
        for member in v1_archive.namelist():
            v1_content = v1_archive.read(member)
            v2_content = v2_archive.read(member)
            expected = _patch_member(member, v1_content)
            if v2_content != expected:
                raise TemplateContractError(
                    f"OOXML part không đúng clean-view contract: {member}"
                )

    v1_snapshot = inspect_workbook(v1_template)
    v2_snapshot = inspect_workbook(v2_template)
    v1_workbook = v1_snapshot["workbook"]
    v2_workbook = v2_snapshot["workbook"]

    for key in (
        "sheet_count",
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
        if v1_workbook[key] != v2_workbook[key]:
            raise TemplateContractError(f"Workbook invariant v2 bị đổi: {key}")

    if v2_workbook["visible_sheet_count"] != len(VISIBLE_OUTPUT_SHEETS):
        raise TemplateContractError("Template v2 không có đúng 8 sheet hiển thị.")
    if v2_workbook["hidden_sheet_count"] != 25:
        raise TemplateContractError("Template v2 không có đúng 25 sheet ẩn.")
    visible = tuple(
        sheet["name"]
        for sheet in v2_workbook["sheets"]
        if sheet["state"] == "visible"
    )
    if visible != VISIBLE_OUTPUT_SHEETS:
        raise TemplateContractError(f"Visible tabs v2 không đúng: {visible}")
    if any(
        sheet["state"] != "hidden"
        for sheet in v2_workbook["sheets"]
        if sheet["name"] not in VISIBLE_OUTPUT_SHEETS
    ):
        raise TemplateContractError("Có sheet ngoài danh sách nghiệp vụ chưa được ẩn.")

    if v1_snapshot["canonical_sheet"] != v2_snapshot["canonical_sheet"]:
        raise TemplateContractError("Nội dung/invariant T6-26 đã thay đổi ở v2.")
    view = _workbook_view(v2_template)
    if view.get("activeTab") != "11" or view.get("firstSheet") != "0":
        raise TemplateContractError("Active/first visible sheet của v2 không đúng.")
    if stat.S_IMODE(v2_template.stat().st_mode) != 0o600:
        raise TemplateContractError("Template v2 phải có quyền file 600.")

    return v1_snapshot, v2_snapshot


def build_v2_manifest(
    v1_snapshot: dict[str, object], v2_snapshot: dict[str, object]
) -> dict[str, object]:
    return {
        "contract_version": 2,
        "generated_at_utc": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
        "privacy": dict(PRIVACY_CONTRACT),
        "source_template_v1": v1_snapshot["file"],
        "template_v2": v2_snapshot["file"],
        "visibility_contract": dict(VISIBILITY_CONTRACT),
        "preserved_v1_invariants": {
            "workbook": v1_snapshot["workbook"],
            "canonical_sheet": v1_snapshot["canonical_sheet"],
        },
        "template_v2_invariants": {
            "workbook": v2_snapshot["workbook"],
            "canonical_sheet": v2_snapshot["canonical_sheet"],
        },
    }


def create_v2_template(
    source: Path,
    v1_template: Path,
    v1_manifest: Path,
    v2_template: Path,
    v2_manifest: Path,
) -> dict[str, object]:
    _validate_v2_paths(
        source, v1_template, v1_manifest, v2_template, v2_manifest
    )
    verify_v1_manifest(source, v1_template, v1_manifest)

    if v2_template.exists():
        if v2_manifest.exists():
            return verify_v2_manifest_file(
                source,
                v1_template,
                v1_manifest,
                v2_template,
                v2_manifest,
            )
        v1_snapshot, v2_snapshot = verify_v2_packages(
            source, v1_template, v1_manifest, v2_template
        )
        manifest_value = build_v2_manifest(v1_snapshot, v2_snapshot)
        write_json_atomic(v2_manifest, manifest_value)
        return manifest_value

    v2_template.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{v2_template.name}.", suffix=".tmp", dir=v2_template.parent
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        with zipfile.ZipFile(v1_template, "r") as v1_archive, zipfile.ZipFile(
            temporary_path, "w", allowZip64=True
        ) as v2_archive:
            v2_archive.comment = v1_archive.comment
            for info in v1_archive.infolist():
                content = _patch_member(info.filename, v1_archive.read(info.filename))
                v2_archive.writestr(info, content)
        os.chmod(temporary_path, stat.S_IRUSR | stat.S_IWUSR)
        verify_v2_packages(source, v1_template, v1_manifest, temporary_path)
        os.replace(temporary_path, v2_template)
        v1_snapshot, v2_snapshot = verify_v2_packages(
            source, v1_template, v1_manifest, v2_template
        )
        manifest_value = build_v2_manifest(v1_snapshot, v2_snapshot)
        write_json_atomic(v2_manifest, manifest_value)
        verify_v2_manifest_file(
            source, v1_template, v1_manifest, v2_template, v2_manifest
        )
        return manifest_value
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def verify_v2_manifest_file(
    source: Path,
    v1_template: Path,
    v1_manifest: Path,
    v2_template: Path,
    v2_manifest: Path,
) -> dict[str, object]:
    _validate_v2_paths(
        source, v1_template, v1_manifest, v2_template, v2_manifest
    )
    if not v2_manifest.is_file():
        raise TemplateContractError(f"Không tìm thấy manifest v2: {v2_manifest}")
    manifest_value = json.loads(v2_manifest.read_text(encoding="utf-8"))
    v1_snapshot, v2_snapshot = verify_v2_packages(
        source, v1_template, v1_manifest, v2_template
    )
    if manifest_value.get("contract_version") != 2:
        raise TemplateContractError("Manifest v2 có contract_version không đúng.")
    if manifest_value.get("privacy") != PRIVACY_CONTRACT:
        raise TemplateContractError("Privacy contract v2 không đúng.")
    if manifest_value.get("visibility_contract") != VISIBILITY_CONTRACT:
        raise TemplateContractError("Visibility contract v2 không đúng.")
    if manifest_value.get("source_template_v1") != v1_snapshot["file"]:
        raise TemplateContractError("Thông tin template v1 trong manifest v2 sai.")
    if manifest_value.get("template_v2") != v2_snapshot["file"]:
        raise TemplateContractError("Thông tin template v2 trong manifest sai.")
    expected_preserved = {
        "workbook": v1_snapshot["workbook"],
        "canonical_sheet": v1_snapshot["canonical_sheet"],
    }
    if manifest_value.get("preserved_v1_invariants") != expected_preserved:
        raise TemplateContractError("Preserved v1 invariants trong manifest sai.")
    expected_v2 = {
        "workbook": v2_snapshot["workbook"],
        "canonical_sheet": v2_snapshot["canonical_sheet"],
    }
    if manifest_value.get("template_v2_invariants") != expected_v2:
        raise TemplateContractError("Template v2 invariants trong manifest sai.")
    return manifest_value


def secure_v2_permissions(v2_template: Path) -> None:
    secure_workbook_permissions(v2_template)
