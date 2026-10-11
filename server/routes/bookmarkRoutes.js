const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/bookmarkController");

router.get("/", auth, ctrl.listBookmarks);
router.get("/folders", auth, ctrl.listFolders);
router.post("/folders", auth, ctrl.createFolder);
router.patch("/folders", auth, ctrl.renameFolder);
router.delete("/folders/:name", auth, ctrl.deleteFolder);
router.post("/batch", auth, ctrl.batchAddBookmarks);
router.post("/", auth, ctrl.addBookmark);
router.delete("/:id", auth, ctrl.removeBookmark);
router.patch("/:id", auth, ctrl.moveBookmark);

module.exports = router;
