const m = require('../data/migration.json');
const calc = m.tabs['CALCULADORA'];

console.log('=== CALCULADORA from migration.json ===\n');
console.log('Rows 1-4 (headers and rates):');
for (let i = 0; i < 4; i++) {
  const row = calc.values[i] || [];
  const rowStr = row.slice(0, 12).map((c, j) => `${String.fromCharCode(65 + j)}:${c}`).join(' ');
  console.log(`Row ${i + 1}: ${rowStr}`);
}

console.log('\nRows 5-7 (game headers and column headers):');
for (let i = 4; i < 7; i++) {
  const row = calc.values[i] || [];
  const rowStr = row.slice(0, 12).map((c, j) => `${String.fromCharCode(65 + j)}:${c}`).join(' ');
  console.log(`Row ${i + 1}: ${rowStr}`);
}

console.log('\nRows 8-13 (first servers):');
for (let i = 7; i < 13; i++) {
  const row = calc.values[i] || [];
  const rowStr = row.slice(0, 12).map((c, j) => `${String.fromCharCode(65 + j)}:${c}`).join(' ');
  console.log(`Row ${i + 1}: ${rowStr}`);
}
