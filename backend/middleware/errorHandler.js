function notFoundHandler(_req, res) {
  res.status(404).json({
    message: "Path tidak ditemukan",
  });
}

function errorHandler(error, _req, res, _next) {
  console.error(error);

  res.status(500).json({
    message: "Terjadi kesalahan pada server",
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
