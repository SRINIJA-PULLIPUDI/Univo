const mongoose = require("mongoose");

const personalTaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    dueDate: { type: Date, default: null },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

personalTaskSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("PersonalTask", personalTaskSchema);
