import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("BACKEND_URL environment variable is required");
}

// Forward API requests to the existing backend.
app.use("/api", async (req, res) => {
  try {
    const targetUrl = new URL(req.originalUrl, BACKEND_URL);

    const headers = { ...req.headers };
    delete headers.host;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      duplex: "half",
      redirect: "manual",
    });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    if (!response.body) {
      return res.end();
    }

    for await (const chunk of response.body) {
      res.write(Buffer.from(chunk));
    }

    res.end();
  } catch (error) {
    console.error("API proxy error:", error);
    if (!res.headersSent) {
      res.status(502).json({ message: "Backend unavailable" });
    } else {
      res.end();
    }
  }
});

// Serve the built Vite frontend.
app.use(express.static(path.join(__dirname, "dist")));

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend server listening on port ${PORT}`);
});
