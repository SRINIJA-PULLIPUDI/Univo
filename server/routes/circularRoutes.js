const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/circularController");
const { uploadCircular } = require("../middleware/upload");

router.get("/", auth, allow("student", "faculty", "hod", "operator"), ctrl.listCirculars);
router.post("/", auth, allow("faculty", "hod", "operator"), uploadCircular.single("file"), ctrl.uploadCircular);
router.post("/:id/read", auth, allow("student", "faculty", "hod", "operator"), ctrl.markRead);
router.delete("/:id", auth, allow("faculty", "hod", "operator"), ctrl.deleteCircular);

module.exports = router;
