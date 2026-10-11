const Circular = require("../models/Circular");

exports.uploadCircular = async (req, res) => {
  try {
    if (!["hod", "faculty", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only HODs, Faculty and Operators can upload circulars" });
    }
    if (!req.file) return res.status(400).json({ message: "A file is required" });

    const { title, description, category, years, sections } = req.body;

    const circular = await Circular.create({
      title,
      description,
      category,
      fileUrl: `/uploads/circulars/${req.file.filename}`,
      fileName: req.file.originalname,
      uploadedBy: req.user._id,
      branches: [req.user.branch],
      years: JSON.parse(years || "[]"),
      // per spec, only Faculty may target specific sections; HOD/Operator are year-wise only
      sections: req.user.role === "faculty" ? JSON.parse(sections || "[]") : [],
    });

    req.io?.emit("circular:new", { title: circular.title, id: circular._id });

    // Eagerly warm up file text extraction for AI assistant
    if (req.file?.path) {
      const { extractFileContent } = require("../utils/fileContentExtractor");
      extractFileContent(req.file.path).catch((err) => console.warn("[ai-circular-index] warm-up note:", err.message));
    }

    // Target audience notification (including HOD and eligible section students)
    const { sendNotificationEmail } = require("../utils/mailer");
    const User = require("../models/User");

    const userFilters = [
      { role: "hod", branch: { $in: circular.branches } },
      { role: "faculty", branch: { $in: circular.branches } },
      { role: "operator", branch: { $in: circular.branches } },
    ];

    const studentCond = { role: "student", branch: { $in: circular.branches } };
    if (circular.years?.length) studentCond.year = { $in: circular.years };
    if (circular.sections?.length) studentCond.section = { $in: circular.sections };
    userFilters.push(studentCond);

    const recipients = await User.find({
      isActive: true,
      _id: { $ne: req.user._id },
      $or: userFilters,
    }).select("_id email name");

    for (const recipient of recipients) {
      req.io?.to(`user:${recipient._id}`).emit("unread:refresh");
      sendNotificationEmail({
        to: recipient.email,
        name: recipient.name,
        title: `New Circular: ${circular.title}`,
        message: `A new circular titled "${circular.title}" (${circular.category || "General"}) has been issued. Check the Univo portal for documents and details.`,
        category: "Official Circular",
        link: "http://localhost:5173/app/circulars",
      }).catch(() => {});
    }

    res.status(201).json({ circular });
  } catch (err) {
    res.status(500).json({ message: "Could not upload circular", error: err.message });
  }
};

// Lists circulars visible to the current user, applying the targeting rules.
exports.listCirculars = async (req, res) => {
  try {
    const { role, branch, year, section } = req.user;
    if (role === "student" && req.user.isAlumni) return res.json({ circulars: [] });
    let filter = {};

    if (role === "student") {
      filter = {
        $and: [
          { $or: [{ branches: { $size: 0 } }, { branches: branch }] },
          { $or: [{ years: { $size: 0 } }, { years: year }] },
          { $or: [{ sections: { $size: 0 } }, { sections: section }] },
        ],
      };
    } else if (["faculty", "hod", "coordinator", "operator"].includes(role)) {
      filter = { $or: [{ branches: { $size: 0 } }, { branches: branch }] };
    } // operator sees everything

    const circulars = await Circular.find(filter)
      .populate("uploadedBy", "name role")
      .populate("branches", "name code")
      .sort({ createdAt: -1 });
    res.json({ circulars });
  } catch (err) {
    res.status(500).json({ message: "Could not load circulars", error: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const circular = await Circular.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user._id } });
    if (!circular) return res.status(404).json({ message: "Circular not found" });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Could not mark circular as read", error: err.message });
  }
};

exports.deleteCircular = async (req, res) => {
  try {
    const circular = await Circular.findById(req.params.id);
    if (!circular) return res.status(404).json({ message: "Circular not found" });
    if (["student", "coordinator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Students cannot remove circulars" });
    }
    await circular.deleteOne();
    res.json({ message: "Circular removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not remove circular", error: err.message });
  }
};
