const express = require("express");

const {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
} = require("../controllers/placesController");
const validatePlace = require("../middleware/validatePlace");

const router = express.Router();

router.get("/", getPlaces);
router.get("/:id", getPlaceById);
router.post("/", validatePlace, createPlace);
router.put("/:id", updatePlace);
router.delete("/:id", deletePlace);

module.exports = router;
