const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const logRoutes = require("./routes/logs");

const app = express();

// 1. CORS Setup (Supports FRONTEND_URL or CLIENT_URL)
const allowedOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// 2. Serverless MongoDB Connection Cache
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    isConnected = db.connections[0].readyState === 1;
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
};

// Connect to DB before handling any incoming route request
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// 3. API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/logs", logRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// 4. Local Server Fallback (Runs locally; Vercel ignores app.listen)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;