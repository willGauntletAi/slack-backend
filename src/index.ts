import express from "express";
import cors from "cors";
import "dotenv/config";
import { env } from "./env";

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import workspaceRoutes from "./routes/workspaces";
import channelRoutes from "./routes/channels";
import messageRoutes from "./routes/messages";
import dmRoutes from "./routes/dm";

const app = express();
const port = env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/channels', channelRoutes);
app.use('/messages', messageRoutes);
app.use('/dm', dmRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
