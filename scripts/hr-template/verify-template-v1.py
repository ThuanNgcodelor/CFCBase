#!/usr/bin/env python3
"""Verify the Phase-0 HR template against its immutable source and manifest."""

from __future__ import annotations

import argparse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from hr_template_contract import (
    DEFAULT_MANIFEST,
    DEFAULT_SOURCE,
    DEFAULT_TEMPLATE,
    TemplateContractError,
    display_path,
    verify_manifest,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Kiểm tra toàn vẹn template HR v1 và allowlist AM4:AM333."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    source = args.source.resolve()
    template = args.template.resolve()
    manifest = args.manifest.resolve()
    try:
        result = verify_manifest(source, template, manifest)
    except (
        TemplateContractError,
        OSError,
        ValueError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        print(f"[HR Template Verify] ERROR: {exc}")
        return 1

    baseline = result["baseline"]
    template_sheet = result["template_invariants"]["canonical_sheet"]
    print("[HR Template Verify] PASS: template v1 đúng hợp đồng Phase 0.")
    print(f"  Source:   {display_path(source)}")
    print(f"  Template: {display_path(template)}")
    print(f"  Sheets: {baseline['workbook']['sheet_count']}")
    print(f"  Formulas: {baseline['workbook']['formula_count']}")
    print(f"  T6-26 employees: {baseline['canonical_sheet']['employee_row_count']}")
    print(f"  Leave cells scaffolded: {template_sheet['leave_cell_count']}")
    print("  Các OOXML part ngoài sheet12.xml giữ nguyên nội dung.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
