const express = require("express");
const jwt = require("jsonwebtoken");
const { randomBytes, createHash } = require("node:crypto"); // <--- Native built-in import
const nodemailer = require("nodemailer");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Access token (short-lived for security)
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });

// Refresh token (long-lived)
const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" });

// Helper to set HttpOnly cookie options cleanly
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, domain } = req.body;

    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });

    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      domain: domain || "Developer",
    });

    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.json({ token, user });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message || String(err),
    });
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken)
      return res.status(401).json({ message: "No refresh token" });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const token = signToken(user._id);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// POST /api/auth/logout - Clear the HttpOnly cookie
router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", cookieOptions);
  res.json({ message: "Logged out successfully" });
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        message:
          "If an account exists with that email, a reset link has been sent.",
      });
    }

    // Generate unhashed token & hashed token
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"DevStreak" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h3>Reset Your Password</h3>
        <p>You requested a password reset for your DevStreak account. Click the link below to set a new password:</p>
        <a href="${resetUrl}" target="_blank">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({
      message:
        "If an account exists with that email, a reset link has been sent.",
    });
  } catch (err) {
    console.error("FORGOT_PASSWORD_ERROR:", err);
    res.status(500).json({ message: "Server error sending email", error: err.message });
  }
});

// POST /api/auth/reset-password/:resetToken
router.post("/reset-password/:resetToken", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const resetTokenHash = createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    user.passwordHash = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("RESET_PASSWORD_ERROR:", err);
    res.status(500).json({ message: "Server error resetting password" });
  }
});

module.exports = router;