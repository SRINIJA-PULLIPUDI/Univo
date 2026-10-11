const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/notificationController");

router.get("/unread", auth, ctrl.unreadCounts);

module.exports = router;