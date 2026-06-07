const m = require('../data/migration.json');
const row = m.tabs['CALCULADORA'].values[3];  // Row 4 (0-indexed)

console.log('Row 4 from migration.json:');
for (let i = 0; i < row.length && i < 15; i++) {
  const col = String.fromCharCode(65 + i);
  console.log(`  ${col}(index ${i}): ${row[i]}`);
}

console.log('\nExpected values:');
console.log('  D (index 3): should be 22');
console.log('  F (index 5): should be 3800');
console.log('  G (index 6): should be 3700');
console.log('  H (index 7): should be 1110');
