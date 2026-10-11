const mongoose = require("mongoose");

const forumPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "Trending Tech",
        "Business & Startups",
        "Space & Science",
        "World Records",
        "Placements",
      ],
      default: "Trending Tech",
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

module.exports = mongoose.model("ForumPost", forumPostSchema);
