const mongoose = require("mongoose");

// Reused for three contexts, distinguished by `context`:
// - "announcement": posted into a Group (HOD Community / Year Group). Only
//   hod/faculty/operator may post; students may only react (enforced in controller).
// - "subject_discussion": posted into a Subject's community discussion thread.
//   Students post doubts, the assigned faculty (or any faculty on that subject)
//   answers, visible to everyone enrolled.
// - "direct": 1:1 chat between a student and a subject's assigned faculty.
//   `room` is a deterministic id: `direct-<subjectId>-<studentId>`.
const messageSchema = new mongoose.Schema(
  {
    context: {
      type: String,
      enum: ["announcement", "subject_discussion", "direct"],
      required: true,
    },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null },
    room: { type: String, default: null, index: true }, // used for "direct"
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    text: { type: String, default: "" },
    attachments: [
      {
        url: String,
        filename: String,
        mimeType: String,
      },
    ],
    reactions: {
      // emoji -> array of userIds who reacted with it
      type: Map,
      of: [mongoose.Schema.Types.ObjectId],
      default: {},
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

messageSchema.index({ group: 1, createdAt: 1 });
messageSchema.index({ subject: 1, context: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
