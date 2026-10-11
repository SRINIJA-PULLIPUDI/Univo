const Circular = require("../models/Circular");
const Group = require("../models/Group");
const Message = require("../models/Message");
const Resource = require("../models/Resource");
const Subject = require("../models/Subject");
const SubjectAssignment = require("../models/SubjectAssignment");
const User = require("../models/User");
const Task = require("../models/Task");
const TaskSubmission = require("../models/TaskSubmission");
const Buzz = require("../models/Buzz");
const ForumPost = require("../models/ForumPost");
const { ensureGroupsExist } = require("./groupController");

exports.unreadCounts = async (req, res) => {
  try {
    await ensureGroupsExist();
    const { role, branch, year, semester } = req.user;
    const semesterStart = req.user.semesterStartedAt || req.user.createdAt;
    const yearStart = req.user.yearStartedAt || req.user.createdAt;
    if (role === "admin") {
      return res.json({ counts: { announcements: 0, discussions: 0, direct: 0, resources: 0, circulars: 0, assignments: 0, buzz: 0, forum: 0 } });
    }

    if (role === "coordinator") {
      const [buzz, forum] = await Promise.all([
        Buzz.countDocuments({ postedBy: { $ne: req.user._id }, readBy: { $ne: req.user._id } }),
        ForumPost.countDocuments({ postedBy: { $ne: req.user._id }, readBy: { $ne: req.user._id } }),
      ]);
      return res.json({ counts: { announcements: 0, discussions: 0, direct: 0, resources: 0, circulars: 0, assignments: 0, buzz, forum } });
    }

    let groupFilter;
    if (role === "hod") groupFilter = { $or: [{ type: "hod_community" }, { type: "year_group", branch }] };
    else if (role === "faculty") groupFilter = { type: "year_group", branch };
    else if (role === "operator") groupFilter = { type: "year_group", branch };
    else if (role === "student") groupFilter = { type: "year_group", branch, year };
    else groupFilter = { _id: { $exists: false } };

    const groups = await Group.find(groupFilter).select("_id").lean();
    const groupIds = groups.map((group) => group._id);
    let subjectIds = [];
    let assignments = [];
    if (role === "student") {
      subjectIds = (await Subject.find({ branch, year, semester }).select("_id").lean()).map((subject) => subject._id);
    } else if (["faculty", "hod"].includes(role)) {
      // HOD and Faculty are only notified for resources of subjects assigned to them as a teacher
      assignments = await SubjectAssignment.find({ faculty: req.user._id }).select("subject section").lean();
      subjectIds = [...new Set(assignments.map((assignment) => String(assignment.subject)))];
    }

    const [announcements, discussions, resources, circulars, assignmentNotifications, buzz, forum] = await Promise.all([
      groupIds.length ? Message.countDocuments({
        group: { $in: groupIds }, context: "announcement", sender: { $ne: req.user._id }, readBy: { $ne: req.user._id },
        createdAt: { $gte: role === "student" ? yearStart : (req.user.createdAt || new Date(0)) },
      }) : 0,
      subjectIds.length ? Message.countDocuments({
        subject: { $in: subjectIds }, context: "subject_discussion", sender: { $ne: req.user._id }, readBy: { $ne: req.user._id },
        ...(role === "student" ? { createdAt: { $gte: semesterStart } } : {}),
      }) : 0,
      subjectIds.length ? Resource.countDocuments({
        subject: { $in: subjectIds }, uploadedBy: { $ne: req.user._id }, readBy: { $ne: req.user._id },
      }) : 0,
      countUnreadCirculars(req.user),
      role === "student"
        ? TaskSubmission.countDocuments({
            student: req.user._id,
            $or: [
              { status: "pending", statusReadAt: null },
              { status: "rejected", statusReadAt: null },
              { status: "completed", verified: true, statusReadAt: null },
            ],
          })
        : ["faculty", "hod", "operator"].includes(role)
        ? (async () => {
            // Creators get notified of proofs submitted by students waiting for review
            const myTasks = await Task.find({ assignedBy: req.user._id }).select("_id").lean();
            const myTaskIds = myTasks.map((t) => t._id);
            if (!myTaskIds.length) return 0;
            return TaskSubmission.countDocuments({
              task: { $in: myTaskIds },
              status: "completed",
              verified: false,
            });
          })()
        : 0,
      Buzz.countDocuments({ postedBy: { $ne: req.user._id }, readBy: { $ne: req.user._id } }),
      ForumPost.countDocuments({ postedBy: { $ne: req.user._id }, readBy: { $ne: req.user._id } }),
    ]);

    let direct = 0;
    if (role === "student") {
      const currentAssignments = await SubjectAssignment.find({ subject: { $in: subjectIds }, section: req.user.section }).select("subject faculty").lean();
      const rooms = currentAssignments.map((assignment) => `direct-${assignment.subject}-${req.user._id}-${assignment.faculty}`);
      if (rooms.length) direct = await Message.countDocuments({
        room: { $in: rooms }, context: "direct", sender: { $ne: req.user._id }, readBy: { $ne: req.user._id },
        createdAt: { $gte: semesterStart },
      });
    } else if (assignments.length) {
      const subjects = await Subject.find({ _id: { $in: subjectIds } }).select("_id branch year semester").lean();
      const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
      const rooms = [];
      for (const assignment of assignments) {
        const subject = subjectById.get(String(assignment.subject));
        if (!subject) continue;
        const students = await User.find({
          role: "student", isActive: true, isAlumni: { $ne: true },
          branch: subject.branch, year: subject.year, semester: subject.semester, section: assignment.section,
        }).select("_id").lean();
        rooms.push(...students.map((student) => `direct-${subject._id}-${student._id}-${req.user._id}`));
      }
      if (rooms.length) direct = await Message.countDocuments({
        room: { $in: rooms }, context: "direct", sender: { $ne: req.user._id }, readBy: { $ne: req.user._id },
      });
    }

    res.json({
      counts: {
        announcements,
        discussions: ["operator"].includes(role) ? 0 : discussions,
        direct: ["operator"].includes(role) ? 0 : direct,
        resources: ["operator"].includes(role) ? 0 : resources,
        circulars,
        assignments: assignmentNotifications,
        buzz,
        forum,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load notifications", error: err.message });
  }
};

async function countUnreadCirculars(user) {
  const { role, branch, year, section } = user;
  if (!["student", "faculty", "hod", "operator"].includes(role)) return 0;
  if (role === "student" && user.isAlumni) return 0;
  let filter = {};
  if (role === "student") {
    filter = { $and: [
      { $or: [{ branches: { $size: 0 } }, { branches: branch }] },
      { $or: [{ years: { $size: 0 } }, { years: year }] },
      { $or: [{ sections: { $size: 0 } }, { sections: section }] },
    ] };
  } else if (["faculty", "hod", "operator"].includes(role)) {
    filter = { $or: [{ branches: { $size: 0 } }, { branches: branch }] };
  }
  return Circular.countDocuments({
    ...filter,
    uploadedBy: { $ne: user._id },
    readBy: { $ne: user._id },
  });
}