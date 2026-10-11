const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/userController");
const { uploadRollNumbers } = require("../middleware/upload");

router.post("/advance-semester", auth, allow("admin", "hod", "operator"), ctrl.advanceSemester);
router.post("/bulk-academic", auth, allow("hod", "operator"), uploadRollNumbers.single("file"), ctrl.bulkUpdateStudentAcademics);
router.post("/import-students", auth, allow("hod", "operator"), uploadRollNumbers.single("file"), ctrl.importStudents);
router.post("/import-faculty", auth, allow("hod"), uploadRollNumbers.single("file"), ctrl.importFaculty);
router.get("/faculty-pool", auth, allow("hod", "operator"), ctrl.facultyPool);
router.get("/", auth, allow("admin", "hod", "operator"), ctrl.listUsers);
router.post("/", auth, allow("admin", "hod", "operator"), ctrl.createUser);
router.patch("/:id", auth, ctrl.updateUser);
router.post("/sync-sandy-attendance", auth, ctrl.syncSandyAttendance);
router.delete("/:id", auth, allow("admin", "hod", "operator"), ctrl.deactivateUser);

module.exports = router;
