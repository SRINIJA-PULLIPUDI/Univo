const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/timetableController");

router.get("/", auth, ctrl.getTimetable);
router.post("/", auth, ctrl.upsertPeriod);
router.delete("/:id", auth, ctrl.deletePeriod);

module.exports = router;
