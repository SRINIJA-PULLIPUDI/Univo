const path = require("path");
const fs = require("fs/promises");
const mime = require("mime-types");
const Circular = require("../models/Circular");
const Resource = require("../models/Resource");
const Bookmark = require("../models/Bookmark");
const Subject = require("../models/Subject");
const TaskSubmission = require("../models/TaskSubmission");
const canAccessSubject = require("../utils/subjectAccess");

const UPLOAD_TYPES = new Set(["circulars", "resources", "proofs"]);

async function canAccessCircular(user, circular) {
  if (!["student", "faculty", "hod", "operator"].includes(user.role)) return false;
  if (circular.branches.length && !circular.branches.some((branchId) => String(branchId) === String(user.branch))) return false;
  if (user.role !== "student") return true;
  return !user.isAlumni
    && (!circular.years.length || circular.years.includes(user.year))
    && (!circular.sections.length || circular.sections.includes(user.section));
}

async function canAccessUpload(req, category, filename) {
  const fileUrl = `/uploads/${category}/${filename}`;
  // If the user has bookmarked this file, they retain permanent access!
  const isBookmarked = await Bookmark.exists({ user: req.user._id, fileUrl });
  if (isBookmarked) return true;

  if (category === "circulars") {
    const circular = await Circular.findOne({ fileUrl }).select("branches years sections");
    return circular && canAccessCircular(req.user, circular);
  }
  if (category === "resources") {
    const resource = await Resource.findOne({ fileUrl }).select("subject");
    if (!resource) return false;
    const subject = await Subject.findById(resource.subject);
    return canAccessSubject(req.user, subject);
  }
  const submission = await TaskSubmission.findOne({ proofUrl: fileUrl }).populate("task", "assignedBy");
  if (!submission?.task) return false;
  return String(submission.student) === String(req.user._id)
    || String(submission.task.assignedBy) === String(req.user._id);
}

exports.serveUpload = async (req, res) => {
  const { category, filename } = req.params;
  if (!UPLOAD_TYPES.has(category) || !filename || filename === "." || filename === ".." || path.basename(filename) !== filename) {
    return res.status(400).json({ message: "Invalid file path" });
  }

  try {
    if (!await canAccessUpload(req, category, filename)) {
      return res.status(404).json({ message: "File not found" });
    }
    const filePath = path.join(__dirname, "..", "uploads", category, filename);
    await fs.access(filePath);

    const requestedName = String(req.query.name || filename).replace(/[\\/\r\n"]/g, "_");
    const asciiName = requestedName.replace(/[^\x20-\x7E]/g, "_");
    const encodedName = encodeURIComponent(requestedName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    const contentType = mime.lookup(requestedName) || "application/octet-stream";
    const canDisplayInline = contentType === "application/pdf"
      || ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp", "image/tiff"].includes(contentType);
    const disposition = req.query.disposition === "attachment" || !canDisplayInline ? "attachment" : "inline";
    res.sendFile(filePath, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
      },
    }, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 500).json({ message: "Could not open file" });
      }
    });
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ message: "File not found" });
    res.status(500).json({ message: "Could not serve file", error: error.message });
  }
};

const { extractFileContent } = require("../utils/fileContentExtractor");

exports.getPreviewData = async (req, res) => {
  const { category, filename } = req.params;
  if (!UPLOAD_TYPES.has(category) || !filename || filename === "." || filename === ".." || path.basename(filename) !== filename) {
    return res.status(400).json({ message: "Invalid file path" });
  }

  try {
    if (!await canAccessUpload(req, category, filename)) {
      return res.status(404).json({ message: "File not found" });
    }
    const filePath = path.join(__dirname, "..", "uploads", category, filename);
    await fs.access(filePath);

    const ext = path.extname(filename).toLowerCase();
    const result = await extractFileContent(filePath);
    res.json({
      filename,
      ext,
      ...result,
    });
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ message: "File not found" });
    res.status(500).json({ message: "Could not parse file preview", error: error.message });
  }
};
