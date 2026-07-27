const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const logRoutes = require("./routes/logs");

const app = express();


/* -------------------------------------------------------------------------- */
/*                                CORS CONFIG                                 */
/* -------------------------------------------------------------------------- */

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  "https://devstreak-ui.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow Postman, curl, mobile apps, etc.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

/* -------------------------------------------------------------------------- */
/*                           MONGODB CONNECTION                               */
/* -------------------------------------------------------------------------- */

const connectDB = async () => {
  // Already connected
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to:", db.connection.host);
    console.log("Database:", db.connection.name);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
};

/* -------------------------------------------------------------------------- */
/*                          SERVERLESS (VERCEL)                               */
/* -------------------------------------------------------------------------- */

if (process.env.NODE_ENV === "production") {
  app.use(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      next(err);
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                                 ROUTES                                     */
/* -------------------------------------------------------------------------- */

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/logs", logRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* -------------------------------------------------------------------------- */
/*                          LOCAL DEVELOPMENT                                 */
/* -------------------------------------------------------------------------- */

if (process.env.NODE_ENV !== "production") {
  const startServer = async () => {
    try {
      await connectDB();

      const PORT = process.env.PORT || 5000;

      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  };

  startServer();
}

/* -------------------------------------------------------------------------- */
/*                               EXPORT APP                                   */
/* -------------------------------------------------------------------------- */

module.exports = app;