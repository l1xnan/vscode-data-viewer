import { DuckDBInstance } from '@duckdb/node-api';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function escapePath(p) {
  return p.replace(/\\/g, '/').replace(/'/g, "''");
}

async function main() {
  const largeCsv = path.join(root, 'sample-data', 'large.csv');
  if (!fs.existsSync(largeCsv)) {
    const lines = ['id,value'];
    for (let i = 1; i <= 1200; i += 1) {
      lines.push(`${i},value-${i}`);
    }
    fs.writeFileSync(largeCsv, lines.join('\n'));
  }

  const xlsxPath = path.join(root, 'sample-data', 'workbook.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['id', 'name'],
      [1, 'SheetOne'],
      [2, 'RowTwo'],
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['id', 'amount'],
      [10, 100],
      [20, 200],
    ]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Sales');
    XLSX.utils.book_append_sheet(wb, ws2, 'Costs');
    XLSX.writeFile(wb, xlsxPath);
  }

  const workbook = XLSX.readFile(xlsxPath, { bookSheets: true });
  console.log('xlsx sheets:', workbook.SheetNames.join(', '));

  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  await conn.run('INSTALL excel;');
  await conn.run('LOAD excel;');

  const csvPath = escapePath(largeCsv);
  const baseSql = `SELECT * FROM read_csv_auto('${csvPath}')`;

  const keywordReader = await conn.runAndReadAll('SELECT COUNT(*) AS cnt FROM duckdb_keywords()');
  console.log('keywords:', keywordReader.getRowObjectsJson()[0]?.cnt);

  const fnReader = await conn.runAndReadAll(
    "SELECT COUNT(*) AS cnt FROM duckdb_functions() WHERE internal = true",
  );
  console.log('functions:', fnReader.getRowObjectsJson()[0]?.cnt);

  const page1 = await conn.runAndReadAll(
    `SELECT * FROM (${baseSql}) AS _q LIMIT 500 OFFSET 0`,
  );
  console.log('page1 rows:', page1.getRowObjectsJson().length);

  const page3 = await conn.runAndReadAll(
    `SELECT * FROM (${baseSql}) AS _q LIMIT 500 OFFSET 1000`,
  );
  console.log('page3 rows:', page3.getRowObjectsJson().length);

  const countReader = await conn.runAndReadAll(`SELECT COUNT(*) AS cnt FROM (${baseSql}) AS _q`);
  console.log('total:', countReader.getRowObjectsJson()[0]?.cnt);

  const xlsxEscaped = escapePath(xlsxPath);
  const sheetReader = await conn.runAndReadAll(
    `SELECT * FROM read_xlsx('${xlsxEscaped}', sheet = 'Sales') LIMIT 500 OFFSET 0`,
  );
  console.log('xlsx Sales rows:', sheetReader.getRowObjectsJson().length);

  console.log('integration ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
