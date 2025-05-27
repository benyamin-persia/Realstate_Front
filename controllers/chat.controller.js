import prisma from "../lib/prisma.js";

export const getChats = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    // Find all chats where the user is a participant
    const chats = await prisma.chat.findMany({
      where: {
        userIDs: {
          has: tokenUserId
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    // Get receiver information for each chat
    const chatsWithReceivers = await Promise.all(
      chats.map(async (chat) => {
      const receiverId = chat.userIDs.find((id) => id !== tokenUserId);
        if (!receiverId) return chat;

      const receiver = await prisma.user.findUnique({
          where: { id: receiverId },
        select: {
          id: true,
          username: true,
            avatar: true
          }
      });

        return {
          ...chat,
          receiver
        };
      })
    );

    res.status(200).json(chatsWithReceivers);
  } catch (err) {
    console.error("Error in getChats:", err);
    res.status(500).json({ 
      message: "Failed to get chats!",
      error: err.message 
    });
  }
};

export const getChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: req.params.id,
        userIDs: {
          has: tokenUserId
        }
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found!" });
    }

    // Update seenBy array
    if (!chat.seenBy.includes(tokenUserId)) {
    await prisma.chat.update({
        where: { id: chat.id },
      data: {
        seenBy: {
            push: tokenUserId
          }
        }
      });
    }

    res.status(200).json(chat);
  } catch (err) {
    console.error("Error in getChat:", err);
    res.status(500).json({ 
      message: "Failed to get chat!",
      error: err.message 
    });
  }
};

export const addChat = async (req, res) => {
  const tokenUserId = req.userId;
  const { receiverId } = req.body;

  if (!receiverId) {
    return res.status(400).json({ message: "Receiver ID is required" });
  }

  try {
    // Check if chat already exists
    const existingChat = await prisma.chat.findFirst({
      where: {
        AND: [
          { userIDs: { has: tokenUserId } },
          { userIDs: { has: receiverId } }
        ]
      }
    });

    if (existingChat) {
      return res.status(200).json(existingChat);
    }

    // Create new chat
    const newChat = await prisma.chat.create({
      data: {
        userIDs: [tokenUserId, receiverId],
        seenBy: [tokenUserId]
      }
    });

    res.status(200).json(newChat);
  } catch (err) {
    console.error("Error in addChat:", err);
    res.status(500).json({ 
      message: "Failed to add chat!",
      error: err.message 
    });
  }
};

export const readChat = async (req, res) => {
  const tokenUserId = req.userId;
  
  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: req.params.id,
        userIDs: {
          has: tokenUserId
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found!" });
    }

    if (!chat.seenBy.includes(tokenUserId)) {
      await prisma.chat.update({
        where: { id: chat.id },
      data: {
        seenBy: {
            push: tokenUserId
          }
        }
      });
    }

    res.status(200).json(chat);
  } catch (err) {
    console.error("Error in readChat:", err);
    res.status(500).json({ 
      message: "Failed to read chat!",
      error: err.message 
    });
  }
};
