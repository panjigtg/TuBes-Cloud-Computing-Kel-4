function validatePlace(req, res, next) {
  const {
    category_id,
    name,
    address,
    latitude,
    longitude,
    opening_time,
    closing_time,
  } = req.body;

  const missingFields = [];

  if (!category_id) missingFields.push("category_id");
  if (!name) missingFields.push("name");
  if (!address) missingFields.push("address");
  if (latitude === undefined) missingFields.push("latitude");
  if (longitude === undefined) missingFields.push("longitude");
  if (!opening_time) missingFields.push("opening_time");
  if (!closing_time) missingFields.push("closing_time");

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Field wajib belum lengkap",
      missing_fields: missingFields,
    });
  }

  if (
    typeof latitude !== "number" ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      message: "Koordinat latitude/longitude tidak valid",
    });
  }

  next();
}

module.exports = validatePlace;
