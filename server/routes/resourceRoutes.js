const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/resourceController");

router.get("/stats/mine", auth, ctrl.myResourceStats);
router.post("/:id/read", auth, ctrl.markResourceRead);
router.delete("/:id", auth, ctrl.deleteResource);

module.exports = router;
