const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/authController");

router.post("/login", ctrl.login);
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password", ctrl.resetPasswordWithOtp);
router.post("/first-login-set-password", auth, ctrl.firstLoginSetPassword);
router.get("/me", auth, ctrl.me);
router.post("/change-password", auth, ctrl.changePassword);

module.exports = router;
