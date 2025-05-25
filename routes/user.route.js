import express from "express";
import {
  deleteUser,
  getUser,
  getUsers,
  updateUser,
  savePost,
  profilePosts,
  getNotificationNumber,
  getUserPosts
} from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyAdmin } from "../middleware/verifyAdmin.js";

const router = express.Router();

// Admin only routes
router.get("/", verifyToken, verifyAdmin, getUsers);

// Protected routes
router.get("/profilePosts", verifyToken, profilePosts);
router.post("/save", verifyToken, savePost);
router.get("/notification", verifyToken, getNotificationNumber);
router.get("/:userId/posts", verifyToken, getUserPosts);
router.get("/:id", verifyToken, getUser);
router.put("/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);

export default router;
