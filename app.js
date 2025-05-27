import 'dotenv/config';
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoute from "./routes/auth.route.js";
import postRoute from "./routes/post.route.js";
import testRoute from "./routes/test.route.js";
import userRoute from "./routes/user.route.js";
import chatRoute from "./routes/chat.route.js";
import messageRoute from "./routes/message.route.js";
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);

// Log environment variables (for debugging)
console.log("Environment variables loaded:");
console.log("CLIENT_URL:", process.env.CLIENT_URL);
console.log("JWT_SECRET_KEY:", process.env.JWT_SECRET_KEY ? "Set" : "Not Set");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not Set");

// CORS configuration
const corsOptions = {
  origin: [process.env.CLIENT_URL, 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};

console.log("CORS configuration:", corsOptions);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    cookies: req.cookies,
    headers: req.headers
  });
  next();
});

app.use("/api/auth", authRoute);
app.use("/api/posts", postRoute);
app.use("/api/test", testRoute);
app.use("/api/users", userRoute);
app.use("/api/chats", chatRoute);
app.use("/api/messages", messageRoute);

const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL, 'http://localhost:5173'],
    credentials: true
  }
});

const users = {};

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("newUser", (userId) => {
    console.log("User connected:", userId);
    users[userId] = socket.id;
  });

  socket.on("sendMessage", ({ receiverId, data }) => {
    console.log("Message received for receiver:", receiverId, "data:", data);
    const receiverSocketId = users[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getMessage", data);
    } else {
      console.log("Receiver not connected:", receiverId);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    for (const [userId, id] of Object.entries(users)) {
      if (id === socket.id) {
        delete users[userId];
        break;
      }
    }
  });
});

app.get("/", (req, res) => {
  res.send("API is running!");
});

const PORT = process.env.PORT || 8800;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
