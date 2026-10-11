const mongoose = require("mongoose");

const buzzSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: {
      type: String,
      enum: ["Sports", "Event Registration", "Part-time Job", "Camp/Workshop", "Other"],
      default: "Other",
    },
    imageUrl: { type: String, default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        type: { type: String, default: "heart" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Buzz", buzzSchema);
