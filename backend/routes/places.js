const express = require("express");

const {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
} = require("../controllers/placesController");
const requireAdmin = require("../middleware/requireAdmin");
const {
  validateCreatePlace,
  validateUpdatePlace,
} = require("../middleware/validatePlace");

const router = express.Router();

router.get("/", getPlaces);
router.get("/:id", getPlaceById);
router.post("/", requireAdmin, validateCreatePlace, createPlace);
router.put("/:id", requireAdmin, validateUpdatePlace, updatePlace);
router.delete("/:id", requireAdmin, deletePlace);

module.exports = router;
