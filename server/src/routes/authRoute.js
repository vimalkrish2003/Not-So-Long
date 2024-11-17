const express = require('express');
const {OAuth2Client} = require('google-auth-library');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middlewares/auth');
const User = require('../models/userModel');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
    try {
        const {token} = req.body;
        if(!token) {
            return res.status(400).json({message: "Token is required"});
        }
        
        // Verify the token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        
        // Find or create user
        let user = await User.findOne({ googleId: payload.sub });
        
        if (!user) {
            // Create new user if doesn't exist
            user = await User.create({
                googleId: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                lastLogin: new Date()
            });
        } else {
            // Update last login time for existing user
            user.lastLogin = new Date();
            await user.save();
        }
        
        // Create JWT token with user data
        const jwtToken = jwt.sign({
            userId: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '1d'
        });

        // Send Response with token and user data
        res.json({
            token: jwtToken,
            user: {
                id: user.googleId,
                email: user.email,
                name: user.name,
                picture: user.picture,
                lastLogin: user.lastLogin
            }
        });
    } catch(error) {
        console.log("Authentication Error: ", error);
        res.status(401).json({message: "Authentication failed", error: error.message});
    }
});

router.get('/protected', authMiddleware, (req, res) => {
    res.json({message: "Protected Route", user: req.user});
});

module.exports = router;