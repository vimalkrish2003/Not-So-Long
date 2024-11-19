const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('../routes/authRoute');
const roomRoutes = require('../routes/roomRoute');

const configureExpress = () => {
  const app = express();

  app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json({ limit: "10kb" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/room", roomRoutes);


  return app;
};

module.exports = configureExpress;