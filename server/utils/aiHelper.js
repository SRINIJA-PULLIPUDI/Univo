const fs = require("fs");
const path = require("path");
const AiDocument = require("../models/AiDocument");
const { extractFileContent } = require("./fileContentExtractor");

const CHUNK_SIZE = 1200; // characters per chunk - keeps context requests small & cheap

// Splits text into ~CHUNK_SIZE character chunks on paragraph boundaries where possible.
function chunkText(text) {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE;
  }
  return chunks;
}

/**
 * Indexes any uploaded resource (PDF, DOCX, PPTX, TXT, Images, Scanned notes) for the AI assistant.
 */
async function indexResourceForAI(resource) {
  try {
    const relativePath = (resource.fileUrl || "").replace(/^\/?uploads\//, "uploads/");
    const absolutePath = path.join(__dirname, "..", relativePath);
    if (!fs.existsSync(absolutePath)) return;

    const extracted = await extractFileContent(absolutePath);
    if (!extracted || !extracted.extractedText) return;

    const chunks = chunkText(extracted.extractedText);
    await AiDocument.deleteMany({ resource: resource._id });

    if (chunks.length > 0) {
      await AiDocument.insertMany(
        chunks.map((text, i) => ({
          resource: resource._id,
          subject: resource.subject,
          chunkIndex: i,
          text,
        }))
      );
    }

    resource.aiIndexed = true;
    await resource.save();
  } catch (err) {
    console.warn("Index resource for AI error:", err.message);
  }
}

/**
 * Fast keyword-overlap retrieval for subject-specific document chunks.
 */
async function retrieveContext(subjectIds, question, topN = 6) {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return [];

  const docs = await AiDocument.find({ subject: { $in: subjectIds } }).lean();
  const scored = docs.map((d) => {
    const lower = (d.text || "").toLowerCase();
    const score = words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
    return { ...d, score };
  });
  return scored
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

module.exports = { indexResourceForAI, retrieveContext, chunkText };
