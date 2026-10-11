const mongoose = require("mongoose");

const aiMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "AiConversation", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    sourcesUsed: [{ type: String }],
  },
  { timestamps: true }
);

aiMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model("AiMessage", aiMessageSchema);
