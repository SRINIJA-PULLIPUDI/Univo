const User = require("../models/User");
const Branch = require("../models/Branch");
const ExcelJS = require("exceljs");

const academicFields = {
  cgpa: { aliases: ["cgpa", "currentcgpa"], validate: (value) => Number.isFinite(value) && value >= 0 && value <= 10 },
  creditsEarned: { aliases: ["creditsearned", "credits"], validate: (value) => Number.isInteger(value) && value >= 0 },
  backlogs: { aliases: ["backlogs", "backlog"], validate: (value) => Number.isInteger(value) && value >= 0 },
  totalAttendance: { aliases: ["totalattendance", "attendance", "attendancepercentage"], validate: (value) => Number.isFinite(value) && value >= 0 && value <= 100 },
};

function academicValue(value, field) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return field.validate(number) ? number : undefined;
}

exports.createUser = async (req, res) => {
  try {
    const body = req.body;
    if (req.user.role === "admin") {
      if (!["hod", "operator"].includes(body.role)) return res.status(403).json({ message: "Admins can create HOD and Operator accounts here" });
      if (!body.branch) return res.status(400).json({ message: `Choose a branch for the ${body.role}` });
    } else if (req.user.role === "hod") {
      if (!["operator", "faculty", "student", "coordinator"].includes(body.role)) {
        return res.status(403).json({ message: "HODs can create operators, faculty, students, and coordinators" });
      }
      body.branch = String(req.user.branch); // force own branch
    } else if (req.user.role === "operator") {
      if (body.role !== "student") return res.status(403).json({ message: "Operators can create students in their branch" });
      body.branch = String(req.user.branch);
    } else {
      return res.status(403).json({ message: "You don't have permission to create users" });
    }

    if (["student", "coordinator"].includes(body.role)) {
      const branch = await Branch.findById(body.branch);
      if (!branch) return res.status(400).json({ message: "Choose a valid branch" });
      body.semester = Number(body.semester || 1);
      if (body.semester < 1 || body.semester > 8) return res.status(400).json({ message: "Semester must be between 1 and 8" });
      body.year = Math.ceil(body.semester / 2);
      const now = new Date();
      body.yearStartedAt = now;
      body.semesterStartedAt = now;
      body.section = String(body.section || branch.sectionsByYear?.[body.year]?.[0] || "A").trim().toUpperCase();
      for (const field of Object.keys(academicFields)) {
        const value = academicValue(body[field], academicFields[field]);
        if (value === undefined) return res.status(400).json({ message: `Invalid ${field} value` });
        body[field] = value;
      }
      if (!(branch.sectionsByYear?.[body.year] || []).includes(body.section)) {
        return res.status(400).json({ message: `Choose a section configured for year ${body.year}` });
      }
    }

    if (body.role === "hod" || body.role === "operator") {
      const branch = await Branch.findById(body.branch).select(body.role);
      if (!branch) return res.status(400).json({ message: "Choose a valid branch" });
      if (branch[body.role]) return res.status(409).json({ message: `This branch already has an assigned ${body.role}` });
    }

    body.isFirstLogin = true;
    const user = await User.create(body);

    if (body.role === "hod" && body.branch) {
      await Branch.findByIdAndUpdate(body.branch, { hod: user._id });
    }
    if (body.role === "operator" && body.branch) {
      await Branch.findByIdAndUpdate(body.branch, { operator: user._id });
    }

    res.status(201).json({ user: user.publicProfile() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A user with that email already exists" });
    }
    res.status(500).json({ message: "Could not create user", error: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const filter = {};
    const { role, branch, year, semester, section, search, alumni } = req.query;

    if (["hod", "operator"].includes(req.user.role)) filter.branch = req.user.branch;
    if (req.user.role === "admin") {
      if (branch) filter.branch = branch;
      if (role) filter.role = role;
    } else if (req.user.role === "operator") {
      filter.role = "student";
    } else if (role) {
      filter.role = role;
    }
    if (year) filter.year = Number(year);
    if (semester) filter.semester = Number(semester);
    if (section) filter.section = section;
    if (alumni === "true") filter.isAlumni = true;
    else if (alumni === "false") filter.isAlumni = { $ne: true };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { rollNumber: { $regex: escaped, $options: "i" } },
      ];
    }

    const users = await User.find(filter).populate("branch").sort({ name: 1 });
    res.json({ users: users.map((u) => u.publicProfile()) });
  } catch (err) {
    res.status(500).json({ message: "Could not list users", error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (["hod", "operator"].includes(req.user.role) && String(target.branch) !== String(req.user.branch)) {
      return res.status(403).json({ message: "You can only edit users in your own branch" });
    }
    if (!["admin", "operator", "hod"].includes(req.user.role) && String(req.user._id) !== req.params.id) {
      return res.status(403).json({ message: "You can only edit your own profile" });
    }
    const { password, role, ...safeFields } = req.body;
    if (role) return res.status(400).json({ message: "User roles cannot be changed here" });
    if (safeFields.bio !== undefined) {
      safeFields.bio = String(safeFields.bio).trim();
      if (safeFields.bio.length > 1000) return res.status(400).json({ message: "Bio cannot exceed 1000 characters" });
    }
    if (safeFields.skills !== undefined) {
      if (!Array.isArray(safeFields.skills) || safeFields.skills.length > 15) {
        return res.status(400).json({ message: "Skills must be a list of up to 15 items" });
      }
      safeFields.skills = safeFields.skills.map((skill) => String(skill).trim()).filter(Boolean);
      if (safeFields.skills.some((skill) => skill.length > 30)) {
        return res.status(400).json({ message: "Each skill must be 30 characters or fewer" });
      }
    }
    const hasAcademicFields = Object.keys(academicFields).some((field) => safeFields[field] !== undefined);
    if (hasAcademicFields && (!["hod", "operator"].includes(req.user.role) || target.role !== "student")) {
      return res.status(403).json({ message: "Only HODs and operators can update student academic records" });
    }
    for (const field of Object.keys(academicFields)) {
      if (safeFields[field] !== undefined) {
        const value = academicValue(safeFields[field], academicFields[field]);
        if (value === undefined) return res.status(400).json({ message: `Invalid ${field} value` });
        safeFields[field] = value;
      }
    }
    if (req.user.role !== "admin") delete safeFields.branch;
    delete safeFields.yearStartedAt;
    delete safeFields.semesterStartedAt;
    delete safeFields.isAlumni;
    delete safeFields.passedOutYear;
    if (req.user.role === "operator" && target.role !== "student") {
      return res.status(403).json({ message: "Operators can only update students in their branch" });
    }

    if (target.role === "student" && safeFields.semester !== undefined) {
      const previousYear = target.year;
      safeFields.semester = Number(safeFields.semester);
      if (safeFields.semester < 1 || safeFields.semester > 8) return res.status(400).json({ message: "Semester must be between 1 and 8" });
      safeFields.year = Math.ceil(safeFields.semester / 2);
      if (safeFields.semester !== target.semester) safeFields.semesterStartedAt = new Date();
      if (safeFields.year !== previousYear) safeFields.yearStartedAt = new Date();
    }
    if (target.role === "student" && safeFields.section !== undefined) {
      const branch = await Branch.findById(target.branch);
      const year = safeFields.year || target.year;
      safeFields.section = String(safeFields.section).trim().toUpperCase();
      if (!(branch.sectionsByYear?.[year] || []).includes(safeFields.section)) {
        return res.status(400).json({ message: `Choose a section configured for year ${year}` });
      }
    }

    Object.assign(target, safeFields);
    await target.save();
    res.json({ user: target.publicProfile() });
  } catch (err) {
    res.status(500).json({ message: "Could not update user", error: err.message });
  }
};

exports.bulkUpdateStudentAcademics = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose an .xlsx academic data workbook" });
    if (!/\.xlsx$/i.test(req.file.originalname)) return res.status(400).json({ message: "Upload an .xlsx workbook" });
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      return res.status(400).json({ message: "The uploaded workbook could not be read" });
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) return res.status(400).json({ message: "The workbook has no student rows" });
    const headers = sheet.getRow(1).values.map((value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
    const findColumn = (names) => headers.findIndex((header) => names.includes(header));
    const rollColumn = findColumn(["rollnumber", "rollno", "roll"]);
    const columns = Object.fromEntries(Object.entries(academicFields).map(([field, config]) => [field, findColumn(config.aliases)]));
    const adjustmentColumn = findColumn(["backlogsadjustment", "backlogadjustment"]);
    if (rollColumn < 1) return res.status(400).json({ message: "Workbook headers must include Roll Number" });
    if (Object.values(columns).every((column) => column < 1) && adjustmentColumn < 1) {
      return res.status(400).json({ message: "Include at least one academic field: CGPA, Credits Earned, Backlogs, Total Attendance, or Backlogs Adjustment" });
    }

    const invalidRows = [];
    let updated = 0;
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const rollNumber = row.getCell(rollColumn).text.trim();
      const updates = {};
      if (!rollNumber) {
        if (row.values.some((value) => String(value || "").trim())) invalidRows.push(rowNumber);
        continue;
      }
      let invalid = false;
      for (const [field, column] of Object.entries(columns)) {
        if (column < 1) continue;
        const cell = row.getCell(column);
        if (!cell.text.trim()) continue;
        const value = academicValue(cell.value, academicFields[field]);
        if (value === undefined) invalid = true;
        else updates[field] = value;
      }
      if (adjustmentColumn > 0 && row.getCell(adjustmentColumn).text.trim()) {
        const adjustment = Number(row.getCell(adjustmentColumn).value);
        if (!Number.isInteger(adjustment)) invalid = true;
        else updates.backlogsAdjustment = adjustment;
      }
      if (invalid || Object.keys(updates).length === 0) {
        invalidRows.push(rowNumber);
        continue;
      }
      const student = await User.findOne({ role: "student", branch: req.user.branch, rollNumber });
      if (!student) {
        invalidRows.push(rowNumber);
        continue;
      }
      if (updates.backlogsAdjustment !== undefined) {
        const currentBacklogs = student.backlogs ?? 0;
        const nextBacklogs = currentBacklogs + updates.backlogsAdjustment;
        if (nextBacklogs < 0) {
          invalidRows.push(rowNumber);
          continue;
        }
        student.backlogs = nextBacklogs;
      }
      for (const [field, value] of Object.entries(updates)) {
        if (field !== "backlogsAdjustment") student[field] = value;
      }
      await student.save();
      updated += 1;
    }
    res.json({ updated, invalidRows });
  } catch (err) {
    res.status(500).json({ message: "Could not update student academic records", error: err.message });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (["hod", "operator"].includes(req.user.role) && String(target.branch) !== String(req.user.branch)) {
      return res.status(403).json({ message: "You can only manage users in your own branch" });
    }
    if (req.user.role === "operator" && target.role !== "student") {
      return res.status(403).json({ message: "Operators can only manage students" });
    }
    target.isActive = false;
    await target.save();
    res.json({ message: "User deactivated" });
  } catch (err) {
    res.status(500).json({ message: "Could not deactivate user", error: err.message });
  }
};

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose an .xlsx student workbook" });
    if (!/\.xlsx$/i.test(req.file.originalname)) return res.status(400).json({ message: "Upload an .xlsx workbook" });
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      return res.status(400).json({ message: "The uploaded workbook could not be read" });
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) return res.status(400).json({ message: "The workbook has no student rows" });
    const header = sheet.getRow(1).values.map((value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
    const column = (names) => header.findIndex((value) => names.includes(value));
    const columns = {
      name: column(["name", "fullname", "studentname"]),
      email: column(["email", "emailaddress"]),
      rollNumber: column(["rollnumber", "rollno", "roll"]),
      section: column(["section", "sec"]),
      semester: column(["semester", "sem"]),
      year: column(["year", "academicyear"]),
      password: column(["password", "temppassword"]),
      cgpa: column(academicFields.cgpa.aliases),
      creditsEarned: column(academicFields.creditsEarned.aliases),
      backlogs: column(academicFields.backlogs.aliases),
      totalAttendance: column(academicFields.totalAttendance.aliases),
    };
    if (columns.name < 1 || columns.email < 1 || columns.rollNumber < 1) {
      return res.status(400).json({ message: "Workbook headers must include Name, Email, and Roll Number" });
    }

    const branch = await Branch.findById(req.user.branch);
    if (!branch) return res.status(400).json({ message: "Your account is not assigned to a branch" });

    const created = [];
    const skipped = [];
    const rowErrors = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const name = row.getCell(columns.name).text.trim();
      const email = row.getCell(columns.email).text.trim().toLowerCase();
      const rollNumber = row.getCell(columns.rollNumber).text.trim();
      if (!name && !email && !rollNumber) continue;
      if (!name || !email || !rollNumber) {
        rowErrors.push(rowNumber);
        continue;
      }
      const semesterText = (columns.semester > 0 ? row.getCell(columns.semester).text.trim() : "") || String(req.body.semester || "");
      const yearText = columns.year > 0 ? row.getCell(columns.year).text.trim() : "1";
      const semester = semesterText ? Number(semesterText) : Math.max(1, (Number(yearText) - 1) * 2 + 1);
      if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
        rowErrors.push(rowNumber);
        continue;
      }
      const year = Math.ceil(semester / 2);
      const allowedSections = branch.sectionsByYear?.[year] || [];
      const workbookSection = columns.section > 0 ? row.getCell(columns.section).text.trim().toUpperCase() : "";
      const section = workbookSection || String(req.body.section || allowedSections[0] || "A").trim().toUpperCase();
      if (!allowedSections.includes(section)) {
        rowErrors.push(rowNumber);
        continue;
      }
      const user = {
        name,
        email,
        rollNumber,
        section,
        semester,
        year,
        branch: branch._id,
        role: "student",
        yearStartedAt: new Date(),
        semesterStartedAt: new Date(),
        password: columns.password > 0 && row.getCell(columns.password).text.trim() || "Univo@123",
      };
      let invalidAcademicValue = false;
      for (const field of Object.keys(academicFields)) {
        if (columns[field] < 1 || !row.getCell(columns[field]).text.trim()) continue;
        const value = academicValue(row.getCell(columns[field]).value, academicFields[field]);
        if (value === undefined) invalidAcademicValue = true;
        else user[field] = value;
      }
      if (invalidAcademicValue) {
        rowErrors.push(rowNumber);
        continue;
      }
      try {
        await User.create(user);
        created.push(email);
      } catch (err) {
        if (err.code === 11000) skipped.push(email);
        else rowErrors.push(rowNumber);
      }
    }
    res.status(201).json({ created: created.length, skipped, invalidRows: rowErrors });
  } catch (err) {
    res.status(500).json({ message: "Could not import students", error: err.message });
  }
};

exports.importFaculty = async (req, res) => {
  try {
    if (req.user.role !== "hod") return res.status(403).json({ message: "Only HODs can import faculty" });
    if (!req.file) return res.status(400).json({ message: "Choose an .xlsx faculty workbook" });
    if (!/\.xlsx$/i.test(req.file.originalname)) return res.status(400).json({ message: "Upload an .xlsx workbook" });
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      return res.status(400).json({ message: "The uploaded workbook could not be read" });
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) return res.status(400).json({ message: "The workbook has no faculty rows" });
    const header = sheet.getRow(1).values.map((value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
    const column = (names) => header.findIndex((value) => names.includes(value));
    const columns = {
      name: column(["name", "fullname", "facultyname"]),
      email: column(["email", "emailaddress"]),
      designation: column(["designation", "title"]),
      password: column(["password", "temppassword"]),
    };
    if (columns.name < 1 || columns.email < 1) {
      return res.status(400).json({ message: "Workbook headers must include Name and Email" });
    }

    const created = [];
    const skipped = [];
    const invalidRows = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const name = row.getCell(columns.name).text.trim();
      const email = row.getCell(columns.email).text.trim().toLowerCase();
      if (!name && !email) continue;
      if (!name || !email) {
        invalidRows.push(rowNumber);
        continue;
      }
      try {
        await User.create({
          name,
          email,
          role: "faculty",
          branch: req.user.branch,
          designation: columns.designation > 0 ? row.getCell(columns.designation).text.trim() : "",
          password: columns.password > 0 && row.getCell(columns.password).text.trim() || "Univo@123",
        });
        created.push(email);
      } catch (err) {
        if (err.code === 11000) skipped.push(email);
        else invalidRows.push(rowNumber);
      }
    }
    res.status(201).json({ created: created.length, skipped, invalidRows });
  } catch (err) {
    res.status(500).json({ message: "Could not import faculty", error: err.message });
  }
};

exports.advanceSemester = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.userIds) ? req.body.userIds : [];
    const semester = Number(req.body.semester);
    if (!ids.length && (!Number.isInteger(semester) || semester < 1 || semester > 8)) {
      return res.status(400).json({ message: "Select students or choose a semester to advance" });
    }
    const filter = { role: "student", isActive: true, isAlumni: { $ne: true } };
    if (ids.length) filter._id = { $in: ids };
    else filter.semester = semester;
    if (["hod", "operator"].includes(req.user.role)) filter.branch = req.user.branch;
    const students = await User.find(filter);
    for (const student of students) {
      if (student.semester >= 8) {
        student.isAlumni = true;
        student.passedOutYear = new Date().getFullYear();
      } else {
        const previousYear = student.year;
        student.semester += 1;
        student.year = Math.ceil(student.semester / 2);
        student.semesterStartedAt = new Date();
        if (student.year !== previousYear) student.yearStartedAt = student.semesterStartedAt;
      }
      await student.save();
    }
    res.json({ advanced: students.length, graduated: students.filter((student) => student.isAlumni).length });
  } catch (err) {
    res.status(500).json({ message: "Could not advance students", error: err.message });
  }
};

// All active faculty + HODs across every branch. Used by Subject Management so an
// HOD can assign someone from another department to teach one of their subjects.
exports.facultyPool = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ["faculty", "hod"] }, isActive: true })
      .populate("branch", "code name")
      .sort({ name: 1 });
    res.json({ users: users.map((u) => ({ ...u.publicProfile(), branch: u.branch })) });
  } catch (err) {
    res.status(500).json({ message: "Could not load faculty", error: err.message });
  }
};

const { fetchSandyAttendance } = require("../utils/sandyAttendance");

exports.syncSandyAttendance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("branch");
    if (!user) return res.status(404).json({ message: "User not found" });

    const rollNumber = req.body.rollNumber || user.rollNumber || "23MH1A05O3";
    const password = req.body.password || "Sri12@acoe";
    const campus = req.body.campus || "ACET";

    const data = await fetchSandyAttendance({ rollNumber, password, campus });

    const overallPer = data.attendance?.overall?.overall?.per;
    const cgpa = data.cgpa ? parseFloat(data.cgpa) : user.cgpa;

    if (overallPer !== undefined && overallPer !== null) {
      user.totalAttendance = Math.round(overallPer);
    }
    if (cgpa) {
      user.cgpa = cgpa;
    }
    user.rollNumber = rollNumber;
    user.sandyAttendanceData = {
      ...data,
      syncedAt: new Date(),
      campus,
      rollNumber,
    };

    await user.save();
    res.json({
      message: "Attendance synchronized successfully from Sandy Portal!",
      user: user.publicProfile(),
      attendance: user.sandyAttendanceData,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to sync attendance with Sandy portal" });
  }
};

