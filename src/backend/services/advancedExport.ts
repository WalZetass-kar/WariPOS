import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface ExportOptions {
  title?: string
  subtitle?: string
  includeChart?: boolean
  customColumns?: { header: string; key: string; width?: number }[]
  summary?: { label: string; value: string | number }[]
}

function exportPath(filename: string) {
  const baseDir = app.isPackaged ? app.getPath('documents') : process.cwd()
  const exportDir = path.join(baseDir, 'WariPOS', 'exports')
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }
  return path.join(exportDir, filename)
}

export class AdvancedExportService {
  /**
   * Export to Excel with advanced formatting
   */
  static async exportToExcel(
    data: any[],
    filename: string,
    options: ExportOptions = {}
  ): Promise<{ success: boolean; filePath?: string; message?: string }> {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Data')

      // Add title
      if (options.title) {
        worksheet.mergeCells('A1:E1')
        const titleCell = worksheet.getCell('A1')
        titleCell.value = options.title
        titleCell.font = { size: 16, bold: true }
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
        worksheet.getRow(1).height = 30
      }

      // Add subtitle
      if (options.subtitle) {
        worksheet.mergeCells('A2:E2')
        const subtitleCell = worksheet.getCell('A2')
        subtitleCell.value = options.subtitle
        subtitleCell.font = { size: 12 }
        subtitleCell.alignment = { horizontal: 'center' }
      }

      const startRow = options.title ? (options.subtitle ? 4 : 3) : 1

      // Add headers
      const columns = options.customColumns || Object.keys(data[0] || {}).map(key => ({
        header: key.toUpperCase(),
        key,
        width: 15,
      }))

      worksheet.columns = columns
      
      // Style header row
      const headerRow = worksheet.getRow(startRow)
      headerRow.values = columns.map(col => col.header)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add data
      data.forEach((row, index) => {
        const dataRow = worksheet.getRow(startRow + 1 + index)
        columns.forEach((col, colIndex) => {
          dataRow.getCell(colIndex + 1).value = row[col.key]
        })
        
        // Alternate row colors
        if (index % 2 === 0) {
          dataRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' },
          }
        }
      })

      // Add summary
      if (options.summary?.length) {
        const summaryStartRow = startRow + data.length + 2
        options.summary.forEach((item, index) => {
          const row = worksheet.getRow(summaryStartRow + index)
          row.getCell(1).value = item.label
          row.getCell(2).value = item.value
          row.font = { bold: true }
        })
      }

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        if (!column.width) {
          let maxLength = 10
          column.eachCell?.({ includeEmpty: true }, cell => {
            const length = cell.value ? String(cell.value).length : 10
            if (length > maxLength) maxLength = length
          })
          column.width = Math.min(maxLength + 2, 50)
        }
      })

      // Save file
      const filePath = exportPath(filename)
      await workbook.xlsx.writeFile(filePath)

      return { success: true, filePath }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  /**
   * Export to PDF with advanced formatting
   */
  static exportToPDF(
    data: any[],
    filename: string,
    options: ExportOptions = {}
  ): { success: boolean; filePath?: string; message?: string } {
    try {
      const doc = new jsPDF()

      // Add title
      if (options.title) {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text(options.title, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' })
      }

      // Add subtitle
      if (options.subtitle) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.text(options.subtitle, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' })
      }

      const startY = options.title ? (options.subtitle ? 40 : 30) : 20

      // Prepare table data
      const columns = options.customColumns || Object.keys(data[0] || {}).map(key => ({
        header: key.toUpperCase(),
        dataKey: key,
      }))

      autoTable(doc, {
        startY,
        head: [columns.map(col => col.header)],
        body: data.map(row => columns.map(col => {
          const key = 'dataKey' in col ? col.dataKey : col.header.toLowerCase()
          return row[key]
        })),
        theme: 'grid',
        headStyles: {
          fillColor: [68, 114, 196],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [242, 242, 242],
        },
        margin: { top: 10 },
      })

      // Add summary
      if (options.summary?.length) {
        const finalY = (doc as any).lastAutoTable.finalY + 10
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        options.summary.forEach((item, index) => {
          doc.text(`${item.label}: ${item.value}`, 14, finalY + (index * 7))
        })
      }

      // Add footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }

      // Save file
      const filePath = exportPath(filename)
      doc.save(filePath)

      return { success: true, filePath }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }
}
