const mongoose = require("mongoose");

// One row per (subject, section). `faculty` may belong to a different
// branch than the subject/section - that's the cross-branch teaching case
// called out in the spec. A faculty member can be the `faculty` on any
// number of these rows (multiple sections, even multiple subjects).
const subjectAssignmentSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    section: { type: String, required: true, trim: true }, // "A", "B", "C" ...
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentCount: { type: Number, default: 0 }, // denormalized for fast dashboard rendering
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

subjectAssignmentSchema.index({ subject: 1, section: 1 }, { unique: true });

module.exports = mongoose.model("SubjectAssignment", subjectAssignmentSchema);
