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

  if (category_id === undefined || category_id === null) missingFields.push("category_id");
  if (!isFilledString(name)) missingFields.push("name");
  if (!isFilledString(address)) missingFields.push("address");
  if (latitude === undefined || latitude === null) missingFields.push("latitude");
  if (longitude === undefined || longitude === null) missingFields.push("longitude");
  if (!isFilledString(opening_time)) missingFields.push("opening_time");
  if (!isFilledString(closing_time)) missingFields.push("closing_time");

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Field wajib belum lengkap",
      missing_fields: missingFields,
    });
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const parsedCategoryId = Number(category_id);

  if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
    return res.status(400).json({
      message: "category_id tidak valid",
    });
  }

  if (!isValidCoordinate(parsedLatitude, -90, 90) || !isValidCoordinate(parsedLongitude, -180, 180)) {
    return res.status(400).json({
      message: "Koordinat latitude/longitude tidak valid",
    });
  }

  if (!isValidTime(opening_time) || !isValidTime(closing_time)) {
    return res.status(400).json({
      message: "Format jam harus HH:mm atau HH:mm:ss",
    });
  }

  if (req.body.rating !== undefined) {
    const parsedRating = Number(req.body.rating);

    if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) {
      return res.status(400).json({
        message: "Rating harus bernilai 0 sampai 5",
      });
    }
  }

  req.body.category_id = parsedCategoryId;
  req.body.latitude = parsedLatitude;
  req.body.longitude = parsedLongitude;

  next();
}

function isFilledString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidCoordinate(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

module.exports = validatePlace;
