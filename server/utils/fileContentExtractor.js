const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const AdmZip = require("adm-zip");
const { ocrPdf, ocrImage, readOcrCache } = require("./ocrExtractor");

/**
 * Extracts clean textual content and structured data from any uploaded file:
 * - Excel (.xlsx, .xls, .csv)
 * - Word (.docx, .doc)
 * - PowerPoint (.pptx, .ppt)
 * - PDF (.pdf) - Native digital text layer or automatic OCR fallback for scanned/CamScanner docs
 * - Images (.png, .jpg, .jpeg, .webp, .bmp, .tiff) - OCR text extraction
 * - Text (.txt, .md, .json, .log, .csv, code files)
 */
async function extractFileContent(filePath, maxLines = 2000) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found on disk" };
    }

    const ext = path.extname(filePath).toLowerCase();

    // 1. EXCEL FILES (.xlsx, .xls)
    if (ext === ".xlsx" || ext === ".xls") {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);

      const sheetsData = [];
      const textLines = [];

      wb.eachSheet((ws) => {
        const sheetInfo = {
          name: ws.name,
          rowCount: ws.rowCount,
          columnCount: ws.columnCount,
          rows: [],
        };

        textLines.push(`\n=== SHEET: ${ws.name} ===`);

        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const cells = [];
          row.eachCell({ includeEmpty: false }, (cell) => {
            let val = cell.value;
            if (val && typeof val === "object") {
              if (val.richText) val = val.richText.map((t) => t.text).join("");
              else if (val.text) val = val.text;
              else if (val.result !== undefined) val = val.result;
              else if (val.hyperlink) val = val.text || val.hyperlink;
              else val = String(val);
            }
            if (val !== null && val !== undefined && String(val).trim()) {
              cells.push(String(val).trim());
            }
          });

          // Filter duplicates from merged cells
          const cleanCells = cells.filter((c, idx) => cells.indexOf(c) === idx);
          if (cleanCells.length > 0) {
            sheetInfo.rows.push(cleanCells);
            if (textLines.length < maxLines) {
              textLines.push(`Row ${rowNumber}: ${cleanCells.join(" | ")}`);
            }
          }
        });

        sheetsData.push(sheetInfo);
      });

      return {
        success: true,
        type: "excel",
        sheets: sheetsData,
        extractedText: textLines.join("\n"),
        summary: `Excel Workbook with ${sheetsData.length} sheets: ${sheetsData.map((s) => `"${s.name}" (${s.rows.length} rows)`).join(", ")}`,
      };
    }

    // 2. WORD DOCUMENTS (.docx, .doc)
    if (ext === ".docx" || ext === ".doc") {
      let html = "";
      let rawText = "";

      try {
        const htmlRes = await mammoth.convertToHtml({ path: filePath });
        html = htmlRes.value || "";
      } catch (hErr) {
        console.warn("Mammoth HTML conversion note:", hErr.message);
      }

      try {
        const textRes = await mammoth.extractRawText({ path: filePath });
        rawText = (textRes.value || "").trim();
      } catch (tErr) {
        console.warn("Mammoth raw text conversion note:", tErr.message);
      }

      if (!rawText && html) {
        rawText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }

      const words = rawText.split(/\s+/).filter(Boolean);

      return {
        success: true,
        type: "docx",
        html: html || `<p>${rawText}</p>`,
        extractedText: rawText,
        wordCount: words.length,
        summary: `Word Document (.${ext.replace(".", "")}, ~${words.length} words)`,
      };
    }

    // 3. POWERPOINT PRESENTATIONS (.pptx, .ppt)
    if (ext === ".pptx" || ext === ".ppt") {
      try {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        const slideEntries = zipEntries
          .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
          .sort((a, b) => {
            const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/i)[1], 10);
            const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/i)[1], 10);
            return numA - numB;
          });

        const slides = [];
        const textLines = [];

        slideEntries.forEach((entry, idx) => {
          const xml = zip.readAsText(entry);
          const pMatches = xml.match(/<a:p[\s\S]*?<\/a:p>/gi) || [];
          const paragraphs = [];

          for (const p of pMatches) {
            const tMatches = [...p.matchAll(/<a:t[\s\S]*?>([\s\S]*?)<\/a:t>/gi)].map((m) => m[1]);
            const line = tMatches.join("").trim();
            if (line) paragraphs.push(line);
          }

          if (paragraphs.length === 0) {
            const allText = [...xml.matchAll(/<a:t[\s\S]*?>([\s\S]*?)<\/a:t>/gi)]
              .map((m) => m[1].trim())
              .filter(Boolean);
            if (allText.length > 0) paragraphs.push(...allText);
          }

          const title = paragraphs[0] || `Slide ${idx + 1}`;
          const bullets = paragraphs.slice(1);

          slides.push({
            slideNumber: idx + 1,
            title,
            bullets,
            paragraphs,
            text: paragraphs.join("\n"),
          });

          textLines.push(`=== Slide ${idx + 1}: ${title} ===`);
          if (bullets.length > 0) {
            textLines.push(bullets.map((b) => `• ${b}`).join("\n"));
          }
          textLines.push("");
        });

        return {
          success: true,
          type: "pptx",
          slidesCount: slides.length,
          slides,
          extractedText: textLines.join("\n").trim(),
          summary: `PowerPoint Presentation (${slides.length} slides)`,
        };
      } catch (pptErr) {
        console.warn("PPTX adm-zip parse note:", pptErr.message);
      }
    }

    // 4. PDF FILES (.pdf) - Native digital text layer OR OCR fallback for scanned docs
    if (ext === ".pdf") {
      let isScanned = false;
      let cleanText = "";
      let numPages = 1;

      // Check if OCR cache already exists first
      const ocrCache = readOcrCache(filePath);
      if (ocrCache && ocrCache.text) {
        return {
          success: true,
          type: "pdf",
          isScanned: true,
          pages: ocrCache.pages || 1,
          extractedText: ocrCache.text,
          summary: `Scanned PDF / CamScanner Document (${ocrCache.pages} pages processed via OCR)`,
        };
      }

      try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        cleanText = (data.text || "").replace(/\s+/g, " ").trim();
        numPages = data.numpages || 1;
      } catch (parseErr) {
        console.warn("pdfParse note:", parseErr.message);
      }

      // Check if text is meaningful or if it's a scanned/photo PDF
      // A scanned PDF typically has very low text length (< 150 chars) or repetitive noise
      const words = cleanText.split(/\s+/).filter(Boolean);
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));

      if (cleanText.length < 150 || (cleanText.length < 350 && uniqueWords.size < 12)) {
        isScanned = true;
      }

      if (isScanned) {
        // Automatically run multi-page OCR fallback
        const ocrRes = await ocrPdf(filePath, 8);
        if (ocrRes && ocrRes.success && ocrRes.text && ocrRes.text.trim().length > 30) {
          return {
            success: true,
            type: "pdf",
            isScanned: true,
            pages: ocrRes.pages || numPages,
            extractedText: ocrRes.text,
            summary: `Scanned PDF / CamScanner Document (${ocrRes.pages || numPages} pages recognized via OCR)`,
          };
        }
      }

      return {
        success: true,
        type: "pdf",
        isScanned: false,
        pages: numPages,
        extractedText: cleanText,
        summary: `PDF Document (${numPages} pages, ${cleanText.length} characters)`,
      };
    }

    // 5. IMAGE FILES (.png, .jpg, .jpeg, .webp, .bmp, .tiff)
    if ([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"].includes(ext)) {
      const ocrRes = await ocrImage(filePath);
      const text = (ocrRes.text || "").trim();
      return {
        success: true,
        type: "image",
        extractedText: text,
        summary: `Image file (${text.length ? `${text.length} characters extracted via OCR` : "visual asset"})`,
      };
    }

    // 6. TEXT & CODE FILES (.txt, .csv, .json, .md, .log, etc.)
    if ([".txt", ".csv", ".json", ".md", ".log", ".js", ".py", ".c", ".cpp", ".java", ".html", ".css"].includes(ext)) {
      const rawText = fs.readFileSync(filePath, "utf-8");
      return {
        success: true,
        type: "text",
        extractedText: rawText,
        summary: `Text file (${rawText.split("\n").length} lines)`,
      };
    }

    return {
      success: true,
      type: "binary",
      summary: `File type: ${ext}`,
      extractedText: `File format: ${ext}`,
    };
  } catch (err) {
    console.error("Error extracting file content from", filePath, err);
    return { success: false, error: err.message };
  }
}

module.exports = { extractFileContent };
