const mongoose = require("mongoose");

// One row = one period, one day, for one (branch, year, section).
// Set up by the HOD/Coordinator. Powers "what's my next class?" style
// questions in the AI Chat Bot as well as a simple weekly-grid view.
const timetableSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    year: { type: Number, min: 1, max: 4, required: true },
    section: { type: String, required: true },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true,
    },
    period: { type: Number, required: true }, // 1..N
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true }, // "09:50"
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
    subjectName: { type: String, default: "" }, // freeform fallback (e.g. "Lunch Break")
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

timetableSchema.index({ branch: 1, year: 1, section: 1, day: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("Timetable", timetableSchema);
