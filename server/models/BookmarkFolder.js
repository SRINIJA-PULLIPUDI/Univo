const mongoose = require("mongoose");

const bookmarkFolderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { timestamps: true }
);

bookmarkFolderSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("BookmarkFolder", bookmarkFolderSchema);