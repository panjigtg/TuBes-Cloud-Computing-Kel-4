require("dotenv").config();

const express = require("express");
const cors = require("cors");

const placesRoutes = require("./routes/places");
const categoriesRoutes = require("./routes/categories");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3022;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Direktori Bengkel API is running",
  });
});

// API routes
app.use("/api/places", placesRoutes);
app.use("/api/categories", categoriesRoutes);

// 404 catch-all — must be AFTER all routes
app.use((_req, res) => {
  res.status(404).json({
    message: "Endpoint tidak ditemukan",
  });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
