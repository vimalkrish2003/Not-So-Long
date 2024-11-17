const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader?.startsWith('Bearer')){
        return res.status(401).json({message: "Invalid Token Format"});
    }

    const token =authHeader.split(' ')[1];
    if(!token)
    {
        return res.status(401).json({message:"Unauthorized"});
    }
    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        req.user=decoded;
        next();
    }
    catch(err)
    {
        return res.status(401).json({message:"Unauthorized -Invalid Token"});
    }
};

module.exports = authMiddleware;