const Subject = require("../models/Subject");
const SubjectAssignment = require("../models/SubjectAssignment");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Message = require("../models/Message");
const Resource = require("../models/Resource");
const canAccessSubject = require("../utils/subjectAccess");

async function getUnreadResourceCounts(subjectIds, userId) {
  if (!subjectIds.length) return new Map();
  const groups = await Resource.aggregate([
    { $match: { subject: { $in: subjectIds }, uploadedBy: { $ne: userId }, readBy: { $ne: userId } } },
    { $group: { _id: "$subject", count: { $sum: 1 } } },
  ]);
  return new Map(groups.map((group) => [String(group._id), group.count]));
}

// GET /api/subjects?branch=&year=&semester=
// Returns subjects with their per-section assignments populated - this is
// what powers the "Subject Management" screen (grouped by year on the client).
exports.listSubjects = async (req, res) => {
  try {
    const filter = {};
    if (["student", "faculty", "hod", "operator", "coordinator"].includes(req.user.role)) filter.branch = req.user.branch;
    else if (req.user.role === "admin" && req.query.branch) filter.branch = req.query.branch;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.semester) filter.semester = Number(req.query.semester);

    const subjects = await Subject.find(filter).sort({ year: 1, name: 1 }).lean();
    const subjectIds = subjects.map((s) => s._id);
    const unreadCounts = await getUnreadResourceCounts(subjectIds, req.user._id);
    const assignments = await SubjectAssignment.find({ subject: { $in: subjectIds } })
      .populate("faculty", "name email designation branch")
      .lean();

    const bySubject = {};
    for (const a of assignments) {
      bySubject[a.subject] = bySubject[a.subject] || [];
      bySubject[a.subject].push(a);
    }
    const result = subjects.map((s) => ({
      ...s,
      assignments: bySubject[s._id] || [],
      unreadResourceCount: unreadCounts.get(String(s._id)) || 0,
    }));
    res.json({ subjects: result });
  } catch (err) {
    res.status(500).json({ message: "Could not load subjects", error: err.message });
  }
};

// Subjects a faculty member currently teaches (any branch, any section)
exports.mySubjects = async (req, res) => {
  try {
    const assignments = await SubjectAssignment.find({ faculty: req.user._id })
      .populate({ path: "subject", populate: { path: "branch" } })
      .lean();
    const subjectIds = [...new Set(assignments.map((assignment) => assignment.subject?._id).filter(Boolean))];
    const unreadResourceCounts = await getUnreadResourceCounts(subjectIds, req.user._id);

    // Calculate unread direct chat messages from students to this faculty for each subject
    const unreadChatCounts = new Map();
    for (const sid of subjectIds) {
      const roomRegex = new RegExp(`^direct-${sid}-.*-${req.user._id}$`);
      const count = await Message.countDocuments({
        context: "direct",
        room: roomRegex,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      });
      unreadChatCounts.set(String(sid), count);
    }

    res.json({
      assignments: assignments.map((assignment) => {
        if (!assignment.subject) return assignment;
        const sid = String(assignment.subject._id);
        const resourceUnread = unreadResourceCounts.get(sid) || 0;
        const chatUnread = unreadChatCounts.get(sid) || 0;
        return {
          ...assignment,
          subject: {
            ...assignment.subject,
            unreadResourceCount: resourceUnread + chatUnread,
            unreadChatCount: chatUnread,
          },
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load your subjects", error: err.message });
  }
};

// Subjects visible to the logged-in student: their branch + year + current semester
exports.studentSubjects = async (req, res) => {
  try {
    if (!["student", "coordinator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Students only" });
    }
    if (req.user.isAlumni) return res.json({ subjects: [] });
    const subjects = await Subject.find({
      branch: req.user.branch,
      year: req.user.year,
      semester: req.user.semester,
    }).lean();
    const subjectIds = subjects.map((s) => s._id);
    const unreadCounts = await getUnreadResourceCounts(subjectIds, req.user._id);
    const assignments = await SubjectAssignment.find({
      subject: { $in: subjectIds },
      section: req.user.section,
    }).populate("faculty", "name email designation");

    const facultyBySubject = {};
    for (const a of assignments) facultyBySubject[a.subject] = a.faculty;

    res.json({
      subjects: subjects.map((s) => ({
        ...s,
        faculty: facultyBySubject[s._id] || null,
        unreadResourceCount: unreadCounts.get(String(s._id)) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load your subjects", error: err.message });
  }
};

exports.getSubject = async (req, res) => {
  try {
    const subjectRecord = await Subject.findById(req.params.id);
    if (!subjectRecord) return res.status(404).json({ message: "Subject not found" });
    if (!await canAccessSubject(req.user, subjectRecord)) {
      if (!["student", "faculty", "hod"].includes(req.user.role)) {
        return res.status(403).json({ message: "You cannot access subject resources" });
      }
      if (req.user.role === "student" && req.user.isAlumni) {
        return res.status(403).json({ message: "Alumni cannot access current subject resources" });
      }
      if (["faculty", "hod"].includes(req.user.role)) {
        return res.status(403).json({ message: "You are not assigned to this subject" });
      }
      return res.status(403).json({ message: "This subject is not available to you" });
    }
    const subject = await Subject.findById(req.params.id).populate("branch", "name code").lean();
    const assignments = await SubjectAssignment.find({ subject: subject._id }).populate(
      "faculty",
      "name email designation"
    );
    const unreadDiscussionCount = await Message.countDocuments({
      subject: subject._id,
      context: "subject_discussion",
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    });
    let unreadDirectCount = 0;
    if (req.user.role === "student") {
      const assignment = await SubjectAssignment.findOne({ subject: subject._id, section: req.user.section }).select("faculty");
      if (assignment) unreadDirectCount = await Message.countDocuments({
        room: `direct-${subject._id}-${req.user._id}-${assignment.faculty}`,
        context: "direct", sender: { $ne: req.user._id }, readBy: { $ne: req.user._id },
      });
    } else if (["faculty", "hod"].includes(req.user.role)) {
      const myAssignments = await SubjectAssignment.find({ subject: subject._id, faculty: req.user._id }).select("section").lean();
      const students = await User.find({
        role: "student",
        isActive: true,
        isAlumni: { $ne: true },
        branch: subject.branch._id,
        year: subject.year,
        semester: subject.semester,
        section: { $in: myAssignments.map((assignment) => assignment.section) },
      }).select("_id").lean();
      const rooms = students.map((student) => `direct-${subject._id}-${student._id}-${req.user._id}`);
      if (rooms.length) {
        unreadDirectCount = await Message.countDocuments({
          room: { $in: rooms },
          context: "direct",
          sender: { $ne: req.user._id },
          readBy: { $ne: req.user._id },
        });
      }
    }
    const resourceGroups = await Resource.aggregate([
      { $match: { subject: subject._id, uploadedBy: { $ne: req.user._id }, readBy: { $ne: req.user._id } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    const unreadResourceCounts = Object.fromEntries(resourceGroups.map((group) => [group._id, group.count]));
    res.json({ subject: { ...subject, assignments, unreadDiscussionCount, unreadDirectCount, unreadResourceCounts } });
  } catch (err) {
    res.status(500).json({ message: "Could not load subject", error: err.message });
  }
};

// Roster for faculty: students in the subject's branch+year, limited to the
// sections this faculty member is assigned to (HOD/operator see every section).
exports.subjectStudents = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    const mine = await SubjectAssignment.find({ subject: subject._id, faculty: req.user._id });
    if (!mine.length) return res.status(403).json({ message: "You are not assigned to this subject" });
    const filter = {
      role: "student", branch: subject.branch, year: subject.year, semester: subject.semester,
      section: { $in: mine.map((assignment) => assignment.section) }, isActive: true, isAlumni: { $ne: true },
    };
    const students = await User.find(filter).select("name rollNumber section").sort({ rollNumber: 1 }).lean();
    const roomsByStudent = new Map(students.map((student) => [String(student._id), `direct-${subject._id}-${student._id}-${req.user._id}`]));
    const rooms = [...roomsByStudent.values()];
    const messages = await Message.find({ context: "direct", room: { $in: rooms } })
      .select("room sender text createdAt readBy")
      .sort({ createdAt: -1 })
      .lean();
    const conversations = new Map();
    for (const message of messages) {
      const studentId = [...roomsByStudent.entries()].find(([, room]) => room === message.room)?.[0];
      if (!studentId) continue;
      const conversation = conversations.get(studentId) || { unreadCount: 0, lastMessage: null, lastMessageAt: null };
      if (String(message.sender) !== String(req.user._id) && !(message.readBy || []).some((id) => String(id) === String(req.user._id))) {
        conversation.unreadCount += 1;
      }
      if (!conversation.lastMessage) {
        conversation.lastMessage = message.text;
        conversation.lastMessageAt = message.createdAt;
      }
      conversations.set(studentId, conversation);
    }
    res.json({
      students: students.map((student) => ({
        ...student,
        ...(conversations.get(String(student._id)) || { unreadCount: 0, lastMessage: null, lastMessageAt: null }),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load students", error: err.message });
  }
};

exports.createSubject = async (req, res) => {
  try {
    if (!["hod", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only HODs and Operators can add subjects" });
    }
    const branch = req.user.branch;
    const semester = Number(req.body.semester);
    const subject = await Subject.create({ ...req.body, semester, year: Math.ceil(semester / 2), branch, createdBy: req.user._id });
    res.status(201).json({ subject });
  } catch (err) {
    res.status(500).json({ message: "Could not create subject", error: err.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const current = await Subject.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Subject not found" });
    if (!["hod", "operator"].includes(req.user.role) || String(current.branch) !== String(req.user.branch)) {
      return res.status(403).json({ message: "You cannot edit this subject" });
    }
    const update = { ...req.body };
    if (update.semester) {
      update.semester = Number(update.semester);
      update.year = Math.ceil(update.semester / 2);
    }
    delete update.branch;
    const subject = await Subject.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json({ subject });
  } catch (err) {
    res.status(500).json({ message: "Could not update subject", error: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    if (!["hod", "operator"].includes(req.user.role) || String(subject.branch) !== String(req.user.branch)) {
      return res.status(403).json({ message: "You cannot delete this subject" });
    }
    await SubjectAssignment.deleteMany({ subject: req.params.id });
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: "Subject removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not delete subject", error: err.message });
  }
};

// Assign or reassign a faculty member to a (subject, section) pair.
// Faculty can belong to ANY branch - that's intentionally not restricted here.
exports.assignFaculty = async (req, res) => {
  try {
    if (!["hod", "operator"].includes(req.user.role)) return res.status(403).json({ message: "You cannot assign faculty" });
    const { subjectId } = req.params;
    const { section, facultyId, studentCount } = req.body;

    const faculty = await User.findById(facultyId);
    if (!faculty || !["faculty", "hod"].includes(faculty.role)) {
      return res.status(400).json({ message: "Selected user is not a faculty member" });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    if (String(subject.branch) !== String(req.user.branch)) return res.status(403).json({ message: "You cannot manage this subject" });
    const branch = await Branch.findById(subject.branch);
    if (!(branch.sectionsByYear?.[subject.year] || []).includes(section)) {
      return res.status(400).json({ message: "Choose a section configured for this year" });
    }
    const count =
      studentCount ??
      (await User.countDocuments({
        role: "student",
        branch: subject.branch,
        year: subject.year,
        semester: subject.semester,
        section,
        isActive: true,
        isAlumni: { $ne: true },
      }));

    const assignment = await SubjectAssignment.findOneAndUpdate(
      { subject: subjectId, section },
      { faculty: facultyId, studentCount: count, assignedBy: req.user._id },
      { new: true, upsert: true }
    ).populate("faculty", "name email designation branch");

    res.json({ assignment });
  } catch (err) {
    res.status(500).json({ message: "Could not assign faculty", error: err.message });
  }
};

exports.removeAssignment = async (req, res) => {
  try {
    if (!["hod", "operator"].includes(req.user.role)) return res.status(403).json({ message: "You cannot remove this assignment" });
    const assignment = await SubjectAssignment.findById(req.params.assignmentId).populate("subject", "branch");
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (String(assignment.subject.branch) !== String(req.user.branch)) return res.status(403).json({ message: "You cannot manage this branch" });
    await SubjectAssignment.findByIdAndDelete(req.params.assignmentId);
    res.json({ message: "Assignment removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not remove assignment", error: err.message });
  }
};
