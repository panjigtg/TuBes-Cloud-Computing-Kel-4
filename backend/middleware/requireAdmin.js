const crypto = require("crypto");

function safeCompare(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function requireAdmin(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    return res.status(500).json({
      message: "Konfigurasi admin API belum tersedia",
    });
  }

  const providedKey = req.get("x-admin-api-key");

  if (!providedKey || !safeCompare(providedKey, configuredKey)) {
    return res.status(401).json({
      message: "Admin API key tidak valid",
    });
  }

  req.admin = true;
  next();
}

module.exports = requireAdmin;
