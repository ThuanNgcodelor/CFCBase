#!/usr/bin/env python3
"""Verify the clean-view HR template v2 and its v1 preservation contract."""

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
)
from hr_template_v2_contract import (
    DEFAULT_V2_MANIFEST,
    DEFAULT_V2_TEMPLATE,
    verify_v2_manifest_file,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Kiểm tra template HR v2 clean-view và bảo toàn template v1."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--v1-template", type=Path, default=DEFAULT_TEMPLATE)
    parser.add_argument("--v1-manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--template", type=Path, default=DEFAULT_V2_TEMPLATE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_V2_MANIFEST)
    args = parser.parse_args()

    paths = [
        args.source.resolve(),
        args.v1_template.resolve(),
        args.v1_manifest.resolve(),
        args.template.resolve(),
        args.manifest.resolve(),
    ]
    try:
        result = verify_v2_manifest_file(*paths)
    except (
        TemplateContractError,
        OSError,
        ValueError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        print(f"[HR Template v2 Verify] ERROR: {exc}")
        return 1

    workbook = result["template_v2_invariants"]["workbook"]
    canonical = result["template_v2_invariants"]["canonical_sheet"]
    print("[HR Template v2 Verify] PASS: clean-view contract hợp lệ.")
    print(f"  Template: {display_path(paths[3])}")
    print(f"  Visible/hidden: {workbook['visible_sheet_count']}/{workbook['hidden_sheet_count']}")
    print(f"  Formulas: {workbook['formula_count']}")
    print(f"  T6-26 employees: {canonical['employee_row_count']}")
    print(f"  Leave cells: {canonical['leave_cell_count']}")
    print("  Chỉ workbook.xml khác template v1.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
