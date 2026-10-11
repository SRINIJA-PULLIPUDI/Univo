const SubjectAssignment = require("../models/SubjectAssignment");

async function canAccessSubject(user, subject) {
  if (!user || !subject) return false;
  if (user.role === "student") {
    return !user.isAlumni
      && String(subject.branch) === String(user.branch)
      && subject.year === user.year
      && subject.semester === user.semester;
  }
  if (["faculty", "hod"].includes(user.role)) {
    return SubjectAssignment.exists({ subject: subject._id, faculty: user._id });
  }
  return false;
}

module.exports = canAccessSubject;
