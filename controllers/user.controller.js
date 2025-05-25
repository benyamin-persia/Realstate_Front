import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

async function fixUserUpdatedAt() {
  try {
    const users = await prisma.user.findMany({
      where: {
        updatedAt: null
      }
    });

    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          updatedAt: new Date()
        }
      });
    }
    console.log(`Fixed ${users.length} users with null updatedAt`);
  } catch (err) {
    console.error("Error fixing user updatedAt:", err);
  }
}

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get users!" });
  }
};

export const getUser = async (req, res) => {
  const id = req.params.id;
  try {
    // First try to fix any users with null updatedAt
    await fixUserUpdatedAt();

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        isAdmin: true,
        role: true,
        postLimit: true
        // Exclude password from the response
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Error getting user:", err);
    res.status(500).json({ message: "Failed to get user!" });
  }
};

export const updateUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;
  const { password, avatar, ...inputs } = req.body;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not Authorized!" });
  }

  let updatedPassword = null;
  try {
    if (password) {
      updatedPassword = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...inputs,
        ...(updatedPassword && { password: updatedPassword }),
        ...(avatar && { avatar }),
      },
    });

    const { password: userPassword, ...rest } = updatedUser;

    res.status(200).json(rest);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update users!" });
  }
};

export const deleteUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    // Check if the requesting user is an admin
    const requestingUser = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: { isAdmin: true }
    });

    // Only allow if user is admin or deleting their own profile
    if (!requestingUser?.isAdmin && id !== tokenUserId) {
      return res.status(403).json({ message: "Not Authorized!" });
    }

    // If admin is deleting a user, delete all their posts and related data first
    if (requestingUser?.isAdmin && id !== tokenUserId) {
      // Delete user's posts and related data
      const userPosts = await prisma.post.findMany({
        where: { userId: id },
        include: {
          postDetail: true,
          savedPosts: true
        }
      });

      // Delete post details and saved posts
      for (const post of userPosts) {
        if (post.postDetail) {
          await prisma.postDetail.delete({
            where: { postId: post.id }
          });
        }
        if (post.savedPosts.length > 0) {
          await prisma.savedPost.deleteMany({
            where: { postId: post.id }
          });
        }
      }

      // Delete the posts
      await prisma.post.deleteMany({
        where: { userId: id }
      });

      // Delete user's saved posts
      await prisma.savedPost.deleteMany({
        where: { userId: id }
      });

      // Delete user's chats and messages
      const userChats = await prisma.chat.findMany({
        where: {
          userIDs: {
            has: id
          }
        }
      });

      for (const chat of userChats) {
        await prisma.message.deleteMany({
          where: { chatId: chat.id }
        });
      }

      await prisma.chat.deleteMany({
        where: {
          userIDs: {
            has: id
          }
        }
      });
    }

    // Finally delete the user
    await prisma.user.delete({
      where: { id }
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Failed to delete user", error: err.message });
  }
};

export const savePost = async (req, res) => {
  const postId = req.body.postId;
  const tokenUserId = req.userId;

  try {
    const savedPost = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: tokenUserId,
          postId,
        },
      },
    });

    if (savedPost) {
      await prisma.savedPost.delete({
        where: {
          id: savedPost.id,
        },
      });
      res.status(200).json({ message: "Post removed from saved list" });
    } else {
      await prisma.savedPost.create({
        data: {
          userId: tokenUserId,
          postId,
        },
      });
      res.status(200).json({ message: "Post saved" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete users!" });
  }
};

export const profilePosts = async (req, res) => {
  const tokenUserId = req.userId;
  console.log("ProfilePosts called with userId:", tokenUserId);

  if (!tokenUserId) {
    console.error("No userId provided in request");
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    // First verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        role: true
      }
    });

    if (!user) {
      console.error("User not found:", tokenUserId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Found user:", { id: user.id, username: user.username });

    // Get user posts with all necessary relations
    const userPosts = await prisma.post.findMany({
      where: { 
        userId: tokenUserId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        postDetail: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log("Found user posts:", userPosts.length);
    console.log("User posts details:", userPosts.map(post => ({
      id: post.id,
      title: post.title,
      deletedAt: post.deletedAt
    })));

    // Get saved posts with all necessary relations
    const savedPosts = await prisma.savedPost.findMany({
      where: {
        userId: tokenUserId
      },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            },
            postDetail: true
          }
        }
      }
    });

    console.log("Found saved posts:", savedPosts.length);
    console.log("Saved posts details:", savedPosts.map(item => ({
      id: item.post.id,
      title: item.post.title,
      deletedAt: item.post.deletedAt
    })));

    // Extract just the posts from savedPosts
    const savedPostsFiltered = savedPosts
      .map(item => item.post)
      .filter(post => post !== null);

    // Log the response for debugging
    console.log("Profile posts response:", {
      userPostsCount: userPosts.length,
      savedPostsCount: savedPostsFiltered.length,
      userPosts: userPosts.map(p => ({ id: p.id, title: p.title })),
      savedPosts: savedPostsFiltered.map(p => ({ id: p.id, title: p.title }))
    });

    res.status(200).json({ 
      userPosts, 
      savedPosts: savedPostsFiltered 
    });
  } catch (err) {
    console.error("Error in profilePosts:", {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    
    res.status(500).json({ 
      message: "Failed to get profile posts!",
      error: err.message
    });
  }
};

export const getNotificationNumber = async (req, res) => {
  const tokenUserId = req.userId;
  try {
    const number = await prisma.chat.count({
      where: {
        userIDs: {
          hasSome: [tokenUserId],
        },
        NOT: {
          seenBy: {
            hasSome: [tokenUserId],
          },
        },
      },
    });
    res.status(200).json(number);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get profile posts!" });
  }
};

export const getUserPosts = async (req, res) => {
  const userId = req.params.userId;

  try {
    // First check if the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get all posts for the user, including deleted ones
    const posts = await prisma.post.findMany({
      where: {
        userId: userId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        postDetail: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${posts.length} posts for user ${userId}`);

    res.status(200).json(posts);
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).json({ 
      message: "Failed to fetch user posts",
      error: err.message 
    });
  }
};
