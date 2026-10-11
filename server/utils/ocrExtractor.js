const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const Tesseract = require("tesseract.js");

const OCR_CACHE_DIR = path.join(__dirname, "..", "uploads", "ocr_cache");
if (!fs.existsSync(OCR_CACHE_DIR)) {
  try {
    fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
  } catch (e) {}
}

/**
 * Gets a persistent OCR cache file path for any uploaded file.
 */
function getCacheFilePath(filePath) {
  const base = path.basename(filePath);
  return path.join(OCR_CACHE_DIR, `${base}.ocr.json`);
}

/**
 * Checks if a cached OCR file exists and is valid.
 */
function readOcrCache(filePath) {
  try {
    const cacheFile = getCacheFilePath(filePath);
    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      if (data && data.text) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Failed to read OCR cache:", err.message);
  }
  return null;
}

/**
 * Saves OCR results to disk cache for instantaneous future loads.
 */
function writeOcrCache(filePath, data) {
  try {
    const cacheFile = getCacheFilePath(filePath);
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write OCR cache:", err.message);
  }
}

/**
 * Runs Python PyMuPDF script to render PDF pages into images.
 */
function renderPdfPagesWithPython(pdfPath, outDir, maxPages = 8) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "render_pdf_pages.py");
    execFile("python", [scriptPath, pdfPath, outDir, String(maxPages)], (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (!result.success) {
          return reject(new Error(result.error || "PyMuPDF rendering failed"));
        }
        resolve(result);
      } catch (parseErr) {
        reject(new Error(`Failed to parse PyMuPDF output: ${stdout}`));
      }
    });
  });
}

/**
 * Performs OCR on a scanned PDF or multi-page image PDF.
 */
async function ocrPdf(pdfPath, maxPages = 8) {
  try {
    // 1. Check disk cache
    const cached = readOcrCache(pdfPath);
    if (cached) {
      return { success: true, text: cached.text, pages: cached.pages, ocr: true };
    }

    // 2. Render pages to temp images
    const tempDir = path.join(OCR_CACHE_DIR, `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    let renderResult;
    try {
      renderResult = await renderPdfPagesWithPython(pdfPath, tempDir, maxPages);
    } catch (renderErr) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
      return { success: false, error: renderErr.message };
    }

    const pages = renderResult.pages || [];
    const pageTexts = [];

    // 3. Process each page with Tesseract
    for (const p of pages) {
      try {
        const ocrRes = await Tesseract.recognize(p.imagePath, "eng");
        const cleanText = (ocrRes.data?.text || "").trim();
        if (cleanText) {
          pageTexts.push(`=== Page ${p.page} ===\n${cleanText}`);
        }
      } catch (pageOcrErr) {
        console.warn(`OCR failed on page ${p.page}:`, pageOcrErr.message);
      }
    }

    // 4. Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}

    const fullText = pageTexts.join("\n\n");
    const resultData = {
      text: fullText,
      pages: pages.length,
      totalPages: renderResult.totalPages,
      timestamp: Date.now(),
    };

    // 5. Cache result
    writeOcrCache(pdfPath, resultData);

    return {
      success: true,
      text: fullText,
      pages: pages.length,
      totalPages: renderResult.totalPages,
      ocr: true,
    };
  } catch (err) {
    console.error("OCR PDF error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Performs OCR on a standalone image file (.png, .jpg, .jpeg, etc.)
 */
async function ocrImage(imagePath) {
  try {
    const cached = readOcrCache(imagePath);
    if (cached) {
      return { success: true, text: cached.text, ocr: true };
    }

    const ocrRes = await Tesseract.recognize(imagePath, "eng");
    const text = (ocrRes.data?.text || "").trim();

    const resultData = {
      text,
      pages: 1,
      timestamp: Date.now(),
    };

    writeOcrCache(imagePath, resultData);
    return { success: true, text, ocr: true };
  } catch (err) {
    console.error("OCR Image error:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  ocrPdf,
  ocrImage,
  readOcrCache,
};
