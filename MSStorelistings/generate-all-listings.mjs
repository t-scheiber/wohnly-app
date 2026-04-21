/**
 * generate-all-listings.mjs
 *
 * Reads all 42 individual language listing CSVs from the msstorelistings folder
 * and merges them into a single allListings.csv with one column per language.
 *
 * Header row: Field,Type,Bangla,Bulgarian,...,Vietnamese,English
 * Output starts with UTF-8 BOM as required by Microsoft Store.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Language list in the exact order required by the header
// ─────────────────────────────────────────────────────────────────────────────
const LANGUAGE_ORDER = [
  'Bangla',
  'Bulgarian',
  'Chinese (Simplified)',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'Estonian',
  'Finnish',
  'Filipino',
  'French',
  'German',
  'Greek',
  'Hindi',
  'Icelandic',
  'Hungarian',
  'Indonesian',
  'Italian',
  'Japanese',
  'Korean',
  'Latvian',
  'Lithuanian',
  'Malay',
  'Marathi',
  'Norwegian',
  'Polish',
  'Portuguese',
  'Romanian',
  'Russian',
  'Serbian',
  'Slovak',
  'Slovenian',
  'Spanish',
  'Kiswahili',
  'Swedish',
  'Tamil',
  'Telugu',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Vietnamese',
  'English',
];

// Map from language name (as it appears in header column of each CSV) to filename
const LANGUAGE_FILE_MAP = {
  'English':              'englishListing.csv',
  'Bangla':               'bengaliListing.csv',   // file header says "Bengali" → map to Bangla
  'Bulgarian':            'bulgarianListing.csv',
  'Chinese (Simplified)': 'chineseSimplifiedListing.csv',
  'Croatian':             'croatianListing.csv',
  'Czech':                'czechListing.csv',
  'Danish':               'danishListing.csv',
  'Dutch':                'dutchListing.csv',
  'Estonian':             'estonianListing.csv',
  'Finnish':              'finnishListing.csv',
  'Filipino':             'filipinoListing.csv',
  'French':               'frenchListing.csv',
  'German':               'germanListing.csv',
  'Greek':                'greekListing.csv',
  'Hindi':                'hindiListing.csv',
  'Icelandic':            'icelandicListing.csv',
  'Hungarian':            'hungarianListing.csv',
  'Indonesian':           'indonesianListing.csv',
  'Italian':              'italianListing.csv',
  'Japanese':             'japaneseListing.csv',
  'Korean':               'koreanListing.csv',
  'Latvian':              'latvianListing.csv',
  'Lithuanian':           'lithuanianListing.csv',
  'Malay':                'malayListing.csv',
  'Marathi':              'marathiListing.csv',
  'Norwegian':            'norwegianListing.csv',
  'Polish':               'polishListing.csv',
  'Portuguese':           'portugueseListing.csv',
  'Romanian':             'romanianListing.csv',
  'Russian':              'russianListing.csv',
  'Serbian':              'serbianListing.csv',
  'Slovak':               'slovakListing.csv',
  'Slovenian':            'slovenianListing.csv',
  'Spanish':              'spanishListing.csv',
  'Kiswahili':            'swahiliListing.csv',   // file header says "Swahili" → map to Kiswahili
  'Swedish':              'swedishListing.csv',
  'Tamil':                'tamilListing.csv',
  'Telugu':               'teluguListing.csv',
  'Thai':                 'thaiListing.csv',
  'Turkish':              'turkishListing.csv',
  'Ukrainian':            'ukrainianListing.csv',
  'Vietnamese':           'vietnameseListing.csv',
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV parsing — handles quoted fields with embedded newlines and escaped quotes
// Returns array of rows; each row is an array of string values.
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(text) {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row = [];

    // Parse one row
    while (i < len) {
      // Skip nothing — just read next field
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = '';
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              // Escaped quote
              field += '"';
              i += 2;
            } else {
              // Closing quote
              i++;
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
      } else {
        // Unquoted field — read until comma or newline
        let field = '';
        while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i];
          i++;
        }
        row.push(field);
      }

      // After field: comma → next field, newline → end of row
      if (i < len && text[i] === ',') {
        i++; // consume comma, continue row
      } else {
        // End of row (newline or EOF)
        break;
      }
    }

    // Consume line ending
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;

    // Skip empty rows (e.g., trailing newline)
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row);
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV serialisation — always quote every field for safety
// ─────────────────────────────────────────────────────────────────────────────
function csvField(value) {
  if (value === null || value === undefined) value = '';
  // Escape existing double-quotes by doubling them
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function main() {
  console.log('Reading individual language CSV files...');

  // Load each language file and extract its data rows (skip header row)
  // We'll build a map: langName -> Map<fieldName, { type, value }>
  const langData = {}; // langName -> { field -> { type, value } }

  // Also capture the full ordered list of field names + types from the English file
  // (all files have same rows in same order)
  let fieldOrder = []; // array of { field, type }

  for (const lang of LANGUAGE_ORDER) {
    const filename = LANGUAGE_FILE_MAP[lang];
    const filepath = path.join(__dirname, filename);

    if (!fs.existsSync(filepath)) {
      console.error(`ERROR: File not found: ${filepath}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(filepath, 'utf8');
    const rows = parseCSV(raw);

    if (rows.length < 2) {
      console.error(`ERROR: File has no data rows: ${filename}`);
      process.exit(1);
    }

    // Skip header row (index 0) — it has: Field, Type, <LangName>
    const dataRows = rows.slice(1);

    const fieldMap = {};
    for (const row of dataRows) {
      const field = row[0] || '';
      const type  = row[1] || '';
      const value = row[2] !== undefined ? row[2] : '';
      if (field) {
        fieldMap[field] = { type, value };
      }
    }

    langData[lang] = fieldMap;

    // Build fieldOrder from the English file (processed last in the loop)
    if (lang === 'English') {
      for (const row of dataRows) {
        const field = row[0] || '';
        const type  = row[1] || '';
        if (field) {
          fieldOrder.push({ field, type });
        }
      }
      console.log(`  Loaded English: ${fieldOrder.length} fields`);
    } else {
      console.log(`  Loaded ${lang}: ${Object.keys(fieldMap).length} fields`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build the combined CSV
  // ─────────────────────────────────────────────────────────────────────────
  const lines = [];

  // Header row
  const headerCells = ['Field', 'Type', ...LANGUAGE_ORDER];
  lines.push(headerCells.map(csvField).join(','));

  // Data rows
  for (const { field, type } of fieldOrder) {
    const cells = [field, type];

    for (const lang of LANGUAGE_ORDER) {
      const fieldMap = langData[lang];
      const entry = fieldMap[field];
      cells.push(entry ? entry.value : '');
    }

    lines.push(cells.map(csvField).join(','));
  }

  // Join with CRLF (Windows line endings — standard for CSV)
  const csvContent = lines.join('\r\n') + '\r\n';

  // Prepend UTF-8 BOM
  const BOM = '\uFEFF';
  const output = BOM + csvContent;

  // Write output
  const outputPath = path.join(__dirname, 'allListings.csv');
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`\nDone! Written to: ${outputPath}`);
  console.log(`  Rows (including header): ${lines.length}`);
  console.log(`  Columns: ${headerCells.length} (Field + Type + ${LANGUAGE_ORDER.length} languages)`);

  // ─────────────────────────────────────────────────────────────────────────
  // Verification
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nVerification:');
  const writtenRaw = fs.readFileSync(outputPath, 'utf8');
  const writtenRows = parseCSV(writtenRaw);
  console.log(`  Parsed rows: ${writtenRows.length}`);

  const headerRow = writtenRows[0];
  console.log(`  Header columns: ${headerRow.length}`);
  console.log(`  Expected columns: 44 (Field + Type + 42 languages)`);
  console.log(`  Column count OK: ${headerRow.length === 44}`);

  // Spot check: verify Field column values
  const fieldNames = writtenRows.slice(1).map(r => r[0]);
  console.log(`\n  Field names in output (${fieldNames.length} rows):`);
  fieldNames.forEach((f, i) => console.log(`    ${String(i + 1).padStart(2, '0')}. ${f}`));

  // Spot check a translated field
  const descRow = writtenRows.find(r => r[0] === 'Description');
  if (descRow) {
    console.log(`\n  Description column count in Description row: ${descRow.length}`);
    console.log(`  German Description starts with: "${descRow[13].substring(0, 50)}..."`);
  }

  const hasCorrectBOM = writtenRaw.charCodeAt(0) === 0xFEFF;
  console.log(`\n  UTF-8 BOM present: ${hasCorrectBOM}`);

  if (headerRow.length === 44 && writtenRows.length > 1 && hasCorrectBOM) {
    console.log('\n  ALL CHECKS PASSED');
  } else {
    console.error('\n  SOME CHECKS FAILED — please review the output');
  }
}

main();
