const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password").populate("branch");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const token = signToken(user);
    res.json({ token, user: user.publicProfile() });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};

const { sendPasswordResetOtp, sendPasswordChangedConfirmation } = require("../utils/mailer");

exports.me = async (req, res) => {
  const user = await User.findById(req.user._id).populate("branch");
  res.json({ user: user.publicProfile() });
};

exports.firstLoginSetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    const user = await User.findById(req.user._id).select("+password").populate("branch");
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    sendPasswordChangedConfirmation({ to: user.email, name: user.name }).catch(() => {});

    res.json({ message: "Password set successfully!", user: user.publicProfile() });
  } catch (err) {
    res.status(500).json({ message: "Could not set password", error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+resetOtp +resetOtpExpires");
    if (!user || !user.isActive) {
      return res.json({ message: "If an account with that email exists, a verification code has been sent." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendPasswordResetOtp({ to: user.email, name: user.name, otp }).catch((err) => {
      console.warn("⚠️ [mailer] OTP email error:", err.message);
      return null;
    });

    res.json({
      message: `Verification code sent to ${user.email}. Please check your inbox.`,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not send verification code", error: err.message });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, code, and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetOtp: String(otp).trim(),
      resetOtpExpires: { $gt: new Date() },
    }).select("+password +resetOtp +resetOtpExpires");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.isFirstLogin = false;
    await user.save();

    sendPasswordChangedConfirmation({ to: user.email, name: user.name }).catch(() => {});

    res.json({ message: "Password reset successful! You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Could not reset password", error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.user._id).select("+password");
    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });
    user.password = newPassword;
    user.isFirstLogin = false;
    await user.save();

    sendPasswordChangedConfirmation({ to: user.email, name: user.name }).catch(() => {});

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Could not change password", error: err.message });
  }
};
