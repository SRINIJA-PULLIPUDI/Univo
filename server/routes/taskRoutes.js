const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/taskController");
const { uploadProof, uploadRollNumbers } = require("../middleware/upload");

router.get("/mine", auth, ctrl.myTasks);
router.post("/notifications/read", auth, allow("student"), ctrl.markAssignmentNotificationsRead);
router.get("/assigned", auth, ctrl.tasksAssignedByMe);
router.get("/assigned/:taskId/export-excel", auth, allow("faculty", "hod", "operator"), ctrl.exportTaskSubmissionsExcel);
router.get("/assigned/:taskId", auth, allow("faculty", "hod", "operator"), ctrl.taskDetails);
router.get("/personal", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.listPersonalTasks);
router.post("/personal", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.createPersonalTask);
router.patch("/personal/:taskId", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.updatePersonalTask);
router.delete("/personal/:taskId", auth, allow("student", "faculty", "hod", "operator", "coordinator"), ctrl.deletePersonalTask);
router.post("/", auth, uploadRollNumbers.single("rollNumbersFile"), ctrl.createTask);
router.put("/:taskId", auth, allow("faculty", "hod", "operator", "coordinator"), uploadRollNumbers.single("rollNumbersFile"), ctrl.updateTask);
router.patch("/:taskId", auth, allow("faculty", "hod", "operator", "coordinator"), uploadRollNumbers.single("rollNumbersFile"), ctrl.updateTask);
router.post("/:taskId/complete", auth, uploadProof.single("proof"), ctrl.completeTask);
router.post("/:taskId/proof", auth, uploadProof.single("proof"), ctrl.uploadProof);
router.delete("/:taskId", auth, ctrl.deleteTask);
router.post("/submissions/batch-verify", auth, allow("faculty", "hod", "operator"), ctrl.batchVerifySubmissions);
router.post("/submissions/:submissionId/verify", auth, ctrl.verifySubmission);
router.post("/submissions/:submissionId/reject", auth, allow("faculty", "hod", "operator"), ctrl.rejectSubmission);
router.delete("/submissions/:submissionId/proof", auth, ctrl.deleteProof);
router.delete("/submissions/:submissionId", auth, allow("student", "coordinator"), ctrl.deleteStudentSubmission);

module.exports = router;
