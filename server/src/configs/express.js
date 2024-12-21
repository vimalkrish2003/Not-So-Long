const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("../routes/authRoute");
const roomRoutes = require("../routes/roomRoute");

const configureExpress = () => {
  const app = express();

  // Force IPv4
  app.set("ipv6", false);
  app.set("family", 4);

  // Get allowed origins from environment variable
  const allowedOrigins = process.env.CLIENT_URLS.split(",").map((url) =>
    url.trim()
  );

  // Configure CORS
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Access-Control-Allow-Origin"],
    })
  );


  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    }
    next();
  });
  
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: "10kb" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/room", roomRoutes);


  return app;
};

module.exports = configureExpress;
