import jwt from "jsonwebtoken";

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: "Not authenticated!" });
    }

    const payload = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    req.userId = payload.id;
    next();
  } catch (err) {
    console.error("Token verification error:", {
      name: err.name,
      message: err.message,
      expiredAt: err.expiredAt
    });
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Token has expired",
        error: err.message
      });
    }
    
    return res.status(403).json({ 
      message: "Token is not valid!",
      error: err.message
    });
  }
};
