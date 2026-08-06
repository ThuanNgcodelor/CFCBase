#!/usr/bin/env python3
from __future__ import annotations

import html
import re
from datetime import datetime, timedelta
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.etree import ElementTree as ET


SOURCE = Path("/home/david-nguyen/Downloads/hr-T8-26.xlsx")
OUTPUT = Path(__file__).resolve().parents[1] / "output" / "QuanLyNgayPhep_Template.xlsx"

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
REL_NS = {"pr": "http://schemas.openxmlformats.org/package/2006/relationships"}


EMPLOYEE_HEADERS = [
    "employee_code",
    "full_name",
    "department",
    "position",
    "hire_date",
    "working_condition",
    "service_years",
    "annual_leave_days",
    "used_days",
    "pending_days",
    "remaining_days",
    "period",
    "source_sheet",
    "updated_at",
]

REQUEST_HEADERS = [
    "request_id",
    "employee_code",
    "full_name",
    "department",
    "leave_from",
    "leave_to",
    "day_count",
    "reason",
    "requested_by",
    "status",
    "manager_note",
    "approved_by",
    "approved_at",
    "created_at",
    "updated_at",
]

ADJUSTMENT_HEADERS = [
    "adjustment_id",
    "employee_code",
    "full_name",
    "department",
    "period",
    "before_days",
    "after_days",
    "delta_days",
    "reason",
    "adjusted_by",
    "created_at",
]

DEPARTMENT_HEAD_HEADERS = [
    "department",
    "head_name",
    "email",
    "active",
    "note",
    "updated_at",
]


def col_to_idx(ref: str) -> int:
    match = re.match(r"([A-Z]+)", ref or "")
    if not match:
        return 0
    result = 0
    for char in match.group(1):
        result = result * 26 + ord(char) - 64
    return result


def idx_to_col(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def normalize(value: object) -> str:
    text = str(value or "").strip().lower()
    replacements = {
        "đ": "d",
        "á": "a", "à": "a", "ả": "a", "ã": "a", "ạ": "a",
        "ă": "a", "ắ": "a", "ằ": "a", "ẳ": "a", "ẵ": "a", "ặ": "a",
        "â": "a", "ấ": "a", "ầ": "a", "ẩ": "a", "ẫ": "a", "ậ": "a",
        "é": "e", "è": "e", "ẻ": "e", "ẽ": "e", "ẹ": "e",
        "ê": "e", "ế": "e", "ề": "e", "ể": "e", "ễ": "e", "ệ": "e",
        "í": "i", "ì": "i", "ỉ": "i", "ĩ": "i", "ị": "i",
        "ó": "o", "ò": "o", "ỏ": "o", "õ": "o", "ọ": "o",
        "ô": "o", "ố": "o", "ồ": "o", "ổ": "o", "ỗ": "o", "ộ": "o",
        "ơ": "o", "ớ": "o", "ờ": "o", "ở": "o", "ỡ": "o", "ợ": "o",
        "ú": "u", "ù": "u", "ủ": "u", "ũ": "u", "ụ": "u",
        "ư": "u", "ứ": "u", "ừ": "u", "ử": "u", "ữ": "u", "ự": "u",
        "ý": "y", "ỳ": "y", "ỷ": "y", "ỹ": "y", "ỵ": "y",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return re.sub(r"\s+", " ", text.replace("\n", " ")).strip()


def excel_date(value: object) -> str:
    if value in ("", None):
        return ""
    text = str(value).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", text):
        return text[:10]
    if re.match(r"^\d+(\.\d+)?$", text):
        date = datetime(1899, 12, 30) + timedelta(days=round(float(text)))
        return date.strftime("%Y-%m-%d")
    return text


def read_source_rows() -> list[list[object]]:
    with ZipFile(SOURCE) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", NS):
                shared.append("".join(text.text or "" for text in item.findall(".//a:t", NS)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("pr:Relationship", REL_NS)}
        target = None
        sheet_name = None
        for sheet in workbook.findall("a:sheets/a:sheet", NS):
            name = sheet.attrib["name"]
            if re.match(r"^T\d+-\d+$", name):
                rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
                target = relmap[rid]
                sheet_name = name
                break
        if not target:
            raise SystemExit("Cannot find monthly sheet like T8-26")
        full = "xl/" + target.lstrip("/") if not target.startswith("xl/") else target
        root = ET.fromstring(archive.read(full))
        rows = []

        def cell_text(cell: ET.Element) -> str:
            value = cell.find("a:v", NS)
            text = "" if value is None else value.text or ""
            if cell.attrib.get("t") == "s" and text:
                return shared[int(text)]
            if cell.attrib.get("t") == "inlineStr":
                return "".join(node.text or "" for node in cell.findall(".//a:t", NS))
            return text

        for xml_row in root.findall(".//a:sheetData/a:row", NS):
            values = []
            current = 1
            for cell in xml_row.findall("a:c", NS):
                index = col_to_idx(cell.attrib.get("r", "")) or current
                while current < index:
                    values.append("")
                    current += 1
                values.append(cell_text(cell))
                current += 1
            rows.append(values)

    header_index = next(
        index
        for index, row in enumerate(rows[:20])
        if "ho va ten" in [normalize(cell) for cell in row]
        and "ngay nghi phep" in [normalize(cell) for cell in row]
    )
    header = [normalize(cell) for cell in rows[header_index]]

    def find(*aliases: str) -> int:
        for alias in aliases:
            key = normalize(alias)
            if key in header:
                return header.index(key)
        raise SystemExit(f"Missing source column: {aliases[0]}")

    indexes = {
        "employee_code": find("MÃ SỐ"),
        "full_name": find("HỌ VÀ TÊN"),
        "department": find("ĐƠN VỊ CÔNG TÁC"),
        "position": find("CHỨC VỤ"),
        "hire_date": find("NGÀY LÀM"),
        "working_condition": find("MÔI TRƯỜNG LÀM VIỆC"),
        "service_years": find("NĂM CÔNG TÁC"),
        "annual_leave_days": find("NGÀY NGHỈ PHÉP"),
    }

    output_rows = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for row in rows[header_index + 1 :]:
        def get(key: str) -> object:
            index = indexes[key]
            return row[index] if index < len(row) else ""

        code = str(get("employee_code") or "").strip()
        full_name = str(get("full_name") or "").strip()
        if not code or not full_name:
            continue
        annual = get("annual_leave_days") or 0
        output_rows.append([
            code,
            full_name,
            get("department"),
            get("position"),
            excel_date(get("hire_date")),
            get("working_condition"),
            get("service_years"),
            annual,
            0,
            0,
            annual,
            sheet_name,
            sheet_name,
            now,
        ])
    return output_rows


def cell_xml(value: object, ref: str, style: int = 0) -> str:
    if value in ("", None):
        return f'<c r="{ref}" s="{style}"/>'
    if isinstance(value, (int, float)) or re.match(r"^-?\d+(\.\d+)?$", str(value)):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    escaped = html.escape(str(value), quote=True)
    return f'<c r="{ref}" t="inlineStr" s="{style}"><is><t>{escaped}</t></is></c>'


def sheet_xml(rows: list[list[object]]) -> str:
    body = []
    for row_index, row in enumerate(rows, 1):
        cells = []
        for column_index, value in enumerate(row, 1):
            style = 1 if row_index == 1 else 0
            cells.append(cell_xml(value, f"{idx_to_col(column_index)}{row_index}", style))
        body.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        '<sheetData>'
        + "".join(body)
        + '</sheetData><autoFilter ref="A1:N1"/></worksheet>'
    )


def write_workbook(employee_rows: list[list[object]]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    departments = sorted({str(row[2]).strip() for row in employee_rows if str(row[2]).strip()})
    head_rows = [["ALL", "Quản lý tổng", "", "TRUE", "Điền email quản lý tổng nếu muốn duyệt tất cả phòng ban", ""]]
    head_rows.extend([
        [department, "", "", "TRUE", "Điền email trưởng phòng để duyệt và nhận thông báo", ""]
        for department in departments
    ])
    sheets = [
        ("LEAVE_EMPLOYEES", [EMPLOYEE_HEADERS] + employee_rows),
        ("DEPARTMENT_HEADS", [DEPARTMENT_HEAD_HEADERS] + head_rows),
        ("LEAVE_REQUESTS", [REQUEST_HEADERS]),
        ("LEAVE_ADJUSTMENTS", [ADJUSTMENT_HEADERS]),
        ("APPROVAL_LOGS", [["log_id", "entity_type", "entity_id", "action", "actor", "note", "created_at"]]),
        ("IMPORT_LOGS", [["import_id", "source_sheet", "period", "imported_rows", "imported_by", "created_at", "note"]]),
        ("CONFIG", [["key", "value", "note"], ["DEFAULT_MONTH_SHEET", "T8-26", "Tên sheet danh sách tháng hiện tại"], ["PERIOD", "T8-26", "Kỳ phép đang quản lý"]]),
    ]
    content_types = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
                     '<Default Extension="xml" ContentType="application/xml"/>',
                     '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
                     '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
                     '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
                     '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>']
    for index in range(1, len(sheets) + 1):
        content_types.append(f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
    content_types.append('</Types>')

    workbook_sheets = "".join(
        f'<sheet name="{name}" sheetId="{index}" r:id="rId{index}"/>'
        for index, (name, _) in enumerate(sheets, 1)
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets>{workbook_sheets}</sheets></workbook>'
    )
    workbook_rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                     '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    for index in range(1, len(sheets) + 1):
        workbook_rels.append(f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>')
    workbook_rels.append(f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
    workbook_rels.append('</Relationships>')

    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs>'
        '</styleSheet>'
    )

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "".join(content_types))
        archive.writestr("_rels/.rels", (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
            '</Relationships>'
        ))
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", "".join(workbook_rels))
        archive.writestr("xl/styles.xml", styles_xml)
        archive.writestr("docProps/core.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>')
        archive.writestr("docProps/app.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>')
        for index, (_, rows) in enumerate(sheets, 1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml(rows))


def main() -> None:
    rows = read_source_rows()
    write_workbook(rows)
    print(f"Wrote {OUTPUT} with {len(rows)} employees")


if __name__ == "__main__":
    main()
