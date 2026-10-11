const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    year: { type: Number, min: 1, max: 4, required: true },
    section: { type: String, default: null }, // null = every section in the year
    // empty array = every student in the branch/year/section; otherwise a
    // specific roll-number list, matching "assign using year and roll number"
    rollNumbers: [{ type: String }],
    proofRequired: { type: Boolean, default: false },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
