const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Access token (short-lived for security)
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });

// Refresh token (long-lived)
const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

// Helper to set HttpOnly cookie options cleanly
const cookieOptions = {
  httpOnly: true, // Prevents XSS scripts from reading the cookie
  secure: process.env.NODE_ENV === 'production', // Must be true when sameSite is 'none'
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allows cross-domain cookies in production
  path: '/', // <--- Explicit path matching
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, domain } = req.body;

    if (!name || !email || !password) 
      return res.status(400).json({ message: 'Name, email and password are required' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      passwordHash: password, // pre-save hook will hash it
      domain: domain || 'Developer',
    });

    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // Send refreshToken in an HttpOnly cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Send ONLY the access token and user in JSON
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.json({ token, user });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    // Send the error message back to inspect it in DevTools Network Response
    res.status(500).json({ 
      message: 'Server error', 
      error: err.message || String(err) 
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    // Read refreshToken from cookies instead of req.body
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const token = signToken(user._id);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// POST /api/auth/logout - Clear the HttpOnly cookie
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken' , {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/', 
  });
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me - verify token and return user
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;