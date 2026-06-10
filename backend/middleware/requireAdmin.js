const crypto = require("crypto");
const supabase = require("../db/supabase");
const { sendError } = require("../utils/response");

function safeCompare(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (valueBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function getBearerToken(req) {
  const authorization = req.get("authorization");

  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");

  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function hasAdminMetadata(user) {
  const appMetadata = user.app_metadata || {};
  const userMetadata = user.user_metadata || {};

  return (
    appMetadata.role === "admin" ||
    appMetadata.is_admin === true ||
    userMetadata.role === "admin" ||
    userMetadata.is_admin === true
  );
}

function isAdminUser(user) {
  const adminEmails = getAdminEmails();
  const email = user.email?.toLowerCase();

  if (adminEmails.length > 0) {
    return Boolean(email && adminEmails.includes(email));
  }

  return hasAdminMetadata(user);
}

function allowApiKeyFallback(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const providedKey = req.get("x-admin-api-key");

  if (!configuredKey || !providedKey || !safeCompare(providedKey, configuredKey)) {
    return false;
  }

  req.admin = { type: "api-key" };
  next();
  return true;
}

async function requireAdmin(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    if (allowApiKeyFallback(req, res, next)) return;
    return sendError(res, "Token admin tidak tersedia", 401);
  }

  let authResult;

  try {
    authResult = await supabase.auth.getUser(token);
  } catch (error) {
    return sendError(res, "Gagal memverifikasi token admin", 500);
  }

  const user = authResult.data?.user;

  if (authResult.error || !user) {
    return sendError(res, "Token admin tidak valid", 401);
  }

  if (!isAdminUser(user)) {
    return sendError(res, "User tidak memiliki akses admin", 403);
  }

  req.admin = {
    type: "supabase",
    id: user.id,
    email: user.email,
  };

  next();
}

module.exports = requireAdmin;
