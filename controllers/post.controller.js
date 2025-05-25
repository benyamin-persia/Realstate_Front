import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";

async function checkPostLimit(userId) {
  try {
    // Get user's post limit
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error("User not found:", userId);
      return false;
    }

    // If user is admin or premium, no limit
    if (user.isAdmin || user.role === 'premium') {
      console.log("User is admin/premium, no post limit");
      return true;
    }

    // Get today's posts count for the user
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const postsCount = await prisma.post.count({
      where: {
        userId: userId,
        createdAt: {
          gte: today
        }
      }
    });

    // Check against user's post limit (default is 3 for regular users)
    const postLimit = user.postLimit || 3;
    console.log(`User ${userId} has ${postsCount}/${postLimit} posts today`);
    
    return postsCount < postLimit;
  } catch (err) {
    console.error("Error checking post limit:", err);
    return false;
  }
}

export const getPosts = async (req, res) => {
  const query = req.query;

  try {
    const posts = await prisma.post.findMany({
      where: {
        city: query.city || undefined,
        type: query.type || undefined,
        property: query.property || undefined,
        bedroom: parseInt(query.bedroom) || undefined,
        price: {
          gte: parseInt(query.minPrice) || undefined,
          lte: parseInt(query.maxPrice) || undefined,
        },
        // Temporarily remove the deletedAt filter to see all posts
        // deletedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    console.log("Found posts:", posts.length);
    console.log("Posts details:", posts.map(post => ({
      id: post.id,
      title: post.title,
      deletedAt: post.deletedAt
    })));

    res.status(200).json(posts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get posts" });
  }
};

export const getPost = async (req, res) => {
  const id = req.params.id;
  const showDeleted = req.query.showDeleted === 'true';
  
  console.log("Getting post with ID:", id, "showDeleted:", showDeleted);
  
  try {
    // First try to get the post without any filters
    let post = await prisma.post.findUnique({
      where: { id },
      include: {
        postDetail: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // If post exists but is deleted and showDeleted is false, return 404
    if (post && post.deletedAt && !showDeleted) {
      console.log("Post is deleted:", id);
      return res.status(404).json({ message: "Post not found" });
    }

    if (!post) {
      console.log("Post not found:", id);
      return res.status(404).json({ message: "Post not found" });
    }

    console.log("Post found:", {
      id: post.id,
      title: post.title,
      hasPostDetail: !!post.postDetail,
      hasUser: !!post.user,
      deletedAt: post.deletedAt
    });

    const token = req.cookies?.token;

    if (token) {
      jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, payload) => {
        if (!err) {
          const saved = await prisma.savedPost.findUnique({
            where: {
              userId_postId: {
                postId: id,
                userId: payload.id,
              },
            },
          });
          res.status(200).json({ ...post, isSaved: saved ? true : false });
        }
      });
    } else {
      res.status(200).json({ ...post, isSaved: false });
    }
  } catch (err) {
    console.error("Error getting post:", {
      error: err,
      message: err.message,
      code: err.code,
      meta: err.meta
    });
    res.status(500).json({ 
      message: "Failed to get post",
      error: err.message,
      code: err.code,
      meta: err.meta
    });
  }
};

export const addPost = async (req, res) => {
  const body = req.body;
  const tokenUserId = req.userId;

  try {
    // First verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: tokenUserId }
    });

    if (!user) {
      console.error("User not found:", tokenUserId);
      return res.status(404).json({ message: "User not found" });
    }

    // Check post limit first
    const canPost = await checkPostLimit(tokenUserId);
    console.log("Can post check result:", canPost);

    if (!canPost) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const postsCount = await prisma.post.count({
        where: {
          userId: tokenUserId,
          createdAt: {
            gte: today
          }
        }
      });

      const postLimit = user.postLimit || 3;
      return res.status(403).json({ 
        message: `You have reached your daily post limit (${postsCount}/${postLimit}). Please try again tomorrow or upgrade to premium for unlimited posts.`,
        currentCount: postsCount,
        limit: postLimit
      });
    }

    if (!body.postData || !body.postDetail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate only required fields
    const requiredFields = ['title', 'address'];
    const missingFields = requiredFields.filter(field => !body.postData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        fields: missingFields 
      });
    }

    // Set default values for optional fields with proper type conversion
    const postData = {
      ...body.postData,
      price: parseInt(body.postData.price) || 0,
      city: body.postData.city || 'Not specified',
      bedroom: parseInt(body.postData.bedroom) || 0,
      bathroom: parseInt(body.postData.bathroom) || 0,
      type: body.postData.type || 'buy',
      property: body.postData.property || 'apartment',
    };

    // Set default description if not provided
    const postDetail = {
      ...body.postDetail,
      desc: body.postDetail.desc || 'No description provided'
    };

    // Remove userId from postData and create the post
    const { userId, ...finalPostData } = postData;
    
    console.log("Creating post with data:", {
      postData: finalPostData,
      postDetail,
      userId: tokenUserId
    });

    const newPost = await prisma.post.create({
      data: {
        ...finalPostData,
        user: {
          connect: {
            id: tokenUserId
          }
        },
        postDetail: {
          create: postDetail,
        },
      },
      include: {
        postDetail: true,
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    });

    console.log("Post created successfully:", newPost.id);
    res.status(200).json(newPost);
  } catch (err) {
    console.error("Error creating post:", {
      error: err,
      message: err.message,
      code: err.code,
      meta: err.meta
    });
    res.status(500).json({ 
      message: "Failed to create post",
      error: err.message,
      code: err.code,
      meta: err.meta
    });
  }
};

export const updatePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;
  const body = req.body;

  try {
    if (!body.postData || !body.postDetail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate only required fields
    const requiredFields = ['title', 'address'];
    const missingFields = requiredFields.filter(field => !body.postData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        fields: missingFields 
      });
    }

    // Set default values for optional fields with proper type conversion
    const postData = {
      ...body.postData,
      price: parseInt(body.postData.price) || 0,
      city: body.postData.city || 'Not specified',
      bedroom: parseInt(body.postData.bedroom) || 0,
      bathroom: parseInt(body.postData.bathroom) || 0,
      type: body.postData.type || 'buy',
      property: body.postData.property || 'apartment',
    };

    // Set default description if not provided and handle other postDetail fields
    const postDetail = {
      ...body.postDetail,
      desc: body.postDetail.desc || 'No description provided',
      utilities: body.postDetail.utilities || null,
      pet: body.postDetail.pet || null,
      income: body.postDetail.income || null,
      size: parseInt(body.postDetail.size) || null,
      school: parseInt(body.postDetail.school) || null,
      bus: parseInt(body.postDetail.bus) || null,
      restaurant: parseInt(body.postDetail.restaurant) || null
    };

    // Check if post exists and user is authorized
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postDetail: true,
        user: true
      }
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user is admin or post owner
    const isAdmin = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: { isAdmin: true }
    });

    if (!isAdmin?.isAdmin && post.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not Authorized!" });
    }

    // Remove userId from postData
    const { userId, ...finalPostData } = postData;

    console.log("Updating post with data:", {
      postData: finalPostData,
      postDetail,
      userId: tokenUserId
    });

    // Update post and postDetail
    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        ...finalPostData,
        postDetail: {
          update: postDetail
        }
      },
      include: {
        postDetail: true,
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(200).json(updatedPost);
  } catch (err) {
    console.error("Error updating post:", {
      error: err,
      message: err.message,
      code: err.code,
      meta: err.meta
    });
    res.status(500).json({ 
      message: "Failed to update post",
      error: err.message,
      code: err.code,
      meta: err.meta
    });
  }
};

export const deletePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postDetail: true,
        savedPosts: true,
        user: true
      }
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user is admin or post owner
    const isAdmin = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: { isAdmin: true }
    });

    if (!isAdmin?.isAdmin && post.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not Authorized!" });
    }

    // Instead of deleting, mark the post as deleted with a timestamp
    await prisma.post.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Failed to delete post", error: err.message });
  }
};

export const restorePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    // Check if user is admin or post owner
    const isAdmin = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: { isAdmin: true }
    });

    const post = await prisma.post.findUnique({
      where: { id }
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found!" });
    }

    if (!isAdmin?.isAdmin && post.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not Authorized!" });
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        deletedAt: null
      },
      include: {
        postDetail: true,
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    });

    res.status(200).json(updatedPost);
  } catch (err) {
    console.error("Error restoring post:", err);
    res.status(500).json({ 
      message: "Failed to restore post",
      error: err.message 
    });
  }
};
