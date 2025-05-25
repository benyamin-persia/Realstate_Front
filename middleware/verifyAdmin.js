import prisma from "../lib/prisma.js";

export const verifyAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated!" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Not authorized! Admin access required." });
    }

    next();
  } catch (err) {
    console.error("Admin verification error:", err);
    return res.status(500).json({ 
      message: "Error verifying admin access",
      error: err.message
    });
  }
}; 