const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// A single collection holds every role. Which fields matter depends on `role`:
// - student: branch, year, section, rollNumber, semester (1-8)
// - faculty: branch (home department), designation, canTeachBranches (for cross-branch teaching)
// - hod: same as faculty, plus is set as Branch.hod for exactly one branch. An HOD
//   is still a faculty member and can appear as an assignment's faculty.
// - coordinator: a student (or staff) granted rights to post Buzz/Forum content
// - operator: support staff assigned to one branch
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["admin", "student", "faculty", "hod", "coordinator", "operator"],
      required: true,
    },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    year: { type: Number, min: 1, max: 4, default: null },
    section: { type: String, default: null }, // students
    rollNumber: { type: String, default: null, trim: true }, // students
    semester: { type: Number, min: 1, max: 8, default: null },
    cgpa: { type: Number, min: 0, max: 10, default: null },
    creditsEarned: { type: Number, min: 0, default: null },
    backlogs: { type: Number, min: 0, default: null },
    totalAttendance: { type: Number, min: 0, max: 100, default: null },
    isAlumni: { type: Boolean, default: false },
    passedOutYear: { type: Number, default: null },
    academicSchemaVersion: { type: Number, default: 2, select: false },
    gender: { type: String, enum: ["Male", "Female", "Other"], default: "Male" },
    designation: { type: String, default: null }, // faculty/hod, e.g. "Assistant Professor"
    avatar: { type: String, default: null },
    phone: { type: String, default: null },
    bio: { type: String, default: "", maxlength: 1000 },
    skills: { type: [String], default: [] },
    yearStartedAt: { type: Date, default: null },
    semesterStartedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isFirstLogin: { type: Boolean, default: true },
    resetOtp: { type: String, default: null, select: false },
    resetOtpExpires: { type: Date, default: null, select: false },
    sandyAttendanceData: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

userSchema.pre("validate", function (next) {
  if (["student", "coordinator"].includes(this.role) && this.semester) {
    this.year = Math.ceil(this.semester / 2);
  } else if (!["student", "coordinator"].includes(this.role)) {
    this.year = null;
    this.semester = null;
    this.section = null;
    this.rollNumber = null;
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.publicProfile = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    branch: this.branch,
    year: this.year,
    section: this.section,
    rollNumber: this.rollNumber,
    semester: this.semester,
    cgpa: this.cgpa,
    creditsEarned: this.creditsEarned,
    backlogs: this.backlogs,
    totalAttendance: this.totalAttendance,
    isAlumni: this.isAlumni,
    passedOutYear: this.passedOutYear,
    designation: this.designation,
    avatar: this.avatar,
    phone: this.phone,
    bio: this.bio,
    skills: this.skills,
    isFirstLogin: this.isFirstLogin === true,
    sandyAttendanceData: this.sandyAttendanceData || null,
  };
};

module.exports = mongoose.model("User", userSchema);
