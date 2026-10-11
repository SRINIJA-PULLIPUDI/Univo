const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/forumController");
const { uploadForumImage } = require("../middleware/upload");

router.get("/", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.listForum);
router.get("/coordinator-stats", auth, ctrl.coordinatorStats);
router.post("/:id/react", auth, ctrl.toggleReaction);
router.get("/:id", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.getForumPost);
router.get("/:id/comments", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.listForumComments);
router.post("/:id/comments", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.createForumComment);
router.put("/:id/comments/:commentId", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.updateForumComment);
router.delete("/:id/comments/:commentId", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.deleteForumComment);
router.post("/", auth, allow("coordinator", "hod", "operator"), uploadForumImage.single("image"), ctrl.createForumPost);
router.patch("/:id", auth, allow("coordinator", "hod", "operator"), uploadForumImage.single("image"), ctrl.updateForumPost);
router.delete("/:id", auth, allow("coordinator", "hod", "operator"), ctrl.deleteForumPost);

module.exports = router;
