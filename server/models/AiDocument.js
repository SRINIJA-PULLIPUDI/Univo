const mongoose = require("mongoose");

// Populated by utils/aiHelper.js whenever a Resource (PDF) is uploaded.
// We keep this deliberately simple - plain-text chunks with a naive
// keyword-overlap retrieval (see aiChatController.js) rather than a vector
// DB, so the whole feature runs with nothing more than MongoDB. Swapping in
// a proper embedding index later only touches aiHelper.js + aiChatController.js.
const aiDocumentSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

aiDocumentSchema.index({ subject: 1 });

module.exports = mongoose.model("AiDocument", aiDocumentSchema);
