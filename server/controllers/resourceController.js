const Resource = require("../models/Resource");
const AiDocument = require("../models/AiDocument");
const Bookmark = require("../models/Bookmark");
const Subject = require("../models/Subject");
const SubjectAssignment = require("../models/SubjectAssignment");
const User = require("../models/User");
const canAccessSubject = require("../utils/subjectAccess");
const fs = require("fs/promises");
const path = require("path");
const { indexResourceForAI } = require("../utils/aiHelper");

exports.listResources = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You cannot access this subject's resources" });
    const filter = { subject: req.params.subjectId, isDeleted: { $ne: true } };
    if (req.query.type) filter.type = req.query.type;
    const resources = await Resource.find(filter).populate("uploadedBy", "name role").sort({ createdAt: -1 }).lean();
    const withUnreadState = resources.map((resource) => ({
      ...resource,
      isUnread: String(resource.uploadedBy?._id) !== String(req.user._id)
        && !(resource.readBy || []).some((reader) => String(reader) === String(req.user._id)),
    }));
    res.json({ resources: withUnreadState });
  } catch (err) {
    res.status(500).json({ message: "Could not load resources", error: err.message });
  }
};

exports.uploadResource = async (req, res) => {
  try {
    if (!["faculty", "hod"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only faculty can upload study material" });
    }
    if (!req.file) return res.status(400).json({ message: "A file is required" });
    const subject = await Subject.findById(req.params.subjectId).select("branch year");
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You must be assigned to this subject to upload resources" });

    const resource = await Resource.create({
      subject: req.params.subjectId,
      type: req.body.type,
      title: req.body.title,
      fileUrl: `/uploads/resources/${req.file.filename}`,
      fileName: req.file.originalname,
      uploadedBy: req.user._id,
    });

    // fire-and-forget: extract text + chunk it for the AI Chat Bot.
    // Never let AI indexing failures block the upload response.
    indexResourceForAI(resource).catch((e) => console.error("[ai-index] failed:", e.message));

    const assignments = await SubjectAssignment.find({ subject: resource.subject }).select("faculty section");
    const { sendNotificationEmail } = require("../utils/mailer");
    const recipients = await User.find({
      isActive: true,
      _id: { $ne: req.user._id },
      $or: [
        { role: "student", branch: subject.branch, year: subject.year, section: { $in: assignments.map((item) => item.section) } },
        { role: { $in: ["faculty", "hod"] }, _id: { $in: assignments.map((item) => item.faculty) } },
      ],
    }).select("_id email name");

    for (const recipient of recipients) {
      req.io?.to(`user:${recipient._id}`).emit("resource:new", {
        subjectId: String(resource.subject),
        resourceId: String(resource._id),
        type: resource.type,
      });

      sendNotificationEmail({
        to: recipient.email,
        name: recipient.name,
        title: `New Study Material: ${resource.title}`,
        message: `New learning resource (${resource.type || "Material"}) has been uploaded for your subject. Log in to Univo to access and study it.`,
        category: "Study Material",
        link: "http://localhost:5173/app/resources",
      }).catch(() => {});
    }

    res.status(201).json({ resource });
  } catch (err) {
    res.status(500).json({ message: "Could not upload resource", error: err.message });
  }
};

exports.markResourceRead = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    const subject = await Subject.findById(resource.subject);
    if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You cannot access this resource" });
    await Resource.updateOne({ _id: resource._id }, { $addToSet: { readBy: req.user._id } });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ message: "Resource marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Could not mark resource as read", error: err.message });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id).populate("subject", "name").populate("uploadedBy", "name");
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    if (String(resource.uploadedBy?._id || resource.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only remove material you uploaded" });
    }

    // Check if students have bookmarked this resource
    const hasBookmarks = await Bookmark.exists({ resource: resource._id });
    if (!hasBookmarks) {
      // If no student bookmarked it, remove file from disk and delete completely
      const filePath = path.join(__dirname, "..", "uploads", "resources", path.basename(resource.fileUrl));
      await fs.unlink(filePath).catch((err) => {
        if (err.code !== "ENOENT") throw err;
      });
      await AiDocument.deleteMany({ resource: resource._id });
      await resource.deleteOne();
    } else {
      // If bookmarked: preserve the student's bookmark with snapshot and soft-delete from resources
      await Bookmark.updateMany(
        { resource: resource._id },
        {
          $set: {
            title: resource.title,
            fileName: resource.fileName,
            fileUrl: resource.fileUrl,
            fileType: resource.type,
            subjectName: resource.subject?.name || "",
            uploadedByName: resource.uploadedBy?.name || "",
          },
        }
      );
      resource.isDeleted = true;
      await resource.save();
      await AiDocument.deleteMany({ resource: resource._id });
    }

    res.json({ message: "Resource removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not remove resource", error: err.message });
  }
};

exports.myResourceStats = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const [totalUploaded, thisYear] = await Promise.all([
      Resource.countDocuments({ uploadedBy: req.user._id, isDeleted: { $ne: true } }),
      Resource.countDocuments({
        uploadedBy: req.user._id,
        isDeleted: { $ne: true },
        createdAt: { $gte: startOfYear },
      }),
    ]);
    res.json({ total: totalUploaded, thisYear });
  } catch (err) {
    res.status(500).json({ message: "Could not load resource stats", error: err.message });
  }
};
