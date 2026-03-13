import pkg from 'xlsx';
import process from 'process';

const { readFile, utils } = pkg;
const filePath = process.argv[2];
const workbook = readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = utils.sheet_to_json(worksheet, { header: 1 });

const validRows = data.filter(row => row && row.length >= 8 && row[0] && row[3] && row[4]);


console.log("Headers:");
console.dir(data[0], { depth: null });

console.log("Looking closely at row 100 for possible stock values:");
console.dir(validRows[100], { depth: null });
