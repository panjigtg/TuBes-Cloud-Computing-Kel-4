const { sendError } = require("../utils/response");

const PLACE_ALLOWED_FIELDS = new Set([
  "category_id",
  "name",
  "address",
  "latitude",
  "longitude",
  "description",
  "phone",
  "opening_time",
  "closing_time",
  "photo_url",
  "rating",
  "google_maps_url",
]);

const REQUIRED_CREATE_FIELDS = ["category_id", "name", "latitude", "longitude"];

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function normalizeResourceId(value) {
  const stringValue = String(value ?? "").trim();

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      stringValue
    )
  ) {
    return stringValue;
  }

  return null;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function validatePlacePayload(req, res, next, { partial }) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, "Body JSON tidak valid", 400);
  }

  const unknownFields = Object.keys(req.body).filter(
    (field) => !PLACE_ALLOWED_FIELDS.has(field)
  );

  if (unknownFields.length > 0) {
    return sendError(res, "Field tidak diizinkan", 400, {
      unknown_fields: unknownFields,
    });
  }

  if (partial && Object.keys(req.body).length === 0) {
    return sendError(res, "Minimal satu field harus dikirim", 400);
  }

  const missingFields = partial
    ? []
    : REQUIRED_CREATE_FIELDS.filter((field) => {
        const value = req.body[field];
        return value === undefined || value === null || value === "";
      });

  if (missingFields.length > 0) {
    return sendError(res, "Field wajib belum lengkap", 400, {
      missing_fields: missingFields,
    });
  }

  const sanitized = {};

  if (req.body.category_id !== undefined) {
    const categoryId = normalizeResourceId(req.body.category_id);
    if (!categoryId) {
      return sendError(res, "category_id harus berupa UUID", 400);
    }
    sanitized.category_id = categoryId;
  }

  if (req.body.name !== undefined) {
    const name = normalizeOptionalString(req.body.name);
    if (!name) {
      return sendError(res, "Nama bengkel wajib diisi", 400);
    }
    if (name.length > 255) {
      return sendError(res, "Nama bengkel maksimal 255 karakter", 400);
    }
    sanitized.name = name;
  }

  for (const field of ["latitude", "longitude"]) {
    if (req.body[field] === undefined) continue;

    const value = normalizeNumber(req.body[field]);
    const min = field === "latitude" ? -90 : -180;
    const max = field === "latitude" ? 90 : 180;

    if (value === null || value < min || value > max) {
      return sendError(res, "Koordinat latitude/longitude tidak valid", 400);
    }

    sanitized[field] = value;
  }

  if (req.body.rating !== undefined) {
    const rating = normalizeNumber(req.body.rating);
    if (rating === null || rating < 0 || rating > 5) {
      return sendError(res, "Rating harus berada di antara 0 sampai 5", 400);
    }
    sanitized.rating = Math.round(rating * 10) / 10;
  }

  const stringLimits = {
    address: 500,
    description: 2000,
    phone: 20,
  };

  for (const [field, maxLength] of Object.entries(stringLimits)) {
    if (req.body[field] === undefined) continue;

    const value = normalizeOptionalString(req.body[field]);
    if (value && value.length > maxLength) {
      return sendError(res, `${field} maksimal ${maxLength} karakter`, 400);
    }
    sanitized[field] = value;
  }

  for (const field of ["opening_time", "closing_time"]) {
    if (req.body[field] === undefined) continue;

    const value = normalizeOptionalString(req.body[field]);
    if (value && !isValidTime(value)) {
      return sendError(res, `${field} harus menggunakan format HH:MM`, 400);
    }
    sanitized[field] = value;
  }

  for (const field of ["photo_url", "google_maps_url"]) {
    if (req.body[field] === undefined) continue;

    const value = normalizeOptionalString(req.body[field]);
    if (value && !isValidHttpUrl(value)) {
      return sendError(res, `${field} harus berupa URL http/https yang valid`, 400);
    }
    sanitized[field] = value;
  }

  req.validatedBody = sanitized;
  next();
}

function validateCreatePlace(req, res, next) {
  validatePlacePayload(req, res, next, { partial: false });
}

function validateUpdatePlace(req, res, next) {
  validatePlacePayload(req, res, next, { partial: true });
}

module.exports = {
  PLACE_ALLOWED_FIELDS,
  validateCreatePlace,
  validateUpdatePlace,
};
