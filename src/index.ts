import express from "express";
import cors from "cors";
import "dotenv/config";
import { env } from "./env";

const app = express();
const port = env.PORT;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
