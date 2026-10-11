const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/uploadController");

router.get("/:category/:filename/preview-data", auth, ctrl.getPreviewData);
router.get("/:category/:filename", auth, ctrl.serveUpload);

module.exports = router;
