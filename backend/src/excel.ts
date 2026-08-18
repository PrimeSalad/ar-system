import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { activityDescription, type ReportInput } from "./report-schema.js";

const sealPath = fileURLToPath(new URL("../assets/boac-seal.jpg", import.meta.url));

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const documentFont: Partial<ExcelJS.Font> = {
  name: "Times New Roman",
  size: 10,
  color: { argb: "FF000000" },
};

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}

function formatPeriod(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(start);
  if (sameMonth) {
    return `${month} ${start.getUTCDate()}-${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${formatLongDate(startDate)} - ${formatLongDate(endDate)}`;
}

function worksheetName(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (!sameMonth) return "ACCOMPLISHMENT";
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(start).toUpperCase();
  return `${month} ${start.getUTCDate()}-${end.getUTCDate()}, ${end.getUTCFullYear()}`.slice(0, 31);
}

function setCenteredHeader(
  sheet: ExcelJS.Worksheet,
  row: number,
  value: string,
  options: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number } = {},
): void {
  sheet.mergeCells(row, 1, row, 4);
  const cell = sheet.getCell(row, 1);
  cell.value = value;
  cell.font = {
    ...documentFont,
    bold: options.bold,
    italic: options.italic,
    underline: options.underline,
    size: options.size ?? 10,
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function estimateActivityHeight(description: string): number {
  const lines = Math.max(1, Math.ceil(description.length / 90));
  return Math.min(72, Math.round((12 + lines * 7.2) * 10) / 10);
}

function styleTableCell(cell: ExcelJS.Cell, size = 9): void {
  cell.font = { ...documentFont, size };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = thinBorder;
}

function descriptionValue(activity: ReportInput["activities"][number]): ExcelJS.CellRichTextValue | string {
  const category = activity.category.trim();
  const details = activity.details.trim();
  if (category.toLowerCase() === "custom") return details;
  return {
    richText: [
      { font: { ...documentFont, size: 9, bold: true }, text: `${category}: ` },
      { font: { ...documentFont, size: 9 }, text: details },
    ],
  };
}

export async function buildAccomplishmentWorkbook(report: ReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AccomplishPro";
  workbook.lastModifiedBy = report.preparedBy;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = report.office;

  const sheet = workbook.addWorksheet(worksheetName(report.startDate, report.endDate), {
    views: [{
      showGridLines: true,
      style: "pageBreakPreview",
      zoomScale: 80,
      zoomScaleNormal: 100,
    }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 14 as ExcelJS.PaperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      scale: 79,
      horizontalDpi: 360,
      verticalDpi: 360,
      pageOrder: "downThenOver",
      firstPageNumber: 1,
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0, header: 0.3, footer: 0 },
    },
  });

  sheet.columns = [
    { key: "date", width: 17.33 },
    { key: "descriptionLeft", width: 8.11 },
    { key: "descriptionRight", width: 78.89 },
    { key: "units", width: 10.89 },
  ];

  setCenteredHeader(sheet, 1, report.country);
  setCenteredHeader(sheet, 2, report.province);
  setCenteredHeader(sheet, 3, report.municipality);
  sheet.getRow(4).height = 8.4;
  setCenteredHeader(sheet, 5, report.office.toUpperCase(), { bold: true, italic: true });
  sheet.getRow(6).height = 8.4;
  setCenteredHeader(sheet, 7, report.title.toUpperCase(), { bold: true });
  setCenteredHeader(sheet, 8, `As of ${formatPeriod(report.startDate, report.endDate)}`, { underline: true });

  sheet.mergeCells("B10:C10");
  const tableHeaders: Array<[string, string]> = [
    ["A10", "DATE"],
    ["B10", "DESCRIPTION"],
    ["D10", "UNITS"],
  ];
  for (const [address, value] of tableHeaders) {
    const cell = sheet.getCell(address);
    cell.value = value;
    cell.font = { ...documentFont, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  }
  sheet.getCell("C10").border = thinBorder;

  const activities = [...report.activities].sort((a, b) => a.date.localeCompare(b.date));
  let rowNumber = 11;
  const dateGroups = new Map<string, { start: number; end: number }>();

  for (const activity of activities) {
    const description = activityDescription(activity);
    sheet.mergeCells(rowNumber, 2, rowNumber, 3);
    const dateCell = sheet.getCell(rowNumber, 1);
    const descriptionCell = sheet.getCell(rowNumber, 2);
    const unitsCell = sheet.getCell(rowNumber, 4);

    dateCell.value = formatLongDate(activity.date);
    descriptionCell.value = descriptionValue(activity);
    unitsCell.value = activity.units;

    styleTableCell(dateCell, 9);
    dateCell.numFmt = "@";
    styleTableCell(descriptionCell);
    styleTableCell(sheet.getCell(rowNumber, 3));
    styleTableCell(unitsCell, 9);
    sheet.getRow(rowNumber).height = estimateActivityHeight(description);

    const group = dateGroups.get(activity.date);
    if (group) group.end = rowNumber;
    else dateGroups.set(activity.date, { start: rowNumber, end: rowNumber });
    rowNumber += 1;
  }

  if (activities.length === 0) {
    sheet.mergeCells(rowNumber, 2, rowNumber, 3);
    sheet.getCell(rowNumber, 2).value = "No accomplishments added yet";
    for (let col = 1; col <= 4; col += 1) styleTableCell(sheet.getCell(rowNumber, col));
    sheet.getRow(rowNumber).height = 33.6;
    rowNumber += 1;
  }

  sheet.autoFilter = `A10:D${rowNumber - 1}`;

  for (const group of dateGroups.values()) {
    if (group.end > group.start) {
      sheet.mergeCells(group.start, 1, group.end, 1);
      const cell = sheet.getCell(group.start, 1);
      styleTableCell(cell);
    }
  }

  sheet.getRow(rowNumber).height = 16.2;
  const signatureStart = rowNumber + 1;
  const preparedNameRow = signatureStart + 3;
  const preparedPositionRow = signatureStart + 4;
  const notedLabelRow = signatureStart + 5;
  const notedNameRow = signatureStart + 7;
  const notedPositionRow = signatureStart + 8;

  sheet.getCell(signatureStart, 1).value = "Prepared by:";
  sheet.getCell(signatureStart, 1).font = documentFont;
  sheet.mergeCells(signatureStart, 2, signatureStart, 3);

  sheet.mergeCells(preparedNameRow, 1, preparedNameRow, 3);
  sheet.getCell(preparedNameRow, 1).value = report.preparedBy.toUpperCase();
  sheet.getCell(preparedNameRow, 1).font = { ...documentFont, bold: true, underline: true };
  sheet.getCell(preparedNameRow, 1).alignment = { horizontal: "left", indent: 5 };

  sheet.getCell(preparedPositionRow, 1).value = report.preparedPosition.toUpperCase();
  sheet.getCell(preparedPositionRow, 1).font = documentFont;
  sheet.getCell(preparedPositionRow, 1).alignment = { horizontal: "left", indent: 5 };

  sheet.getCell(notedLabelRow, 3).value = "Noted by:";
  sheet.getCell(notedLabelRow, 3).font = documentFont;
  sheet.getCell(notedLabelRow, 3).alignment = { horizontal: "center" };

  sheet.getCell(notedNameRow, 3).value = report.notedBy.toUpperCase();
  sheet.getCell(notedNameRow, 3).font = { ...documentFont, bold: true };
  sheet.getCell(notedNameRow, 3).alignment = { horizontal: "center" };

  sheet.getCell(notedPositionRow, 3).value = report.notedPosition.toUpperCase();
  sheet.getCell(notedPositionRow, 3).font = documentFont;
  sheet.getCell(notedPositionRow, 3).alignment = { horizontal: "center" };

  const seal = await readFile(sealPath);
  const imageId = workbook.addImage({
    base64: `data:image/jpeg;base64,${seal.toString("base64")}`,
    extension: "jpeg",
  });
  sheet.addImage(imageId, {
    tl: { col: 2.5927374322921355, row: 0 } as ExcelJS.Anchor,
    br: { col: 2.9999987323591935, row: 3 } as ExcelJS.Anchor,
    editAs: "oneCell",
  });

  sheet.pageSetup.printArea = `A1:D${notedPositionRow}`;

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function exportFilename(report: ReportInput): string {
  return `Accomplishment_Report_${report.startDate}_to_${report.endDate}.xlsx`;
}
