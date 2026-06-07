const { sendError } = require("../utils/response");

const CATEGORY_ALLOWED_FIELDS = new Set(["name", "icon_name"]);

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

function validateCategory(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendError(res, "Body JSON tidak valid", 400);
  }

  const unknownFields = Object.keys(req.body).filter(
    (field) => !CATEGORY_ALLOWED_FIELDS.has(field)
  );

  if (unknownFields.length > 0) {
    return sendError(res, "Field tidak diizinkan", 400, {
      unknown_fields: unknownFields,
    });
  }

  const name = normalizeOptionalString(req.body.name);

  if (!name) {
    return sendError(res, "Field wajib belum lengkap", 400, {
      missing_fields: ["name"],
    });
  }

  if (name.length > 100) {
    return sendError(res, "Nama kategori maksimal 100 karakter", 400);
  }

  const iconName = normalizeOptionalString(req.body.icon_name);

  if (iconName && iconName.length > 100) {
    return sendError(res, "Nama icon maksimal 100 karakter", 400);
  }

  req.validatedBody = {
    name,
    icon_name: iconName,
  };

  next();
}

module.exports = validateCategory;
