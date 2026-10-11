const mongoose = require("mongoose");

// Created by an HOD (Subject Management) for their own branch's students,
// scoped to a year + semester. Materials live in the Resource model, keyed
// by subject. Faculty are attached to a subject via SubjectAssignment,
// which is what lets one faculty member from ANY branch teach it.
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: "" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    year: { type: Number, min: 1, max: 4, required: true },
    semester: { type: Number, min: 1, max: 8, required: true },
    academicSchemaVersion: { type: Number, default: 2, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

subjectSchema.index({ branch: 1, year: 1, semester: 1 });

subjectSchema.pre("validate", function (next) {
  if (this.semester) this.year = Math.ceil(this.semester / 2);
  next();
});

module.exports = mongoose.model("Subject", subjectSchema);
