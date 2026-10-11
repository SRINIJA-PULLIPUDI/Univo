const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/subjectController");
const discussion = require("../controllers/discussionController");
const resource = require("../controllers/resourceController");
const { uploadResource } = require("../middleware/upload");

router.get("/", auth, allow("admin", "hod", "operator"), ctrl.listSubjects);
router.get("/mine", auth, allow("faculty", "hod"), ctrl.mySubjects);
router.get("/student", auth, allow("student"), ctrl.studentSubjects);
router.get("/community/recent", auth, discussion.getRecentCommunityMessages);
router.get("/:id", auth, ctrl.getSubject);
router.get("/:id/students", auth, allow("faculty", "hod"), ctrl.subjectStudents);
router.post("/", auth, allow("hod", "operator"), ctrl.createSubject);
router.patch("/:id", auth, allow("hod", "operator"), ctrl.updateSubject);
router.delete("/:id", auth, allow("hod", "operator"), ctrl.deleteSubject);

router.post("/:subjectId/assign", auth, allow("hod", "operator"), ctrl.assignFaculty);
router.delete("/assignments/:assignmentId", auth, allow("hod", "operator"), ctrl.removeAssignment);

// subject community discussion
router.get("/:subjectId/discussion", auth, discussion.getSubjectDiscussion);
router.post("/:subjectId/discussion/read", auth, discussion.markSubjectDiscussionRead);
router.post("/:subjectId/discussion", auth, discussion.postSubjectDiscussion);

// direct chat with the lecturer
router.get("/:subjectId/chat/:studentId", auth, discussion.getDirectChat);
router.post("/:subjectId/chat/:studentId/read", auth, discussion.markDirectChatRead);
router.post("/:subjectId/chat/:studentId", auth, discussion.postDirectChat);

// materials
router.get("/:subjectId/resources", auth, resource.listResources);
router.post(
  "/:subjectId/resources",
  auth,
  allow("faculty", "hod"),
  uploadResource.single("file"),
  resource.uploadResource
);

module.exports = router;
