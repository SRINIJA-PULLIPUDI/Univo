const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Rooms used across the app:
//   group:<groupId>              - an announcement group (HOD Community / Year Group)
//   subject:<subjectId>          - a subject's community discussion
//   direct:<room>                - a 1:1 student<->faculty chat ("direct-<subjectId>-<studentId>")
// Controllers emit into these rooms after saving a message (see req.io usage
// in groupController / discussionController); this file only handles the
// handshake + join/leave requests coming from connected clients.
function initSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error("Unauthorized"));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);

    socket.on("group:join", (groupId) => socket.join(`group:${groupId}`));
    socket.on("group:leave", (groupId) => socket.leave(`group:${groupId}`));

    socket.on("subject:join", (subjectId) => socket.join(`subject:${subjectId}`));
    socket.on("subject:leave", (subjectId) => socket.leave(`subject:${subjectId}`));

    socket.on("direct:join", (room) => socket.join(`direct:${room}`));
    socket.on("direct:leave", (room) => socket.leave(`direct:${room}`));

    socket.on("forum:join", (postId) => socket.join(`forum:${postId}`));
    socket.on("forum:leave", (postId) => socket.leave(`forum:${postId}`));

    // lightweight "X is typing" indicator, reused across all three chat contexts
    socket.on("typing", ({ room }) => {
      socket.to(room).emit("typing", { userId: socket.user._id, name: socket.user.name });
    });
  });
}

module.exports = initSockets;
