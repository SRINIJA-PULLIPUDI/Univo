const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roles");
const ctrl = require("../controllers/branchController");

router.get("/", auth, ctrl.listBranches);
router.post("/", auth, allow("admin"), ctrl.createBranch);
router.patch("/:id", auth, allow("admin", "operator"), ctrl.updateBranch);
router.get("/overview", auth, allow("admin"), ctrl.adminOverview);
router.get("/:id/stats", auth, ctrl.branchStats);

module.exports = router;
