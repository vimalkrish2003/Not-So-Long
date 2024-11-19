const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const isAuthenticated = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log("Auth header:", authHeader);
        if (!authHeader?.startsWith('Bearer')) {
            return res.status(401).json({ message: "Invalid token format" });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check token expiration
        if (Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({ message: "Token expired" });
        }

        // Verify user still exists in database
        const user = await User.findOne({ googleId: decoded.userId });
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }

        // Check if token was issued before password change
        if (user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({ message: "Token invalidated" });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

module.exports = isAuthenticated;