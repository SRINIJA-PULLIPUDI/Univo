const mongoose = require("mongoose");

// Membership is NOT stored as a member list - it's computed from role/branch/year
// (see controllers/groupController.js -> getMyGroups) so that a student who is
// promoted a year automatically loses/gains group access with no data migration.
//
// type "hod_community": one single group, all HODs of the college are members,
//   used for inter-department coordination. branch/year are null.
// type "year_group": one per (branch, year). Members = students of that
//   branch+year, the branch's HOD, and every faculty member of that branch.
const groupSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["hod_community", "year_group"], required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    year: { type: Number, min: 1, max: 4, default: null },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

groupSchema.index({ type: 1, branch: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("Group", groupSchema);
