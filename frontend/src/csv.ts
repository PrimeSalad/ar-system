export interface CsvActivityRow {
  date: string;
  category: string;
  details: string;
  units: number;
}

const MAX_IMPORT_ROWS = 250;
const MAX_CATEGORY_LENGTH = 300;
const MAX_DETAILS_LENGTH = 2_500;
const MAX_UNITS = 1_000_000;

const HEADER_ALIASES = {
  date: ["date", "accomplishment date"],
  category: ["category", "work category", "activity category"],
  details: ["details", "description", "what was accomplished", "accomplishment"],
  units: ["units", "unit", "quantity", "output units"],
} as const;

type RequiredColumn = keyof typeof HEADER_ALIASES;

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseCsvTable(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("The CSV contains an unexpected quote. Put fields containing quotes inside double quotes.");
      }
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("The CSV contains an unclosed quoted field.");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month! - 1
    && parsed.getUTCDate() === day;
}

function resolveColumns(headers: string[]): Record<RequiredColumn, number> {
  const normalized = headers.map(normalizeHeader);
  const columns = {} as Record<RequiredColumn, number>;

  (Object.keys(HEADER_ALIASES) as RequiredColumn[]).forEach((column) => {
    const aliases: readonly string[] = HEADER_ALIASES[column];
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index === -1) {
      throw new Error(`Missing required CSV column “${column}”. Use: date, category, details, units.`);
    }
    columns[column] = index;
  });

  return columns;
}

export function parseActivityCsv(source: string): CsvActivityRow[] {
  if (!source.trim()) throw new Error("The selected CSV file is empty.");

  const table = parseCsvTable(source);
  const headerIndex = table.findIndex((row) => row.some((field) => field.trim()));
  if (headerIndex === -1) throw new Error("The selected CSV file is empty.");

  const columns = resolveColumns(table[headerIndex]!);
  const dataRows = table
    .slice(headerIndex + 1)
    .map((row, index) => ({ row, csvRowNumber: headerIndex + index + 2 }))
    .filter(({ row }) => row.some((field) => field.trim()));

  if (dataRows.length === 0) throw new Error("The CSV has column headers but no accomplishment rows.");
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import up to ${MAX_IMPORT_ROWS} accomplishments at a time.`);
  }

  return dataRows.map(({ row, csvRowNumber }) => {
    const date = (row[columns.date] ?? "").trim();
    const category = (row[columns.category] ?? "").trim();
    const details = (row[columns.details] ?? "").trim();
    const unitsText = (row[columns.units] ?? "").trim();

    if (!isRealIsoDate(date)) {
      throw new Error(`CSV row ${csvRowNumber}: date must be a real date in YYYY-MM-DD format.`);
    }
    if (category.length < 2 || category.length > MAX_CATEGORY_LENGTH) {
      throw new Error(`CSV row ${csvRowNumber}: category must contain 2–${MAX_CATEGORY_LENGTH} characters.`);
    }
    if (details.length < 3 || details.length > MAX_DETAILS_LENGTH) {
      throw new Error(`CSV row ${csvRowNumber}: details must contain 3–${MAX_DETAILS_LENGTH.toLocaleString()} characters.`);
    }
    if (!/^\d+$/.test(unitsText)) {
      throw new Error(`CSV row ${csvRowNumber}: units must be a positive whole number.`);
    }
    const units = Number(unitsText);
    if (!Number.isSafeInteger(units) || units < 1 || units > MAX_UNITS) {
      throw new Error(`CSV row ${csvRowNumber}: units must be between 1 and ${MAX_UNITS.toLocaleString()}.`);
    }

    return { date, category, details, units };
  });
}
