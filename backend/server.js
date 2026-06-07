require("dotenv").config();

const express = require("express");
const cors = require("cors");

const placesRoutes = require("./routes/places");
const categoriesRoutes = require("./routes/categories");
const errorHandler = require("./middleware/errorHandler");
const { sendSuccess, sendError } = require("./utils/response");

const app = express();
const PORT = process.env.PORT || 3022;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  sendSuccess(res, "Direktori Bengkel API is running", {
    service: "direktori-bengkel-api",
  });
});

// API routes
app.use("/api/places", placesRoutes);
app.use("/api/categories", categoriesRoutes);

// 404 catch-all — must be AFTER all routes
app.use((_req, res) => {
  sendError(res, "Endpoint tidak ditemukan", 404);
});

// Error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
