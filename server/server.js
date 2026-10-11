require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const initSockets = require("./sockets");
const Bookmark = require("./models/Bookmark");
const User = require("./models/User");
const Subject = require("./models/Subject");
const SubjectAssignment = require("./models/SubjectAssignment");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});
initSockets(io);

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// make io reachable from controllers as req.io, so a saved message can be
// broadcast in the same request that persisted it
app.use((req, res, next) => {
  req.io = io;
  next();
});

// uploaded files (circulars, resources, proofs, buzz/forum images, avatars)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "univo-server" }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/branches", require("./routes/branchRoutes"));
app.use("/api/subjects", require("./routes/subjectRoutes"));
app.use("/api/resources", require("./routes/resourceRoutes"));
app.use("/api/files", require("./routes/uploadRoutes"));
app.use("/api/groups", require("./routes/groupRoutes"));
app.use("/api/circulars", require("./routes/circularRoutes"));
app.use("/api/bookmarks", require("./routes/bookmarkRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/buzz", require("./routes/buzzRoutes"));
app.use("/api/forum", require("./routes/forumRoutes"));
app.use("/api/timetable", require("./routes/timetableRoutes"));
app.use("/api/ai-chat", require("./routes/aiChatRoutes"));

app.use((req, res) => res.status(404).json({ message: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong", error: err.message });
});

const PORT = process.env.PORT || 5000;
async function initializeBookmarkIndexes() {
  await Bookmark.createCollection().catch((err) => {
    if (err.codeName !== "NamespaceExists") throw err;
  });
  const indexes = await Bookmark.collection.indexes();
  for (const index of indexes) {
    if (index.name === "user_1_resource_1" || index.name === "user_1_circular_1") {
      await Bookmark.collection.dropIndex(index.name).catch(() => {});
    }
  }
  await Bookmark.collection.createIndex(
    { user: 1, resource: 1, folder: 1 },
    { unique: true, partialFilterExpression: { resource: { $type: "objectId" } } }
  );
  await Bookmark.collection.createIndex(
    { user: 1, circular: 1, folder: 1 },
    { unique: true, partialFilterExpression: { circular: { $type: "objectId" } } }
  );
}

async function migrateAcademicSemesters() {
  const userResult = await User.collection.updateMany(
    { academicSchemaVersion: { $ne: 2 }, role: { $in: ["student", "coordinator"] }, year: { $gte: 1, $lte: 4 } },
    [{ $set: {
      semester: { $add: [{ $multiply: [{ $subtract: ["$year", 1] }, 2] }, { $ifNull: ["$semester", 1] }] },
      academicSchemaVersion: 2,
    } }]
  );
  const subjectResult = await Subject.collection.updateMany(
    { academicSchemaVersion: { $ne: 2 }, year: { $gte: 1, $lte: 4 } },
    [{ $set: {
      semester: { $add: [{ $multiply: [{ $subtract: ["$year", 1] }, 2] }, { $ifNull: ["$semester", 1] }] },
      academicSchemaVersion: 2,
    } }]
  );
  const staffResult = await User.collection.updateMany(
    { role: { $nin: ["student", "coordinator"] }, $or: [{ year: { $ne: null } }, { semester: { $ne: null } }] },
    { $unset: { year: "", semester: "", section: "", rollNumber: "" }, $set: { academicSchemaVersion: 2 } }
  );
  if (userResult.modifiedCount || subjectResult.modifiedCount || staffResult.modifiedCount) {
    console.log(`[db] Migrated academic fields: ${userResult.modifiedCount} students, ${subjectResult.modifiedCount} subjects, ${staffResult.modifiedCount} staff`);
  }
}

async function migrateDirectChatRooms() {
  const legacyRooms = await Message.distinct("room", {
    context: "direct",
    room: { $regex: /^direct-[a-f\d]{24}-[a-f\d]{24}$/i },
  });
  for (const room of legacyRooms) {
    const [, subjectId, studentId] = room.split("-");
    const student = await User.findById(studentId).select("section");
    if (!student) continue;
    const assignment = await SubjectAssignment.findOne({ subject: subjectId, section: student.section }).select("faculty");
    if (!assignment) continue;
    await Message.updateMany(
      { context: "direct", room },
      { $set: { room: `direct-${subjectId}-${studentId}-${assignment.faculty}` } }
    );
  }
}

async function bootstrapAdmin() {
  if (await User.exists({ role: "admin" })) return;
  const allowDemoAdmin = process.env.NODE_ENV !== "production";
  const email = (process.env.ADMIN_EMAIL || (allowDemoAdmin ? "admin@univo.edu" : "")).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (allowDemoAdmin ? "Univo@123" : "");
  if (!email || !password) {
    console.warn("[auth] No Admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env to bootstrap one.");
    return;
  }
  await User.create({
    name: process.env.ADMIN_NAME?.trim() || "Univo Admin",
    email,
    password,
    role: "admin",
  });
  console.log(`[auth] Bootstrapped Admin account: ${email}`);
}

connectDB().then(async () => {
  await migrateAcademicSemesters();
  await migrateDirectChatRooms();
  await initializeBookmarkIndexes();
  await bootstrapAdmin();

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ [univo-server] Error: Port ${PORT} is already in use.`);
      console.error(`   Another process is already listening on port ${PORT}.`);
      console.error(`   To automatically free the port, run: npm run free:port\n`);
      process.exit(1);
    } else {
      console.error("❌ [univo-server] Server error:", err);
      process.exit(1);
    }
  });

  server.listen(PORT, () => console.log(`[univo-server] listening on http://localhost:${PORT}`));
});

const gracefulShutdown = (signal) => {
  server.close(() => {
    if (signal === "SIGUSR2") {
      process.kill(process.pid, "SIGUSR2");
    } else {
      process.exit(0);
    }
  });
};

process.once("SIGUSR2", () => gracefulShutdown("SIGUSR2"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
