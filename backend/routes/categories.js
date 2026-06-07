const express = require("express");

const {
  getCategories,
  addCategories,
  getCategoryById,
} = require("../controllers/categoriesController");
const requireAdmin = require("../middleware/requireAdmin");
const validateCategory = require("../middleware/validateCategory");

const router = express.Router();

router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.post("/", requireAdmin, validateCategory, addCategories);

module.exports = router;
