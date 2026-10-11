const Timetable = require("../models/Timetable");

exports.getTimetable = async (req, res) => {
  try {
    let { branch, year, section } = req.query;
    if (req.user.role === "student") {
      branch = req.user.branch;
      year = req.user.year;
      section = req.user.section;
    }
    const rows = await Timetable.find({ branch, year, section })
      .populate("subject", "name code")
      .populate("faculty", "name")
      .sort({ day: 1, period: 1 });
    res.json({ timetable: rows });
  } catch (err) {
    res.status(500).json({ message: "Could not load timetable", error: err.message });
  }
};

exports.upsertPeriod = async (req, res) => {
  try {
    if (!["hod", "coordinator", "operator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not permitted to edit the timetable" });
    }
    const { branch, year, section, day, period } = req.body;
    const row = await Timetable.findOneAndUpdate(
      { branch, year, section, day, period },
      req.body,
      { upsert: true, new: true }
    );
    res.json({ period: row });
  } catch (err) {
    res.status(500).json({ message: "Could not save timetable entry", error: err.message });
  }
};

exports.deletePeriod = async (req, res) => {
  await Timetable.findByIdAndDelete(req.params.id);
  res.json({ message: "Removed" });
};
