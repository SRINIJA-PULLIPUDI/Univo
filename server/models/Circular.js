const mongoose = require("mongoose");

// Targeting rules per the spec:
//   HOD / Operator -> year-wise only (sections left empty = whole year(s))
//   Faculty        -> year-wise AND section-wise
// Operator circulars can span multiple branches (college-wide notices);
// HOD/Faculty circulars are implicitly scoped to their own branch.
const circularSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["Academic", "Administrative", "Examination", "Event", "Placement", "Other"],
      default: "Academic",
    },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }], // empty = uploader's own branch only
    years: [{ type: Number, min: 1, max: 4 }], // empty = all years
    sections: [{ type: String }], // empty = all sections in the targeted years
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Circular", circularSchema);
