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

function setCenteredHeader(
  sheet: ExcelJS.Worksheet,
  row: number,
  value: string,
  options: { bold?: boolean; italic?: boolean; size?: number } = {},
): void {
  sheet.mergeCells(row, 1, row, 4);
  const cell = sheet.getCell(row, 1);
  cell.value = value;
  cell.font = { ...documentFont, bold: options.bold, italic: options.italic, size: options.size ?? 10 };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function estimateActivityHeight(description: string): number {
  const lines = Math.max(2, Math.ceil(description.length / 105));
  return Math.min(94, Math.max(33.6, lines * 15.2));
}

function styleTableCell(cell: ExcelJS.Cell, size = 9): void {
  cell.font = { ...documentFont, size };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = thinBorder;
}

export async function buildAccomplishmentWorkbook(report: ReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AccomplishPro";
  workbook.lastModifiedBy = report.preparedBy;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = report.office;

  const sheet = workbook.addWorksheet("ACCOMPLISHMENT", {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.35, header: 0.15, footer: 0.15 },
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
  setCenteredHeader(sheet, 8, `As of ${formatPeriod(report.startDate, report.endDate)}`);
  sheet.getRow(9).height = 8.4;

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
  sheet.getRow(10).height = 20;

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
    descriptionCell.value = description;
    unitsCell.value = activity.units;

    styleTableCell(dateCell);
    styleTableCell(descriptionCell);
    styleTableCell(sheet.getCell(rowNumber, 3));
    styleTableCell(unitsCell, 10);
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

  for (const group of dateGroups.values()) {
    if (group.end > group.start) {
      sheet.mergeCells(group.start, 1, group.end, 1);
      const cell = sheet.getCell(group.start, 1);
      styleTableCell(cell);
    }
  }

  const signatureStart = rowNumber + 1;
  const preparedNameRow = signatureStart + 3;
  const preparedPositionRow = signatureStart + 4;
  const notedLabelRow = signatureStart + 5;
  const notedNameRow = signatureStart + 7;
  const notedPositionRow = signatureStart + 8;

  sheet.getCell(signatureStart, 1).value = "Prepared by:";
  sheet.getCell(signatureStart, 1).font = documentFont;

  sheet.mergeCells(preparedNameRow, 1, preparedNameRow, 2);
  sheet.getCell(preparedNameRow, 1).value = report.preparedBy.toUpperCase();
  sheet.getCell(preparedNameRow, 1).font = { ...documentFont, bold: true };
  sheet.getCell(preparedNameRow, 1).alignment = { horizontal: "center" };

  sheet.mergeCells(preparedPositionRow, 1, preparedPositionRow, 2);
  sheet.getCell(preparedPositionRow, 1).value = report.preparedPosition.toUpperCase();
  sheet.getCell(preparedPositionRow, 1).font = documentFont;
  sheet.getCell(preparedPositionRow, 1).alignment = { horizontal: "center" };

  sheet.getCell(notedLabelRow, 3).value = "Noted by:";
  sheet.getCell(notedLabelRow, 3).font = documentFont;
  sheet.getCell(notedLabelRow, 3).alignment = { horizontal: "center" };

  sheet.mergeCells(notedNameRow, 3, notedNameRow, 4);
  sheet.getCell(notedNameRow, 3).value = report.notedBy.toUpperCase();
  sheet.getCell(notedNameRow, 3).font = { ...documentFont, bold: true };
  sheet.getCell(notedNameRow, 3).alignment = { horizontal: "center" };

  sheet.mergeCells(notedPositionRow, 3, notedPositionRow, 4);
  sheet.getCell(notedPositionRow, 3).value = report.notedPosition.toUpperCase();
  sheet.getCell(notedPositionRow, 3).font = documentFont;
  sheet.getCell(notedPositionRow, 3).alignment = { horizontal: "center" };

  const seal = await readFile(sealPath);
  const imageId = workbook.addImage({
    base64: `data:image/jpeg;base64,${seal.toString("base64")}`,
    extension: "jpeg",
  });
  sheet.addImage(imageId, {
    tl: { col: 2.73, row: 0.05 } as ExcelJS.Anchor,
    br: { col: 2.9, row: 4.35 } as ExcelJS.Anchor,
    editAs: "oneCell",
  });

  sheet.pageSetup.printArea = `A1:D${notedPositionRow}`;
  sheet.headerFooter.oddFooter = "&CPage &P of &N";

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function exportFilename(report: ReportInput): string {
  return `Accomplishment_Report_${report.startDate}_to_${report.endDate}.xlsx`;
}
