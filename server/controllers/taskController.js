const Task = require("../models/Task");
const TaskSubmission = require("../models/TaskSubmission");
const PersonalTask = require("../models/PersonalTask");
const User = require("../models/User");
const ExcelJS = require("exceljs");
const fs = require("fs/promises");
const path = require("path");

function parseDueDate(value) {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) {
    const error = new Error("The due date is invalid");
    error.status = 400;
    throw error;
  }
  const inputDay = dateOnly ? String(value) : dueDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (inputDay < today) {
    const error = new Error("Please enter today or a later date.");
    error.status = 400;
    throw error;
  }
  return dueDate;
}

exports.listPersonalTasks = async (req, res) => {
  try {
    const tasks = await PersonalTask.find({ user: req.user._id }).sort({ completed: 1, dueDate: 1, createdAt: -1 });
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: "Could not load your personal tasks", error: err.message });
  }
};

exports.createPersonalTask = async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "A task title is required" });
    const task = await PersonalTask.create({
      user: req.user._id,
      title,
      description: String(req.body.description || "").trim(),
      dueDate: parseDueDate(req.body.dueDate),
    });
    res.status(201).json({ task });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Could not create your personal task" });
  }
};

exports.updatePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, user: req.user._id });
    if (!task) return res.status(404).json({ message: "Personal task not found" });
    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ message: "A task title is required" });
      task.title = title;
    }
    if (req.body.description !== undefined) task.description = String(req.body.description).trim();
    if (req.body.dueDate !== undefined) task.dueDate = parseDueDate(req.body.dueDate);
    if (req.body.completed !== undefined) {
      if (typeof req.body.completed !== "boolean") return res.status(400).json({ message: "Task completion must be true or false" });
      task.completed = req.body.completed;
    }
    await task.save();
    res.json({ task });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Could not update your personal task" });
  }
};

exports.deletePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOneAndDelete({ _id: req.params.taskId, user: req.user._id });
    if (!task) return res.status(404).json({ message: "Personal task not found" });
    res.json({ message: "Personal task deleted" });
  } catch (err) {
    res.status(500).json({ message: "Could not delete your personal task", error: err.message });
  }
};

async function removeProofFile(proofUrl) {
  if (!proofUrl) return;
  const filePath = path.join(__dirname, "..", "uploads", "proofs", path.basename(proofUrl));
  await fs.unlink(filePath).catch((err) => {
    if (err.code !== "ENOENT") throw err;
  });
}

async function readRollNumbers(file) {
  if (!file) return [];
  if (!/\.xlsx$/i.test(file.originalname)) {
    const error = new Error("Upload an .xlsx workbook for roll numbers");
    error.status = 400;
    throw error;
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.buffer);
  } catch {
    const error = new Error("The uploaded workbook could not be read");
    error.status = 400;
    throw error;
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    const error = new Error("The workbook has no worksheet");
    error.status = 400;
    throw error;
  }

  const firstRow = sheet.getRow(1);
  const headerColumn = firstRow.values.findIndex((value) => /roll\s*(number|no\.?|#)|rollno/i.test(String(value || "")));
  const column = headerColumn > 0 ? headerColumn : 1;
  const firstDataRow = headerColumn > 0 ? 2 : 1;
  const rollNumbers = new Set();

  for (let rowNumber = firstDataRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const value = sheet.getRow(rowNumber).getCell(column).text.trim();
    if (value) rollNumbers.add(value);
  }
  return [...rollNumbers];
}

// Faculty/Coordinators/HODs assign tasks by year (+ optional section + roll numbers)
exports.createTask = async (req, res) => {
  try {
    if (!["faculty", "hod", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to assign tasks" });
    }
    const bodyRollNumbers = typeof req.body.rollNumbers === "string"
      ? JSON.parse(req.body.rollNumbers || "[]")
      : (req.body.rollNumbers || []);
    const uploadedRollNumbers = await readRollNumbers(req.file);
    if (req.file && uploadedRollNumbers.length === 0) {
      return res.status(400).json({ message: "No roll numbers were found in the uploaded workbook" });
    }
    const rollNumbers = [...new Set([...bodyRollNumbers, ...uploadedRollNumbers].map((number) => String(number).trim()).filter(Boolean))];
    if (req.body.dueDate && req.body.dueDate < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ message: "The due date must be today or a future date." });
    }
    const task = await Task.create({
      ...req.body,
      section: req.body.section || null,
      dueDate: req.body.dueDate || null,
      rollNumbers,
      assignedBy: req.user._id,
      branch: req.user.branch,
    });

    // pre-create a "pending" submission row per matching student, so
    // progress can be tracked/queried without recomputing membership every time
    const studentFilter = { role: "student", branch: task.branch, year: task.year, isActive: true };
    if (task.section) studentFilter.section = task.section;
    if (task.rollNumbers?.length) studentFilter.rollNumber = { $in: task.rollNumbers };

    const students = await User.find(studentFilter).select("_id email name");
    await TaskSubmission.insertMany(
      students.map((s) => ({ task: task._id, student: s._id })),
      { ordered: false }
    ).catch(() => {}); // ignore dup key races

    const { sendNotificationEmail } = require("../utils/mailer");

    for (const student of students) {
      req.io?.to(`user:${student._id}`).emit("task:new", { taskId: String(task._id) });
      sendNotificationEmail({
        to: student.email,
        name: student.name,
        title: `New Task Assigned: ${task.title}`,
        message: `A new academic task "${task.title}" has been assigned to your section. Due date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No deadline"}. Check your Tasks tab in Univo.`,
        category: "Assignment / Task",
        link: "http://localhost:5173/app/my-tasks",
      }).catch(() => {});
    }

    // Also notify HOD of this branch
    const branchHod = await User.findOne({ role: "hod", branch: task.branch, isActive: true }).select("_id email name");
    if (branchHod && String(branchHod._id) !== String(req.user._id)) {
      req.io?.to(`user:${branchHod._id}`).emit("task:new", { taskId: String(task._id) });
      sendNotificationEmail({
        to: branchHod.email,
        name: branchHod.name,
        title: `Department Task Created: ${task.title}`,
        message: `A new task "${task.title}" was created for Year ${task.year}${task.section ? ` Section ${task.section}` : ""}.`,
        category: "Department Oversight",
        link: "http://localhost:5173/app/tasks",
      }).catch(() => {});
    }

    res.status(201).json({ task, assignedCount: students.length });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Could not create task" });
  }
};

// Student's own to-do list
exports.myTasks = async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({
      student: req.user._id,
      dismissedByStudent: { $ne: true },
    })
      .populate({ path: "task", populate: { path: "assignedBy", select: "name role" } })
      .sort({ createdAt: -1 });
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ message: "Could not load your tasks", error: err.message });
  }
};

exports.markAssignmentNotificationsRead = async (req, res) => {
  try {
    await TaskSubmission.updateMany(
      { student: req.user._id, statusReadAt: null },
      { $set: { statusReadAt: new Date() } }
    );
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ message: "Assignment notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Could not update assignment notifications", error: err.message });
  }
};

exports.completeTask = async (req, res) => {
  try {
    const submission = await TaskSubmission.findOne({ task: req.params.taskId, student: req.user._id }).populate("task");
    if (!submission) return res.status(404).json({ message: "Task not found for you" });

    // Block submission if assignment is overdue
    if (submission.task?.dueDate) {
      const today = new Date().toISOString().slice(0, 10);
      const due = new Date(submission.task.dueDate).toISOString().slice(0, 10);
      if (due < today) {
        if (req.file) await removeProofFile(req.file.filename);
        return res.status(400).json({ message: "This assignment is overdue and submissions are closed." });
      }
    }

    if (submission.task.proofRequired && !submission.proofUrl) {
      return res.status(400).json({ message: "Upload the required proof before marking this task complete" });
    }

    submission.status = "completed";
    submission.completedAt = new Date();
    submission.verified = false;
    submission.verifiedBy = null;
    submission.rejectionReason = "";
    submission.statusReadAt = new Date();
    await submission.save();
    const task = await Task.findById(submission.task).select("assignedBy title");
    req.io?.to(`user:${req.user._id}`).emit("task:status", { taskId: String(task._id) });
    req.io?.to(`user:${task.assignedBy}`).emit("task:submission", { taskId: String(task._id) });
    req.io?.to(`user:${task.assignedBy}`).emit("unread:refresh");

    const { sendNotificationEmail } = require("../utils/mailer");
    const creatorUser = await User.findById(task.assignedBy).select("email name");
    if (creatorUser) {
      sendNotificationEmail({
        to: creatorUser.email,
        name: creatorUser.name,
        title: `Assignment Submission: ${task.title}`,
        message: `${req.user.name} (${req.user.rollNumber || "Student"}) submitted proof for "${task.title}". Please review it in the Assignments tab.`,
        category: "Assignment Submission",
        link: "http://localhost:5173/app/tasks",
      }).catch(() => {});
    }

    res.json({ submission });
  } catch (err) {
    res.status(500).json({ message: "Could not mark task complete", error: err.message });
  }
};

exports.uploadProof = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a proof file to upload" });
    const submission = await TaskSubmission.findOne({ task: req.params.taskId, student: req.user._id }).populate("task");
    if (!submission) {
      await removeProofFile(req.file.filename);
      return res.status(404).json({ message: "Task not found for you" });
    }

    // Block proof upload if assignment is overdue
    if (submission.task?.dueDate) {
      const today = new Date().toISOString().slice(0, 10);
      const due = new Date(submission.task.dueDate).toISOString().slice(0, 10);
      if (due < today) {
        await removeProofFile(req.file.filename);
        return res.status(400).json({ message: "This assignment is overdue and submissions are closed." });
      }
    }

    await removeProofFile(submission.proofUrl);
    submission.proofUrl = `/uploads/proofs/${req.file.filename}`;
    submission.proofFileName = req.file.originalname;
    if (submission.status === "rejected") {
      submission.status = "pending";
      submission.completedAt = null;
      submission.verified = false;
      submission.verifiedBy = null;
      submission.rejectionReason = "";
      submission.statusReadAt = new Date();
    }
    await submission.save();
    const task = await Task.findById(submission.task).select("assignedBy title");
    req.io?.to(`user:${req.user._id}`).emit("task:status", { taskId: String(task._id) });
    req.io?.to(`user:${task.assignedBy}`).emit("task:submission", { taskId: String(task._id) });
    req.io?.to(`user:${task.assignedBy}`).emit("unread:refresh");

    const { sendNotificationEmail } = require("../utils/mailer");
    const creatorUser = await User.findById(task.assignedBy).select("email name");
    if (creatorUser) {
      sendNotificationEmail({
        to: creatorUser.email,
        name: creatorUser.name,
        title: `Proof Uploaded: ${task.title}`,
        message: `${req.user.name} (${req.user.rollNumber || "Student"}) uploaded proof for "${task.title}". Check your Assignments tab to verify.`,
        category: "Proof Uploaded",
        link: "http://localhost:5173/app/tasks",
      }).catch(() => {});
    }

    res.json({ submission });
  } catch (err) {
    res.status(500).json({ message: "Could not upload proof", error: err.message });
  }
};

exports.deleteProof = async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.submissionId).populate("task", "assignedBy proofRequired");
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    const isStudent = String(submission.student) === String(req.user._id);
    const isAssigner = String(submission.task.assignedBy) === String(req.user._id);
    if (!isStudent && !isAssigner) return res.status(403).json({ message: "You cannot delete this proof" });

    await removeProofFile(submission.proofUrl);
    submission.proofUrl = null;
    submission.proofFileName = null;
    if (submission.task.proofRequired && submission.status === "completed") {
      submission.status = "pending";
      submission.completedAt = null;
      submission.verified = false;
      submission.verifiedBy = null;
    }
    await submission.save();
    res.json({ submission });
  } catch (err) {
    res.status(500).json({ message: "Could not delete proof", error: err.message });
  }
};

exports.deleteStudentSubmission = async (req, res) => {
  try {
    const submission = await TaskSubmission.findOne({ _id: req.params.submissionId, student: req.user._id });
    if (!submission) return res.status(404).json({ message: "Assignment submission not found" });
    if (!submission.verified) {
      return res.status(400).json({ message: "Only reviewed assignments can be deleted from your list" });
    }

    submission.dismissedByStudent = true;
    await submission.save();

    res.json({ message: "Assignment removed from your assignments list" });
  } catch (err) {
    res.status(500).json({ message: "Could not remove assignment", error: err.message });
  }
};

// Tasks a faculty/coordinator/hod has assigned, with completion stats
exports.tasksAssignedByMe = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedBy: req.user._id }).sort({ createdAt: -1 }).lean();
    const taskIds = tasks.map((t) => t._id);
    const submissions = await TaskSubmission.find({ task: { $in: taskIds } }).populate(
      "student",
      "name rollNumber section"
    );
    const byTask = {};
    for (const s of submissions) {
      byTask[s.task] = byTask[s.task] || [];
      byTask[s.task].push(s);
    }

    const result = tasks.map((t) => {
      const subs = byTask[t._id] || [];
      return {
        ...t,
        submissions: subs,
        completedCount: subs.filter((s) => s.status === "completed" || s.verified).length,
        totalCount: subs.length,
      };
    });
    res.json({ tasks: result });
  } catch (err) {
    res.status(500).json({ message: "Could not load tasks", error: err.message });
  }
};

exports.taskDetails = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, assignedBy: req.user._id }).lean();
    if (!task) return res.status(404).json({ message: "Assignment not found" });
    const submissions = await TaskSubmission.find({ task: task._id })
      .populate("student", "name rollNumber section email")
      .sort({ status: 1 });
    const counts = {
      reviewed: submissions.filter((submission) => submission.verified).length,
      pending: submissions.filter((submission) => submission.status === "pending" && !submission.verified).length,
      pendingReview: submissions.filter((submission) => submission.status === "completed" && !submission.verified).length,
      rejected: submissions.filter((submission) => submission.status === "rejected" && !submission.verified).length,
      total: submissions.length,
    };
    res.json({ task, submissions, counts });
  } catch (err) {
    res.status(500).json({ message: "Could not load assignment details", error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, assignedBy: req.user._id });
    if (!task) return res.status(404).json({ message: "Task not found" });
    const submissions = await TaskSubmission.find({ task: task._id }).select("proofUrl");
    await Promise.all(submissions.map((submission) => removeProofFile(submission.proofUrl)));
    await TaskSubmission.deleteMany({ task: task._id });
    await task.deleteOne();
    res.json({ message: "Task and associated submissions removed" });
  } catch (err) {
    res.status(500).json({ message: "Could not delete task", error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Assignment not found" });

    const isCreator = String(task.assignedBy) === String(req.user._id);
    const isPrivileged = ["hod", "operator"].includes(req.user.role);
    if (!isCreator && !isPrivileged) {
      return res.status(403).json({ message: "Only the creator or department head can edit this assignment" });
    }

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ message: "A title is required" });
      task.title = title;
    }

    if (req.body.description !== undefined) {
      task.description = String(req.body.description).trim();
    }

    if (req.body.proofRequired !== undefined) {
      task.proofRequired = req.body.proofRequired === true || String(req.body.proofRequired).toLowerCase() === "true";
    }

    if (req.body.dueDate !== undefined) {
      if (!req.body.dueDate) {
        task.dueDate = null;
      } else {
        task.dueDate = parseDueDate(req.body.dueDate);
      }
    }

    // Additional roll numbers handling (adding missed students)
    let newlyAssignedCount = 0;
    let extraRolls = [];
    if (req.body.rollNumbers) {
      if (typeof req.body.rollNumbers === "string") {
        if (req.body.rollNumbers.trim().startsWith("[")) {
          try {
            extraRolls = JSON.parse(req.body.rollNumbers);
          } catch {
            extraRolls = req.body.rollNumbers.split(",").map((r) => r.trim()).filter(Boolean);
          }
        } else {
          extraRolls = req.body.rollNumbers.split(",").map((r) => r.trim()).filter(Boolean);
        }
      } else if (Array.isArray(req.body.rollNumbers)) {
        extraRolls = req.body.rollNumbers;
      }
    }

    const uploadedRollNumbers = await readRollNumbers(req.file);
    const combinedExtraRolls = [
      ...new Set([...extraRolls, ...uploadedRollNumbers].map((r) => String(r).trim().toUpperCase()).filter(Boolean)),
    ];

    if (combinedExtraRolls.length > 0) {
      const regexRolls = combinedExtraRolls.map((r) => new RegExp(`^${r}$`, "i"));
      const targetStudents = await User.find({
        role: "student",
        isActive: true,
        rollNumber: { $in: regexRolls },
      }).select("_id email name rollNumber branch year section");

      if (targetStudents.length > 0) {
        const existingSubs = await TaskSubmission.find({ task: task._id }).select("student");
        const existingStudentIds = new Set(existingSubs.map((s) => String(s.student)));

        const newStudents = targetStudents.filter((s) => !existingStudentIds.has(String(s._id)));

        if (newStudents.length > 0) {
          const subsToInsert = newStudents.map((s) => ({ task: task._id, student: s._id }));
          await TaskSubmission.insertMany(subsToInsert, { ordered: false }).catch(() => {});
          newlyAssignedCount = newStudents.length;

          // Merge into task.rollNumbers if task was created with specific rollNumbers
          if (task.rollNumbers && task.rollNumbers.length > 0) {
            const existingRolls = new Set(task.rollNumbers.map((r) => String(r).toUpperCase()));
            for (const s of newStudents) {
              if (s.rollNumber) existingRolls.add(String(s.rollNumber).toUpperCase());
            }
            task.rollNumbers = [...existingRolls];
          }

          const { sendNotificationEmail } = require("../utils/mailer");
          for (const s of newStudents) {
            req.io?.to(`user:${s._id}`).emit("task:new", { taskId: String(task._id) });
            sendNotificationEmail({
              to: s.email,
              name: s.name,
              title: `Assignment Assigned: ${task.title}`,
              message: `You have been added to "${task.title}". Due date: ${
                task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No deadline"
              }. Check your Tasks tab in Univo.`,
              category: "Assignment / Task",
              link: "http://localhost:5173/app/tasks",
            }).catch(() => {});
          }
        }
      }
    }

    await task.save();

    // Broadcast update to all students and faculty assigned to this task
    const allSubs = await TaskSubmission.find({ task: task._id }).select("student");
    for (const sub of allSubs) {
      req.io?.to(`user:${sub.student}`).emit("task:status", { taskId: String(task._id) });
    }
    req.io?.to(`user:${task.assignedBy}`).emit("task:status", { taskId: String(task._id) });
    req.io?.to(`user:${task.assignedBy}`).emit("task:submission", { taskId: String(task._id) });
    req.io?.to(`user:${task.assignedBy}`).emit("unread:refresh");

    res.json({
      task,
      message: "Assignment updated successfully",
      newlyAssignedCount,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Could not update assignment" });
  }
};

exports.verifySubmission = async (req, res) => {
  try {
    if (!["faculty", "hod", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not permitted" });
    }
    const submission = await TaskSubmission.findById(req.params.submissionId).populate("task", "assignedBy title");
    if (!submission || String(submission.task.assignedBy) !== String(req.user._id)) {
      return res.status(404).json({ message: "Assignment submission not found" });
    }
    submission.status = "completed";
    submission.verified = true;
    submission.verifiedBy = req.user._id;
    submission.rejectionReason = "";
    submission.statusReadAt = null; // Unread for student so they see the approval
    await submission.save();

    const { sendNotificationEmail } = require("../utils/mailer");
    const studentUser = await User.findById(submission.student).select("email name");
    if (studentUser) {
      sendNotificationEmail({
        to: studentUser.email,
        name: studentUser.name,
        title: `Assignment Approved: ${submission.task.title}`,
        message: `Your submitted proof for "${submission.task.title}" has been reviewed and approved by ${req.user.name}.`,
        category: "Assignment Verified",
        link: "http://localhost:5173/app/tasks",
      }).catch(() => {});
    }

    req.io?.to(`user:${submission.student}`).emit("task:status", { taskId: String(submission.task._id), status: "verified" });
    req.io?.to(`user:${submission.student}`).emit("unread:refresh");
    req.io?.to(`user:${req.user._id}`).emit("task:submission", { taskId: String(submission.task._id) });
    req.io?.to(`user:${req.user._id}`).emit("task:status", { taskId: String(submission.task._id), status: "verified" });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ submission });
  } catch (err) {
    res.status(500).json({ message: "Could not verify submission", error: err.message });
  }
};

exports.rejectSubmission = async (req, res) => {
  try {
    if (!["faculty", "hod", "operator"].includes(req.user.role)) return res.status(403).json({ message: "Not permitted" });
    const submission = await TaskSubmission.findById(req.params.submissionId).populate("task", "assignedBy title");
    if (!submission || String(submission.task.assignedBy) !== String(req.user._id)) {
      return res.status(404).json({ message: "Assignment submission not found" });
    }
    if (submission.status !== "completed") return res.status(400).json({ message: "Only submitted assignments can be rejected" });
    submission.status = "rejected";
    submission.verified = false;
    submission.verifiedBy = null;
    submission.rejectionReason = String(req.body.reason || "").trim().slice(0, 1000);
    submission.statusReadAt = null;
    await submission.save();

    const { sendNotificationEmail } = require("../utils/mailer");
    const studentUser = await User.findById(submission.student).select("email name");
    if (studentUser) {
      sendNotificationEmail({
        to: studentUser.email,
        name: studentUser.name,
        title: `Assignment Revision Needed: ${submission.task.title}`,
        message: `Your submission for "${submission.task.title}" was rejected by ${req.user.name}. Reason: ${submission.rejectionReason || "Please review requirements and re-upload"}.`,
        category: "Assignment Rejected",
        link: "http://localhost:5173/app/tasks",
      }).catch(() => {});
    }

    req.io?.to(`user:${submission.student}`).emit("task:status", { taskId: String(submission.task._id), status: "rejected" });
    req.io?.to(`user:${submission.student}`).emit("unread:refresh");
    req.io?.to(`user:${req.user._id}`).emit("task:submission", { taskId: String(submission.task._id) });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");
    res.json({ submission });
  } catch (err) {
    res.status(500).json({ message: "Could not reject assignment", error: err.message });
  }
};

exports.exportTaskSubmissionsExcel = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, assignedBy: req.user._id }).lean();
    if (!task) return res.status(404).json({ message: "Assignment not found" });

    const submissions = await TaskSubmission.find({ task: task._id })
      .populate("student", "name rollNumber section email")
      .sort({ "student.rollNumber": 1, "student.name": 1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Univo Academic Platform";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Submissions");

    // Title row
    sheet.mergeCells("A1:E1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `${task.title} - Submissions Summary`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 36;

    // Metadata row
    sheet.mergeCells("A2:E2");
    const metaCell = sheet.getCell("A2");
    metaCell.value = `Year: ${task.year} | Section: ${task.section || "All"} | Due Date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "None"} | Proof: ${task.proofRequired ? "Required" : "Optional"}`;
    metaCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF334155" } };
    metaCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(2).height = 24;

    // Blank row 3
    sheet.getRow(3).height = 10;

    // Header row 4
    sheet.columns = [
      { key: "name", width: 28 },
      { key: "rollno", width: 20 },
      { key: "section", width: 14 },
      { key: "status", width: 22 },
      { key: "submittedAt", width: 20 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.values = ["Name", "Roll No", "Section", "Status", "Submitted Date"];
    headerRow.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    submissions.forEach((sub, idx) => {
      let statusStr = "Pending";
      if (sub.verified) {
        statusStr = "Reviewed";
      } else if (sub.status === "completed") {
        statusStr = "Submitted";
      } else if (sub.status === "rejected") {
        statusStr = "Rejected";
      } else {
        statusStr = "Pending";
      }

      const submittedDateStr = sub.completedAt
        ? new Date(sub.completedAt).toLocaleDateString()
        : "-";

      const row = sheet.addRow([
        sub.student?.name || "Unknown",
        sub.student?.rollNumber || "-",
        sub.student?.section || "-",
        statusStr,
        submittedDateStr,
      ]);

      row.height = 22;
      row.alignment = { vertical: "middle" };
      row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(4).alignment = { vertical: "middle", horizontal: "center" };
      row.getCell(5).alignment = { vertical: "middle", horizontal: "center" };

      const statusCell = row.getCell(4);
      if (statusStr === "Reviewed") {
        statusCell.font = { bold: true, color: { argb: "FF059669" } };
      } else if (statusStr === "Submitted") {
        statusCell.font = { bold: true, color: { argb: "FF2563EB" } };
      } else if (statusStr === "Rejected") {
        statusCell.font = { bold: true, color: { argb: "FFE11D48" } };
      } else {
        statusCell.font = { color: { argb: "FFD97706" } };
      }

      if (idx % 2 === 1) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });

    const safeFilename = `${task.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Submissions.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: "Could not export submissions to Excel", error: err.message });
  }
};

exports.batchVerifySubmissions = async (req, res) => {
  try {
    if (!["faculty", "hod", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not permitted" });
    }
    const { submissionIds } = req.body;
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ message: "No submissions selected" });
    }

    const submissions = await TaskSubmission.find({ _id: { $in: submissionIds } }).populate("task", "assignedBy title");
    const validSubmissions = submissions.filter(
      (sub) => sub.task && String(sub.task.assignedBy) === String(req.user._id)
    );

    if (validSubmissions.length === 0) {
      return res.status(404).json({ message: "No valid submissions found to review" });
    }

    for (const sub of validSubmissions) {
      sub.status = "completed";
      sub.verified = true;
      sub.verifiedBy = req.user._id;
      sub.rejectionReason = "";
      sub.statusReadAt = null;
      await sub.save();

      req.io?.to(`user:${sub.student}`).emit("task:status", { taskId: String(sub.task._id), status: "verified" });
      req.io?.to(`user:${sub.student}`).emit("unread:refresh");
    }

    req.io?.to(`user:${req.user._id}`).emit("task:submission", { taskId: String(validSubmissions[0].task._id) });
    req.io?.to(`user:${req.user._id}`).emit("task:status", { taskId: String(validSubmissions[0].task._id), status: "verified" });
    req.io?.to(`user:${req.user._id}`).emit("unread:refresh");

    res.json({
      message: `Successfully reviewed ${validSubmissions.length} student submission(s).`,
      count: validSubmissions.length,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not review submissions", error: err.message });
  }
};
