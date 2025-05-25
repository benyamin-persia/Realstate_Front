import jwt from "jsonwebtoken";

export const verifyToken = async (req, res, next) => {
  try {
    console.log("Verifying token for request:", {
      path: req.path,
      method: req.method,
      cookies: req.cookies,
      headers: req.headers
    });

    const token = req.cookies.token;
    
    if (!token) {
      console.log("No token found in cookies");
      return res.status(401).json({ message: "Not authenticated!" });
    }

    console.log("Token found, attempting to verify");
    const payload = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
          console.error("JWT verification error:", {
            name: err.name,
            message: err.message,
            expiredAt: err.expiredAt
          });
          reject(err);
        } else {
          console.log("Token verified successfully, payload:", {
            id: decoded.id,
            isAdmin: decoded.isAdmin
          });
          resolve(decoded);
        }
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
