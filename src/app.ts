// app.ts
import express from "express";
import dotenv from "dotenv";
import messageRoute from "./routes/messageRoute.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set("trust proxy", true);

// Twilio sends application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// Routes
app.use(messageRoute);

app.get("/health", (_req, res) => res.send("ok"));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
