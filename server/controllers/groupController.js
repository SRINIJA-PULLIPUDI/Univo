const Group = require("../models/Group");
const Message = require("../models/Message");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Subject = require("../models/Subject");
const canAccessSubject = require("../utils/subjectAccess");

const YEAR_LABEL = { 1: "1st Year", 2: "2nd Year", 3: "3rd Year", 4: "4th Year" };

// Ensures the singleton HOD Community group + all (branch, year) groups
// exist. Cheap to call - createGroups is idempotent via the unique index.
async function ensureGroupsExist() {
  const ops = [
    Group.updateOne(
      { type: "hod_community" },
      { $setOnInsert: { type: "hod_community", name: "HOD Community" } },
      { upsert: true }
    ),
  ];
  const branches = await Branch.find();
  for (const b of branches) {
    for (let y = 1; y <= 4; y++) {
      ops.push(
        Group.updateOne(
          { type: "year_group", branch: b._id, year: y },
          { $setOnInsert: { type: "year_group", branch: b._id, year: y, name: `${YEAR_LABEL[y]} Group` } },
          { upsert: true }
        )
      );
    }
  }
  await Promise.all(ops);
}
exports.ensureGroupsExist = ensureGroupsExist;

function canAccessGroup(user, group) {
  if (!group) return false;
  if (group.type === "hod_community") return user.role === "hod";
  if (String(group.branch) !== String(user.branch)) return false;
  if (user.role === "student") return group.type === "year_group" && group.year === user.year && !user.isAlumni;
  return ["faculty", "hod", "operator"].includes(user.role) && group.type === "year_group";
}

// Returns the groups the logged-in user can see, per the spec's access rules:
//   hod      -> HOD Community + all 4 year groups of their own branch
//   faculty  -> all 4 year groups of their own branch (no HOD Community)
//   student  -> exactly ONE year group (their own branch + year)
//   operator -> HOD Community (observer) + every year group, for oversight
//   coordinator -> the year group matching their own year (like a student)
exports.getMyGroups = async (req, res) => {
  try {
    await ensureGroupsExist();
    const { role, branch, year } = req.user;
    let query;
    if (role === "hod") {
      query = { $or: [{ type: "hod_community" }, { type: "year_group", branch }] };
    } else if (role === "faculty") {
      query = { type: "year_group", branch };
    } else if (role === "operator") {
      query = { type: "year_group", branch };
    } else if (role === "student" && !req.user.isAlumni) {
      // student or coordinator - single group
      query = { type: "year_group", branch, year };
    } else query = { _id: { $exists: false } };
    const groups = await Group.find(query).populate("branch", "name code").sort({ type: -1, year: 1 });
    const withUnreadCounts = await Promise.all(groups.map(async (group) => ({
      ...group.toObject(),
      unreadCount: await Message.countDocuments({
        group: group._id,
        context: "announcement",
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
        createdAt: { $gte: role === "student" ? (req.user.yearStartedAt || req.user.createdAt) : (req.user.createdAt || new Date(0)) },
      }),
    })));
    res.json({ groups: withUnreadCounts });
  } catch (err) {
    res.status(500).json({ message: "Could not load groups", error: err.message });
  }
};

exports.getLatestAnnouncements = async (req, res) => {
  try {
    await ensureGroupsExist();
    const { role, branch, year } = req.user;
    let query;
    if (role === "hod") {
      query = { $or: [{ type: "hod_community" }, { type: "year_group", branch }] };
    } else if (["faculty", "operator"].includes(role)) {
      query = { type: "year_group", branch };
    } else if (role === "student" && !req.user.isAlumni) {
      query = { type: "year_group", branch, year };
    } else {
      return res.json({ messages: [] });
    }

    const groups = await Group.find(query).select("_id");
    const groupIds = groups.map((g) => g._id);

    const messageFilter = { group: { $in: groupIds }, context: "announcement" };
    if (req.user.role === "student") {
      messageFilter.createdAt = { $gte: req.user.yearStartedAt || req.user.createdAt };
    }

    const limit = Math.min(Number(req.query.limit) || 6, 20);
    const messages = await Message.find(messageFilter)
      .populate("sender", "name role designation avatar")
      .populate("group", "name type year")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: "Could not load latest announcements", error: err.message });
  }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).select("type branch year");
    if (!canAccessGroup(req.user, group)) return res.status(403).json({ message: "You cannot access this group" });
    const messageFilter = { group: req.params.groupId, context: "announcement" };
    if (req.user.role === "student") messageFilter.createdAt = { $gte: req.user.yearStartedAt || req.user.createdAt };
    if (req.query.preview !== "true") {
      await Message.updateMany(
        { ...messageFilter, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
        { $addToSet: { readBy: req.user._id } }
      );
    }
    let messageQuery = Message.find(messageFilter)
      .populate("sender", "name role designation avatar")
      .sort({ createdAt: req.query.preview === "true" ? -1 : 1 });
    if (req.query.preview === "true") messageQuery = messageQuery.limit(Math.min(Number(req.query.limit) || 3, 10));
    let messages = await messageQuery;
    if (req.query.preview === "true") messages = messages.reverse();
    else req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: "Could not load messages", error: err.message });
  }
};

exports.markGroupRead = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).select("type branch year");
    if (!canAccessGroup(req.user, group)) return res.status(403).json({ message: "You cannot access this group" });
    const messageFilter = { group: req.params.groupId, context: "announcement" };
    if (req.user.role === "student") messageFilter.createdAt = { $gte: req.user.yearStartedAt || req.user.createdAt };
    await Message.updateMany(
      { ...messageFilter, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ message: "Messages marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Could not mark messages as read", error: err.message });
  }
};

// Only hod/faculty/operator may post; students/coordinators are read+react only.
exports.postGroupMessage = async (req, res) => {
  try {
    if (!["hod", "faculty", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only HODs and Faculty can post announcements" });
    }
    const group = await Group.findById(req.params.groupId).select("type branch year");
    if (!canAccessGroup(req.user, group)) return res.status(403).json({ message: "You cannot post to this group" });
    if (group.type === "hod_community" && req.user.role !== "hod") {
      return res.status(403).json({ message: "Only HODs can post to the HOD Community" });
    }
    const message = await Message.create({
      context: "announcement",
      group: req.params.groupId,
      sender: req.user._id,
      readBy: [req.user._id],
      text: req.body.text || "",
      attachments: req.body.attachments || [],
    });
    const populated = await message.populate([
      { path: "sender", select: "name role designation avatar" },
      { path: "replyTo", select: "text sender", populate: { path: "sender", select: "name role" } },
    ]);
    req.io?.to(`group:${req.params.groupId}`).emit("message:new", populated);
    await exports.notifyGroupRecipients(req, req.params.groupId, req.user._id);
    res.status(201).json({ message: populated });
  } catch (err) {
    res.status(500).json({ message: "Could not post message", error: err.message });
  }
};

exports.reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.context === "announcement") {
      const group = await Group.findById(message.group).select("type branch year");
      if (!canAccessGroup(req.user, group)) return res.status(403).json({ message: "You cannot react in this group" });
      if (req.user.role === "student" && message.createdAt < (req.user.yearStartedAt || req.user.createdAt)) {
        return res.status(404).json({ message: "Message not found" });
      }
    } else if (message.context === "subject_discussion") {
      const subject = await Subject.findById(message.subject);
      if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You cannot react in this discussion" });
      if (req.user.role === "student" && message.createdAt < (req.user.semesterStartedAt || req.user.createdAt)) {
        return res.status(404).json({ message: "Message not found" });
      }
    } else if (message.context === "direct") {
      const isParticipant = message.room?.includes(String(req.user._id)) || String(message.sender) === String(req.user._id);
      if (!isParticipant) return res.status(403).json({ message: "You cannot react in this private chat" });
    } else {
      return res.status(403).json({ message: "Reactions are not available in this conversation" });
    }
    if (!EMOJIS.has(emoji)) return res.status(400).json({ message: "Unsupported reaction" });

    const reactions = message.reactions || new Map();
    const current = reactions.get(emoji) || [];
    const uid = String(req.user._id);
    const already = current.some((id) => String(id) === uid);
    reactions.set(emoji, already ? current.filter((id) => String(id) !== uid) : [...current, req.user._id]);
    message.reactions = reactions;
    await message.save();

    const populated = await message.populate([
      { path: "sender", select: "name role designation avatar" },
      { path: "replyTo", select: "text sender", populate: { path: "sender", select: "name role" } },
    ]);
    const room = message.context === "announcement"
      ? `group:${message.group}`
      : message.context === "subject_discussion"
        ? `subject:${message.subject}`
        : `direct:${message.room}`;
    req.io?.to(room).emit("message:reaction", populated);
    res.json({ message: populated });
  } catch (err) {
    res.status(500).json({ message: "Could not react to message", error: err.message });
  }
};

const EMOJIS = new Set(["👍", "❤️", "🎉", "🙏"]);

const { sendNotificationEmail } = require("../utils/mailer");

exports.notifyGroupRecipients = async (req, groupId, senderId) => {
  const group = await Group.findById(groupId).select("type branch year name");
  if (!group) return;

  let branchHodId = null;
  if (group.branch) {
    const branchDoc = await Branch.findById(group.branch).select("hod");
    if (branchDoc?.hod) branchHodId = branchDoc.hod;
  }

  const audience = group.type === "hod_community"
    ? { role: "hod", isActive: true }
    : {
        isActive: true,
        $or: [
          { role: "operator", branch: group.branch },
          { role: "hod", branch: group.branch },
          ...(branchHodId ? [{ _id: branchHodId }] : []),
          { role: "faculty", branch: group.branch },
          { role: "student", branch: group.branch, year: group.year },
        ],
      };
  const recipients = await User.find({ ...audience, _id: { $ne: senderId } }).select("_id email name");
  console.log(`[announcement] Dispatching notifications to ${recipients.length} recipients for group: "${group.name}"`);
  for (const recipient of recipients) {
    req.io?.to(`user:${recipient._id}`).emit("unread:message", { kind: "group", id: String(groupId) });

    // Send email notification (async fire-and-forget)
    sendNotificationEmail({
      to: recipient.email,
      name: recipient.name,
      title: `New announcement in ${group.name}`,
      message: `A new announcement message has been posted in your group: ${group.name}. Log into Univo to view and reply.`,
      category: "Group Announcement",
      link: "http://localhost:5173/app/announcements",
    }).catch((err) => console.warn(`⚠️ [announcement mail fail] ${recipient.email}:`, err.message));
  }
};
