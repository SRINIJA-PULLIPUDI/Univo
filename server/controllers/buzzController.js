const Buzz = require("../models/Buzz");
const User = require("../models/User");
const { sendNotificationEmail } = require("../utils/mailer");

exports.listBuzz = async (req, res) => {
  const posts = await Buzz.find().populate("postedBy", "name role").sort({ createdAt: -1 });
  if (req.user?._id) {
    await Buzz.updateMany(
      { readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    ).catch(() => {});
  }
  res.json({ posts });
};

exports.createBuzz = async (req, res) => {
  try {
    if (!["coordinator", "hod", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only Student Coordinators can post Buzz updates" });
    }
    const post = await Buzz.create({
      ...req.body,
      imageUrl: req.file ? `/uploads/buzz/${req.file.filename}` : null,
      postedBy: req.user._id,
      readBy: [req.user._id],
    });
    const populated = await post.populate("postedBy", "name role");
    req.io?.emit("buzz:new", populated);

    // Notify all active users across campus (excluding admin who doesn't have Buzz)
    const recipients = await User.find({
      isActive: true,
      role: { $ne: "admin" },
      _id: { $ne: req.user._id },
    }).select("_id email name");

    for (const recipient of recipients) {
      req.io?.to(`user:${recipient._id}`).emit("unread:refresh");
      sendNotificationEmail({
        to: recipient.email,
        name: recipient.name,
        title: `Campus Buzz: ${post.title}`,
        message: `A new campus buzz announcement has been posted under ${post.category}: "${post.title}". Check Univo for details!`,
        category: "Campus Buzz",
        link: "http://localhost:5173/app/buzz",
      }).catch(() => {});
    }

    res.status(201).json({ post: populated });
  } catch (err) {
    res.status(500).json({ message: "Could not post to Buzz", error: err.message });
  }
};

exports.updateBuzz = async (req, res) => {
  try {
    const post = await Buzz.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (String(post.postedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own posts" });
    }
    if (req.body.title) post.title = req.body.title;
    if (req.body.body) post.body = req.body.body;
    if (req.body.category) post.category = req.body.category;
    if (req.file) post.imageUrl = `/uploads/buzz/${req.file.filename}`;
    await post.save();
    const updated = await Buzz.findById(post._id).populate("postedBy", "name role");
    req.io?.emit("buzz:new", updated);
    res.json({ post: updated });
  } catch (err) {
    res.status(500).json({ message: "Could not update post", error: err.message });
  }
};

exports.deleteBuzz = async (req, res) => {
  try {
    const post = await Buzz.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (String(post.postedBy) !== String(req.user._id) && req.user.role !== "operator") {
      return res.status(403).json({ message: "You can only remove your own posts" });
    }
    await post.deleteOne();
    req.io?.emit("buzz:deleted", { id: String(post._id) });
    res.json({ message: "Post removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not remove post", error: err.message });
  }
};
