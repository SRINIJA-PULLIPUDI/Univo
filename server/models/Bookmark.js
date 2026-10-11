const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: "Resource" },
    circular: { type: mongoose.Schema.Types.ObjectId, ref: "Circular" },
    folder: { type: String, default: "General", trim: true },
    // Snapshots so bookmarks remain intact even if faculty deletes the resource
    title: { type: String },
    fileName: { type: String },
    fileUrl: { type: String },
    fileType: { type: String },
    subjectName: { type: String },
    uploadedByName: { type: String },
  },
  { timestamps: true }
);

bookmarkSchema.index({ user: 1, resource: 1, folder: 1 }, {
  unique: true,
  partialFilterExpression: { resource: { $type: "objectId" } },
});
bookmarkSchema.index({ user: 1, circular: 1, folder: 1 }, {
  unique: true,
  partialFilterExpression: { circular: { $type: "objectId" } },
});

module.exports = mongoose.model("Bookmark", bookmarkSchema);
