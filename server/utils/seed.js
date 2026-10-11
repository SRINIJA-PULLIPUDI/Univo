// Populates a small but realistic dataset so the app is usable the moment
// it's started. Run with: npm run seed (inside server/)
require("dotenv").config();
const connectDB = require("../config/db");

const Branch = require("../models/Branch");
const User = require("../models/User");
const Subject = require("../models/Subject");
const SubjectAssignment = require("../models/SubjectAssignment");
const Buzz = require("../models/Buzz");
const ForumPost = require("../models/ForumPost");
const Timetable = require("../models/Timetable");
const { ensureGroupsExist } = require("../controllers/groupController");

const PASSWORD = "Univo@123"; // same password for every seeded account, for demo convenience

async function run() {
  await connectDB();
  console.log("Clearing existing data...");
  await Promise.all([
    Branch.deleteMany({}),
    User.deleteMany({}),
    Subject.deleteMany({}),
    SubjectAssignment.deleteMany({}),
    Buzz.deleteMany({}),
    ForumPost.deleteMany({}),
    Timetable.deleteMany({}),
    require("../models/Group").deleteMany({}),
  ]);

  console.log("Creating branches...");
  const cse = await Branch.create({ name: "Computer Science & Engineering", code: "CSE" });
  const ece = await Branch.create({ name: "Electronics & Communication Engineering", code: "ECE" });

  console.log("Creating admin, operator, HODs, faculty, and students...");
  const admin = await User.create({
    name: "Univo Admin", email: "admin@univo.edu", password: PASSWORD, role: "admin",
  });
  const operator = await User.create({
    name: "Ravi Kumar", email: "operator@univo.edu", password: PASSWORD, role: "operator", branch: cse._id,
  });
  cse.operator = operator._id; await cse.save();

  const hodCse = await User.create({
    name: "Dr. Michael Chen", email: "hod.cse@univo.edu", password: PASSWORD, role: "hod",
    branch: cse._id, designation: "Professor & HOD",
  });
  cse.hod = hodCse._id; await cse.save();

  const hodEce = await User.create({
    name: "Dr. Lisa Anderson", email: "hod.ece@univo.edu", password: PASSWORD, role: "hod",
    branch: ece._id, designation: "Professor & HOD",
  });
  ece.hod = hodEce._id; await ece.save();

  const facultyCse1 = await User.create({
    name: "Dr. Emily Watson", email: "emily.watson@univo.edu", password: PASSWORD, role: "faculty",
    branch: cse._id, designation: "Associate Professor",
  });
  const facultyCse2 = await User.create({
    name: "Prof. Arjun Mehta", email: "arjun.mehta@univo.edu", password: PASSWORD, role: "faculty",
    branch: cse._id, designation: "Assistant Professor",
  });
  // cross-branch teaching example: an ECE faculty member teaches a CSE subject
  const facultyEce1 = await User.create({
    name: "Dr. Priya Nair", email: "priya.nair@univo.edu", password: PASSWORD, role: "faculty",
    branch: ece._id, designation: "Associate Professor",
  });

  const coordinator = await User.create({
    name: "Vanita Reddy", email: "vanita.coordinator@univo.edu", password: PASSWORD, role: "coordinator",
    branch: cse._id, year: 3, section: "A", semester: 5,
  });

  const students = [];
  const names = ["Aditya Rao", "Sneha Iyer", "Rahul Verma", "Kavya Menon", "Vikram Singh", "Anjali Gupta"];
  for (let i = 0; i < names.length; i++) {
    const student = await User.create({
      name: names[i],
      email: `student${i + 1}@univo.edu`,
      password: PASSWORD,
      role: "student",
      branch: cse._id,
      year: 3,
      section: i % 2 === 0 ? "A" : "B",
      semester: 5,
      rollNumber: `21CSE${String(i + 1).padStart(3, "0")}`,
    });
    students.push(student);
  }

  console.log("Creating subjects + assignments...");
  const dsa = await Subject.create({
    name: "Advanced Algorithms", code: "CS301", branch: cse._id, year: 3, semester: 5, createdBy: hodCse._id,
  });
  const ml = await Subject.create({
    name: "Machine Learning", code: "CS302", branch: cse._id, year: 3, semester: 5, createdBy: hodCse._id,
  });
  const se = await Subject.create({
    name: "Software Engineering", code: "CS303", branch: cse._id, year: 3, semester: 5, createdBy: hodCse._id,
  });

  await SubjectAssignment.create([
    { subject: dsa._id, section: "A", faculty: facultyCse1._id, studentCount: 3, assignedBy: hodCse._id },
    { subject: dsa._id, section: "B", faculty: facultyCse1._id, studentCount: 3, assignedBy: hodCse._id },
    { subject: ml._id, section: "A", faculty: facultyCse2._id, studentCount: 3, assignedBy: hodCse._id },
    // cross-branch: ECE faculty teaching a CSE subject
    { subject: se._id, section: "A", faculty: facultyEce1._id, studentCount: 3, assignedBy: hodCse._id },
  ]);

  console.log("Creating announcement groups...");
  await ensureGroupsExist();

  console.log("Seeding Buzz + Forum...");
  await Buzz.create([
    { title: "Inter-college Badminton Meet - Registrations Open", body: "Register at the sports office by Friday. Open to all years.", category: "Sports", postedBy: coordinator._id },
    { title: "Part-time Content Writer Needed", body: "Local startup looking for a part-time content writer, 10hrs/week. DM the coordinator for details.", category: "Part-time Job", postedBy: coordinator._id },
  ]);
  await ForumPost.create([
    { title: "Vanita placed at Flipkart with 22 LPA", body: "Huge congratulations to our CSE coordinator Vanita Reddy on landing a 22 LPA offer from Flipkart!", category: "Placements", postedBy: coordinator._id },
    { title: "ISRO announces next lunar mission timeline", body: "ISRO has shared a tentative timeline for its next lunar exploration mission, building on Chandrayaan's success.", category: "Space & Science", postedBy: coordinator._id },
  ]);

  console.log("Seeding a bit of Monday's timetable for 3rd year CSE - A...");
  await Timetable.create([
    { branch: cse._id, year: 3, section: "A", day: "Monday", period: 1, startTime: "09:00", endTime: "09:50", subject: dsa._id, faculty: facultyCse1._id },
    { branch: cse._id, year: 3, section: "A", day: "Monday", period: 2, startTime: "09:50", endTime: "10:40", subject: ml._id, faculty: facultyCse2._id },
    { branch: cse._id, year: 3, section: "A", day: "Monday", period: 3, startTime: "11:00", endTime: "11:50", subject: se._id, faculty: facultyEce1._id },
  ]);

  console.log("\nSeed complete. Every account uses the password:", PASSWORD);
  console.log("Try logging in as:");
  console.log("  Admin    :", admin.email);
  console.log("  Operator :", operator.email);
  console.log("  HOD      :", hodCse.email);
  console.log("  Faculty  :", facultyCse1.email);
  console.log("  Coord.   :", coordinator.email);
  console.log("  Student  :", students[0].email);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
