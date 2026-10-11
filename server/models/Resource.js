const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    type: {
      type: String,
      enum: [
        "Lecture Notes",
        "Records",
        "Assignments",
        "Mid Exam Important Questions",
        "Internal/External Important Questions",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // set true once the AI helper has extracted + indexed this file's text
    // for the AI Chat Bot (see utils/aiHelper.js + AiDocument model)
    aiIndexed: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resource", resourceSchema);
