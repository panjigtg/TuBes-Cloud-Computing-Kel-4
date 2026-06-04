require("dotenv").config();

const express = require("express");
const cors = require("cors");

const placesRoutes = require("./routes/places");
const categoriesRoutes = require("./routes/categories");
const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3022;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Direktori Bengkel API is running",
  });
});

app.use("/api/places", placesRoutes);
app.use("/api/categories", categoriesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
