const Message = require("../models/Message");
const SubjectAssignment = require("../models/SubjectAssignment");
const User = require("../models/User");
const Subject = require("../models/Subject");
const canAccessSubject = require("../utils/subjectAccess");

// Everyone enrolled in the subject (its year+section students, plus the
// assigned faculty) can read and post - this is the "ask once, everyone
// benefits" community thread.
exports.getSubjectDiscussion = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You cannot access this discussion" });
    const messageFilter = { subject: req.params.subjectId, context: "subject_discussion" };
    if (req.user.role === "student") messageFilter.createdAt = { $gte: req.user.semesterStartedAt || req.user.createdAt };
    await Message.updateMany(
      { ...messageFilter, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    const messages = await Message.find(messageFilter)
      .populate("sender", "name role designation avatar")
      .populate({ path: "replyTo", select: "text sender", populate: { path: "sender", select: "name role" } })
      .sort({ createdAt: 1 });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: "Could not load discussion", error: err.message });
  }
};

exports.markSubjectDiscussionRead = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You cannot access this discussion" });
    const messageFilter = { subject: req.params.subjectId, context: "subject_discussion" };
    if (req.user.role === "student") messageFilter.createdAt = { $gte: req.user.semesterStartedAt || req.user.createdAt };
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

exports.postSubjectDiscussion = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId).select("branch year");
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    if (!await canAccessSubject(req.user, subject)) return res.status(403).json({ message: "You cannot post in this discussion" });
    const replyTo = req.body.replyTo
      ? await Message.exists({
          _id: req.body.replyTo,
          subject: subject._id,
          context: "subject_discussion",
          ...(req.user.role === "student" ? { createdAt: { $gte: req.user.semesterStartedAt || req.user.createdAt } } : {}),
        })
      : null;
    if (req.body.replyTo && !replyTo) return res.status(400).json({ message: "The message being replied to was not found" });
    const message = await Message.create({
      context: "subject_discussion",
      subject: req.params.subjectId,
      sender: req.user._id,
      replyTo: req.body.replyTo || null,
      readBy: [req.user._id],
      text: req.body.text || "",
      attachments: req.body.attachments || [],
    });
    const populated = await message.populate([
      { path: "sender", select: "name role designation avatar" },
      { path: "replyTo", select: "text sender", populate: { path: "sender", select: "name role" } },
    ]);
    req.io?.to(`subject:${req.params.subjectId}`).emit("message:new", populated);
    const assignments = await SubjectAssignment.find({ subject: req.params.subjectId }).select("faculty section");
    const facultyIds = assignments.map((assignment) => assignment.faculty);
    const sections = [...new Set(assignments.map((assignment) => assignment.section))];
    const recipients = await User.find({
      isActive: true,
      _id: { $ne: req.user._id },
      $or: [
        { role: { $in: ["student", "coordinator"] }, branch: subject.branch, year: subject.year, section: { $in: sections } },
        { role: { $in: ["faculty", "hod"] }, _id: { $in: facultyIds } },
      ],
    }).select("_id");
    for (const recipient of recipients) {
      req.io?.to(`user:${recipient._id}`).emit("unread:message", { kind: "subject", id: String(subject._id) });
    }
    res.status(201).json({ message: populated });
  } catch (err) {
    res.status(500).json({ message: "Could not post message", error: err.message });
  }
};

// 1:1 chat between a student and the faculty assigned to a subject/section.
function directRoom(subjectId, studentId, facultyId) {
  return `direct-${subjectId}-${studentId}-${facultyId}`;
}

async function getAccessibleDirectChat(subjectId, studentId, user) {
  const subject = await Subject.findById(subjectId).select("branch year semester");
  if (!subject) return null;
  const student = await User.findOne({
    _id: studentId,
    role: "student",
    branch: subject.branch,
    year: subject.year,
    semester: subject.semester,
    isActive: true,
    isAlumni: { $ne: true },
  }).select("_id section createdAt semesterStartedAt");
  if (!student) return null;

  let facultyId;
  if (user.role === "student") {
    if (String(user._id) !== String(studentId)) return null;
    const assignment = await SubjectAssignment.findOne({ subject: subjectId, section: student.section }).select("faculty");
    if (!assignment) return null;
    facultyId = assignment.faculty;
  } else if (["faculty", "hod"].includes(user.role)) {
    const assignment = await SubjectAssignment.findOne({ subject: subjectId, faculty: user._id, section: student.section }).select("faculty");
    if (!assignment) return null;
    facultyId = user._id;
  } else return null;

  return { student, facultyId, room: directRoom(subjectId, studentId, facultyId) };
}

exports.getDirectChat = async (req, res) => {
  try {
    const { subjectId, studentId } = req.params;
    const chat = await getAccessibleDirectChat(subjectId, studentId, req.user);
    if (!chat) return res.status(403).json({ message: "You cannot access this chat" });
    const { room, student } = chat;
    const messageFilter = { room, context: "direct" };
    if (req.user.role === "student") messageFilter.createdAt = { $gte: student.semesterStartedAt || student.createdAt };
    await Message.updateMany(
      { ...messageFilter, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    const messages = await Message.find(messageFilter)
      .populate("sender", "name role designation avatar")
      .populate({ path: "replyTo", select: "text sender", populate: { path: "sender", select: "name role" } })
      .sort({ createdAt: 1 });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ messages, room });
  } catch (err) {
    res.status(500).json({ message: "Could not load chat", error: err.message });
  }
};

exports.markDirectChatRead = async (req, res) => {
  try {
    const chat = await getAccessibleDirectChat(req.params.subjectId, req.params.studentId, req.user);
    if (!chat) return res.status(403).json({ message: "You cannot access this chat" });
    const { room } = chat;
    const messageFilter = { room, context: "direct" };
    if (req.user.role === "student") messageFilter.createdAt = { $gte: chat.student.semesterStartedAt || chat.student.createdAt };
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

exports.postDirectChat = async (req, res) => {
  try {
    const { subjectId, studentId } = req.params;
    const chat = await getAccessibleDirectChat(subjectId, studentId, req.user);
    if (!chat) return res.status(403).json({ message: "You cannot access this chat" });

    const { room, student } = chat;
    const replyTo = req.body.replyTo
      ? await Message.exists({ _id: req.body.replyTo, room, context: "direct" })
      : null;
    if (req.body.replyTo && !replyTo) return res.status(400).json({ message: "The message being replied to was not found" });
    const message = await Message.create({
      context: "direct",
      subject: subjectId,
      room,
      sender: req.user._id,
      replyTo: req.body.replyTo || null,
      readBy: [req.user._id],
      text: req.body.text || "",
      attachments: req.body.attachments || [],
    });
    const populated = await message.populate([
      { path: "sender", select: "name role designation avatar" },
      { path: "replyTo", select: "text sender", populate: { path: "sender", select: "name role" } },
    ]);
    req.io?.to(`direct:${room}`).emit("message:new", populated);
    const recipients = req.user.role === "student" ? [chat.facultyId] : [student._id];
    for (const recipientId of recipients) {
      if (String(recipientId) !== String(req.user._id)) {
        req.io?.to(`user:${recipientId}`).emit("unread:message", { kind: "direct", id: room, subjectId });
      }
    }
    res.status(201).json({ message: populated });
  } catch (err) {
    res.status(500).json({ message: "Could not send message", error: err.message });
  }
};

exports.getRecentCommunityMessages = async (req, res) => {
  try {
    let subjectIds = [];
    if (["faculty", "hod"].includes(req.user.role)) {
      const assignments = await SubjectAssignment.find({ faculty: req.user._id }).select("subject").lean();
      subjectIds = [...new Set(assignments.map((a) => String(a.subject)))];
      if (req.user.role === "hod" || !subjectIds.length) {
        const branchSubjects = await Subject.find({ branch: req.user.branch }).select("_id").lean();
        const branchSubIds = branchSubjects.map((s) => String(s._id));
        subjectIds = [...new Set([...subjectIds, ...branchSubIds])];
      }
    } else if (req.user.role === "student") {
      const branchSubjects = await Subject.find({
        branch: req.user.branch,
        year: req.user.year,
        semester: req.user.semester,
      }).select("_id").lean();
      subjectIds = branchSubjects.map((s) => String(s._id));
    } else {
      const allSubjects = await Subject.find().select("_id").lean();
      subjectIds = allSubjects.map((s) => String(s._id));
    }

    const limit = Math.min(Number(req.query.limit) || 6, 20);
    const messages = await Message.find({
      subject: { $in: subjectIds },
      context: "subject_discussion",
    })
      .populate("sender", "name role designation avatar")
      .populate("subject", "name code")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: "Could not load recent community messages", error: err.message });
  }
};
