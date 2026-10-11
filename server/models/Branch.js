const mongoose = require("mongoose");

// A department/branch of the college, e.g. CSE, ECE, EEE, MECH, CIVIL.
// Each branch has exactly one HOD (a User with role "hod") and any number
// of faculty + students who belong to it. Sections (A, B, C ...) are
// configured per branch+year here so the UI can generate them dynamically.
const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Computer Science & Engineering"
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // "CSE"
    hod: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // sections offered per year, e.g. { 1: ['A','B'], 2: ['A','B','C'], 3: ['A','B'], 4: ['A'] }
    sectionsByYear: {
      1: { type: [String], default: ["A", "B"] },
      2: { type: [String], default: ["A", "B"] },
      3: { type: [String], default: ["A", "B"] },
      4: { type: [String], default: ["A", "B"] },
    },
    color: { type: String, default: "#1e3a8a" }, // accent used in UI chips, navy shade by default
  },
  { timestamps: true }
);

module.exports = mongoose.model("Branch", branchSchema);
