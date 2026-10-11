const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/groupController");

router.get("/", auth, allow("student", "faculty", "hod", "operator"), ctrl.getMyGroups);
router.get("/announcements/latest", auth, allow("student", "faculty", "hod", "operator"), ctrl.getLatestAnnouncements);
router.post("/:groupId/read", auth, allow("student", "faculty", "hod", "operator"), ctrl.markGroupRead);
router.get("/:groupId/messages", auth, allow("student", "faculty", "hod", "operator"), ctrl.getGroupMessages);
router.post("/:groupId/messages", auth, allow("faculty", "hod", "operator"), ctrl.postGroupMessage);
router.post("/messages/:messageId/react", auth, allow("student", "faculty", "hod", "operator"), ctrl.reactToMessage);

module.exports = router;
