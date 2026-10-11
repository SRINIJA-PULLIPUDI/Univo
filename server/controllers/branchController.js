const Branch = require("../models/Branch");
const User = require("../models/User");

exports.listBranches = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { _id: req.user.branch };
  const branches = await Branch.find(filter)
    .populate("hod", "name email designation")
    .populate("operator", "name email");
  res.json({ branches });
};

exports.createBranch = async (req, res) => {
  try {
    const sectionsByYear = normalizeSections(req.body.sectionsByYear || {});
    if (sectionsByYear.error) return res.status(400).json({ message: sectionsByYear.error });
    const branch = await Branch.create({
      name: req.body.name,
      code: req.body.code,
      sectionsByYear: sectionsByYear.value,
    });
    res.status(201).json({ branch });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Branch code already exists" });
    res.status(500).json({ message: "Could not create branch", error: err.message });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const current = await Branch.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Branch not found" });
    if (req.user.role === "operator" && String(current._id) !== String(req.user.branch)) {
      return res.status(403).json({ message: "You can only update sections in your own branch" });
    }
    if (!(["admin", "operator"].includes(req.user.role))) {
      return res.status(403).json({ message: "You cannot update this branch" });
    }

    const update = req.user.role === "admin"
      ? { name: req.body.name, code: req.body.code, hod: req.body.hod || null, operator: req.body.operator || null }
      : {};
    const sectionsByYear = normalizeSections(req.body.sectionsByYear);
    if (sectionsByYear.error) return res.status(400).json({ message: sectionsByYear.error });
    if (sectionsByYear.value) {
      const orphaned = [];
      for (let year = 1; year <= 4; year += 1) {
        const removedSections = (current.sectionsByYear?.[year] || []).filter((section) => !sectionsByYear.value[year].includes(section));
        if (!removedSections.length) continue;
        const count = await User.countDocuments({
          branch: current._id, role: "student", year, section: { $in: removedSections }, isActive: true, isAlumni: { $ne: true },
        });
        if (count) orphaned.push(`Year ${year}: ${removedSections.join(", ")}`);
      }
      if (orphaned.length) return res.status(409).json({ message: `Move active students out of these sections first: ${orphaned.join("; ")}` });
      update.sectionsByYear = sectionsByYear.value;
    }
    if (req.user.role === "admin") {
      for (const field of ["hod", "operator"]) {
        if (!update[field]) continue;
        const assignedUser = await User.findById(update[field]).select("role branch");
        const assignedBranch = assignedUser?.branch ? String(assignedUser.branch) : "";
        if (!assignedUser || assignedUser.role !== field || (assignedBranch && assignedBranch !== String(current._id))) {
          return res.status(400).json({ message: `Choose an unassigned ${field} or one already in this branch` });
        }
      }
    }
    if (req.user.role === "admin") {
      for (const field of ["hod", "operator"]) {
        const previousId = current[field] ? String(current[field]) : "";
        const nextId = update[field] ? String(update[field]) : "";
        if (previousId && previousId !== nextId) {
          await User.updateOne({ _id: previousId, branch: current._id }, { $set: { branch: null } });
        }
        if (nextId) await User.updateOne({ _id: nextId }, { $set: { branch: current._id } });
      }
    }
    const branch = await Branch.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate("hod", "name email designation")
      .populate("operator", "name email");
    if (!branch) return res.status(404).json({ message: "Branch not found" });
    res.json({ branch });
  } catch (err) {
    res.status(500).json({ message: "Could not update branch", error: err.message });
  }
};

function normalizeSections(input) {
  if (!input) return { value: null };
  const sectionsByYear = {};
  for (let year = 1; year <= 4; year += 1) {
    const sections = input[year] || input[String(year)];
    if (!Array.isArray(sections) || !sections.length) return { error: `Add at least one section for year ${year}` };
    sectionsByYear[year] = [...new Set(sections.map((section) => String(section).trim().toUpperCase()).filter(Boolean))];
    if (!sectionsByYear[year].length) return { error: `Add at least one section for year ${year}` };
  }
  return { value: sectionsByYear };
}

exports.branchStats = async (req, res) => {
  try {
    if (!["admin", "operator", "hod"].includes(req.user.role)) {
      return res.status(403).json({ message: "You cannot view branch statistics" });
    }
    const targetId = req.params.id === "mine" ? req.user.branch : req.params.id;
    if (!targetId) {
      return res.status(400).json({ message: "Branch ID not specified" });
    }
    if (["operator", "hod"].includes(req.user.role) && String(req.user.branch) !== String(targetId)) {
      return res.status(403).json({ message: "You can only view your own branch" });
    }
    const branch = await Branch.findById(targetId);
    if (!branch) return res.status(404).json({ message: "Branch not found" });

    const [students, faculty] = await Promise.all([
      User.countDocuments({ branch: branch._id, role: "student", isActive: true, isAlumni: { $ne: true } }),
      User.countDocuments({ branch: branch._id, role: { $in: ["faculty", "hod"] }, isActive: true }),
    ]);

    const byYear = {};
    for (let y = 1; y <= 4; y++) {
      const dbCount = await User.countDocuments({ branch: branch._id, role: "student", year: y, isActive: true, isAlumni: { $ne: true } });
      const maleDb = await User.countDocuments({ branch: branch._id, role: "student", year: y, gender: "Male", isActive: true, isAlumni: { $ne: true } });
      const femaleDb = await User.countDocuments({ branch: branch._id, role: "student", year: y, gender: "Female", isActive: true, isAlumni: { $ne: true } });

      byYear[y] = { count: dbCount, male: maleDb, female: femaleDb };
    }

    res.json({ students, faculty, byYear });
  } catch (err) {
    res.status(500).json({ message: "Could not load branch stats", error: err.message });
  }
};

exports.adminOverview = async (req, res) => {
  try {
    const branches = await Branch.find().lean();
    const overview = await Promise.all(
      branches.map(async (b) => {
        const [facultyCount, studentCount, maleCount, femaleCount] = await Promise.all([
          User.countDocuments({ branch: b._id, role: { $in: ["faculty", "hod"] }, isActive: true }),
          User.countDocuments({ branch: b._id, role: "student", isActive: true, isAlumni: { $ne: true } }),
          User.countDocuments({ branch: b._id, role: "student", gender: "Male", isActive: true, isAlumni: { $ne: true } }),
          User.countDocuments({ branch: b._id, role: "student", gender: "Female", isActive: true, isAlumni: { $ne: true } }),
        ]);

        return {
          _id: b._id,
          name: b.name,
          code: b.code,
          facultyCount,
          studentCount,
          maleCount,
          femaleCount,
        };
      })
    );
    res.json({ branches: overview });
  } catch (err) {
    res.status(500).json({ message: "Could not load admin branch overview", error: err.message });
  }
};
