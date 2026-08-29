/**
 * Dependency-free spreadsheet export. Emits SpreadsheetML 2003 (.xls) — a plain
 * XML string Excel / Sheets / LibreOffice all open as a real workbook with typed
 * columns, unlike bare CSV. Good enough for the prototype's candidate export.
 */

type Cell = string | number | null | undefined;

function esc(v: string): string {
  return v.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function cell(v: Cell): string {
  if (v === null || v === undefined || v === "") {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${esc(String(v))}</Data></Cell>`;
}

export function downloadXls(
  filename: string,
  headers: string[],
  rows: Cell[][],
) {
  const headerRow = `<Row>${headers
    .map(
      (h) =>
        `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`,
    )
    .join("")}</Row>`;
  const bodyRows = rows
    .map((r) => `<Row>${r.map(cell).join("")}</Row>`)
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#FFE4D0" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Candidates">
  <Table>${headerRow}${bodyRows}</Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
