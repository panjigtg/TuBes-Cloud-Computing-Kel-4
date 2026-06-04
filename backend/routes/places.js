const express = require("express");

const {
  getPlaces,
  getPlaceById,
  createPlace,
} = require("../controllers/placesController");
const validatePlace = require("../middleware/validatePlace");

const router = express.Router();

router.get("/", getPlaces);
router.get("/:id", getPlaceById);
router.post("/", validatePlace, createPlace);

module.exports = router;
