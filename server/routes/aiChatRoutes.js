const router = require("express").Router();
const auth = require("../middleware/auth");
const ctrl = require("../controllers/aiChatController");

// Conversation management
router.get("/conversations", auth, ctrl.getConversations);
router.post("/conversations", auth, ctrl.createConversation);
router.get("/conversations/:id", auth, ctrl.getConversation);
router.patch("/conversations/:id", auth, ctrl.updateConversation);
router.delete("/conversations/:id", auth, ctrl.deleteConversation);

// Send message / Ask AI
router.post("/", auth, ctrl.ask);

module.exports = router;
