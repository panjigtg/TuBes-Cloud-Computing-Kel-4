const express = require("express");

const {
  getCategories,
  addCategories,
  getCategoryById,
} = require("../controllers/categoriesController");

const router = express.Router();

router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.post("/", addCategories);

module.exports = router;
