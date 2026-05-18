function errorHandler(error, _req, res, _next) {
  console.error(error);

  res.status(500).json({
    message: "Terjadi kesalahan pada server",
  });
}

function notfoundHandler(error, _req, _next) {
  console.error(error);

  res.status(404).json({
    message: "path yang anda cari tidak ditemukan",
  });
}

function unauthorizedHandler(error, _req, _next){
  console.error(error)
}

module.exports = errorHandler;
module.exports = notfoundHandler;
