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
  origin: process.env.CLIENT_URL,
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
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("newUser", (userId) => {
    console.log("User connected:", userId);
    // Store the user ID and socket ID mapping (you might need a way to map multiple sockets per user if needed)
    // Example: users[userId] = socket.id;
    // This part depends on how you manage users and sockets
  });

  socket.on("sendMessage", ({ receiverId, data }) => {
    console.log("Message received for receiver:", receiverId, "data:", data);
    // Find the receiver's socket ID and emit the message
    // Example: io.to(users[receiverId]).emit("getMessage", data);
    // This also depends on your user-socket mapping
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Remove the user from your active users list if you maintain one
  });
});

app.get("/", (req, res) => {
  res.send("API is running!");
});

const PORT = process.env.PORT || 8800;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
