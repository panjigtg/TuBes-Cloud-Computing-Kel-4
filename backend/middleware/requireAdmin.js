const crypto = require("crypto");
const { sendError } = require("../utils/response");

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
    return sendError(res, "Konfigurasi admin API belum tersedia", 500);
  }

  const providedKey = req.get("x-admin-api-key");

  if (!providedKey || !safeCompare(providedKey, configuredKey)) {
    return sendError(res, "Admin API key tidak valid", 401);
  }

  req.admin = true;
  next();
}

module.exports = requireAdmin;
