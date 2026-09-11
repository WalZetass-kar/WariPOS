export const GOOGLE_SHEETS_APPS_SCRIPT = `function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
    let writtenRows = 0;

    if (!spreadsheet) {
      throw new Error('Script harus dibuat dari dalam file Google Sheets target.');
    }

    if (payload.action === 'test') {
      return jsonResponse({
        success: true,
        message: 'Koneksi Google Sheets berhasil',
        writtenRows: 0,
      });
    }

    if (payload.action !== 'append_dashboard' && payload.action !== 'append_report' && payload.action !== 'export_data') {
      throw new Error('Action tidak dikenal: ' + payload.action);
    }

    sheets.forEach(function (entry) {
      const name = String(entry.name || 'Sheet1').slice(0, 99);
      const rows = Array.isArray(entry.rows) ? entry.rows : [];
      let sheet = spreadsheet.getSheetByName(name);
      if (!sheet) sheet = spreadsheet.insertSheet(name);

      sheet.clearContents();
      if (rows.length > 0) {
        const width = rows.reduce(function (max, row) {
          return Math.max(max, Array.isArray(row) ? row.length : 1);
        }, 1);
        const values = rows.map(function (row) {
          const source = Array.isArray(row) ? row : [row];
          while (source.length < width) source.push('');
          return source;
        });
        sheet.getRange(1, 1, values.length, width).setValues(values);
        sheet.autoResizeColumns(1, width);
        writtenRows += values.length;
      }
    });

    const isReport = payload.action === 'append_report';
    return jsonResponse({
      success: true,
      message: isReport ? 'Laporan berhasil ditulis ke Google Sheets' : 'Dashboard berhasil ditulis ke Google Sheets',
      writtenRows: writtenRows,
      sheets: sheets.map(function (entry) { return entry.name; }),
      generatedAt: payload.generatedAt || new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error && error.message ? error.message : String(error),
    });
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}`
