const mongoose = require("mongoose");

const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "New Conversation", trim: true },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aiConversationSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model("AiConversation", aiConversationSchema);
