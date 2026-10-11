const mongoose = require("mongoose");

const taskSubmissionSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "completed", "rejected"], default: "pending" },
    proofUrl: { type: String, default: null },
    proofFileName: { type: String, default: null },
    completedAt: { type: Date, default: null },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "", maxlength: 1000 },
    statusReadAt: { type: Date, default: null },
    dismissedByStudent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSubmissionSchema.index({ task: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("TaskSubmission", taskSubmissionSchema);
