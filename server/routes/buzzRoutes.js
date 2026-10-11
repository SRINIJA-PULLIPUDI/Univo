const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/buzzController");
const { uploadBuzzImage } = require("../middleware/upload");

router.get("/", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.listBuzz);
router.post("/", auth, allow("coordinator", "hod", "operator"), uploadBuzzImage.single("image"), ctrl.createBuzz);
router.patch("/:id", auth, allow("coordinator", "hod", "operator"), uploadBuzzImage.single("image"), ctrl.updateBuzz);
router.delete("/:id", auth, allow("coordinator", "hod", "operator"), ctrl.deleteBuzz);

module.exports = router;
