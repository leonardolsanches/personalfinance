import * as XLSX from 'xlsx';

export function formatCurrencyBR(value: number | string, includeSign: boolean = true): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';
  const formatted = Math.abs(numValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!includeSign) return formatted;
  if (numValue > 0) return `+${formatted}`;
  if (numValue < 0) return `-${formatted}`;
  return formatted;
}

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Dados') {
  const formattedData = data.map(row => {
    const newRow: any = {};
    for (const key in row) {
      if (key === 'Valor' || key === 'Amount') {
        newRow[key] = formatCurrencyBR(row[key]);
      } else {
        newRow[key] = row[key];
      }
    }
    return newRow;
  });
  
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const colWidths = formattedData.length > 0 
    ? Object.keys(formattedData[0]).map(key => ({
        wch: Math.max(
          key.length,
          ...formattedData.map(row => String(row[key] || '').length)
        ) + 2
      }))
    : [];
  worksheet['!cols'] = colWidths;
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
