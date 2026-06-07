const { sendError } = require("../utils/response");

function errorHandler(error, _req, res, _next) {
  console.error(error);

  sendError(res, "Terjadi kesalahan pada server", 500);
}

module.exports = errorHandler;
