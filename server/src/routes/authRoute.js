const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const isAuthenticated = require("../middlewares/isAuthenticated");

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Find or create user
    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        tokenVersion: 0,
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const jwtToken = jwt.sign(
      {
        userId: user.googleId,
        tokenVersion: user.tokenVersion, // Include token version for invalidation after security breach
      },
      process.env.JWT_SECRET,
      { expiresIn: "6h" } // 6 hours
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.googleId,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error("Authentication Error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
});

// Verify token endpoint
router.get("/verify", isAuthenticated, (req, res) => {
  // isAuthenticated has already done all necessary checks
  // We just need to return the success response with user data
  res.json({
    valid: true,
    user: {
      id: req.user.userId,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    },
  });
});

//For Development purpose to make the login easier
router.post("/test", async (req, res) => {
  try {
    const { user } = req.body;
    
    if (!user || !user.googleId) {
      return res.status(400).json({ message: "Invalid user data" });
    }

    // Find or create test user in database
    let dbUser = await User.findOne({ googleId: user.googleId });

    if (!dbUser) {
      dbUser = await User.create({
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        tokenVersion: 0
      });
    }

    // Update last login
    dbUser.lastLogin = new Date();
    await dbUser.save();

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        userId: dbUser.googleId,
        tokenVersion: dbUser.tokenVersion
      },
      process.env.JWT_SECRET,
      { expiresIn: "6h" }
    );

    // Return same response structure as Google login
    res.json({
      token: jwtToken,
      user: {
        id: dbUser.googleId,
        email: dbUser.email,
        name: dbUser.name,
        picture: dbUser.picture
      }
    });

  } catch (error) {
    console.error("Test Authentication Error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
});

module.exports = router;
