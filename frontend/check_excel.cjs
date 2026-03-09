const XLSX = require('xlsx');

try {
  const wb = XLSX.readFile('public/Book1.xlsx');
  console.log('Sheets:', wb.SheetNames);
  
  const ws = wb.Sheets[wb.SheetNames[0]];
  console.log('Range:', ws['!ref']);
  
  const data = XLSX.utils.sheet_to_json(ws, {header: 1, defval: null});
  console.log('--- Sample rows (0-20) ---');
  data.slice(0, 20).forEach((row, i) => {
    // only log rows that have at least one non-null value to keep output clean
    if (row.some(c => c !== null)) {
      console.log(`Row ${i+1}:`, JSON.stringify(row));
    }
  });
  console.log('--- End of Sample ---');
} catch (e) {
  console.error('Error reading excel:', e);
}
