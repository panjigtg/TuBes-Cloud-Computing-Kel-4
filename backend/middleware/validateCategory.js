const CATEGORY_ALLOWED_FIELDS = new Set(["name", "icon_name"]);

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

function validateCategory(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({
      message: "Body JSON tidak valid",
    });
  }

  const unknownFields = Object.keys(req.body).filter(
    (field) => !CATEGORY_ALLOWED_FIELDS.has(field)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      message: "Field tidak diizinkan",
      unknown_fields: unknownFields,
    });
  }

  const name = normalizeOptionalString(req.body.name);

  if (!name) {
    return res.status(400).json({
      message: "Field wajib belum lengkap",
      missing_fields: ["name"],
    });
  }

  if (name.length > 100) {
    return res.status(400).json({
      message: "Nama kategori maksimal 100 karakter",
    });
  }

  const iconName = normalizeOptionalString(req.body.icon_name);

  if (iconName && iconName.length > 100) {
    return res.status(400).json({
      message: "Nama icon maksimal 100 karakter",
    });
  }

  req.validatedBody = {
    name,
    icon_name: iconName,
  };

  next();
}

module.exports = validateCategory;
