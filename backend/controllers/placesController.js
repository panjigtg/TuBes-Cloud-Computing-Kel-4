const supabase = require("../db/supabase");
const { sendSuccess, sendError } = require("../utils/response");

// Kolom dasar yang pasti ada di tabel places
const BASE_COLUMNS = [
  "id",
  "category_id",
  "name",
  "description",
  "latitude",
  "longitude",
  "photo_url",
  "created_at",
];

// Kolom tambahan yang mungkin belum ada (setelah migration)
const EXTRA_COLUMNS = [
  "address",
  "phone",
  "opening_time",
  "closing_time",
  "rating",
  "google_maps_url",
];

const PLACE_WRITE_COLUMNS = [
  "category_id",
  "name",
  "description",
  "latitude",
  "longitude",
  "photo_url",
  "address",
  "phone",
  "opening_time",
  "closing_time",
  "rating",
  "google_maps_url",
];

// Cache: kolom mana saja yang tersedia di DB
let availableColumns = null;

async function detectColumns() {
  if (availableColumns) return availableColumns;

  // Coba query satu row dengan semua kolom
  const allCols = [...BASE_COLUMNS, ...EXTRA_COLUMNS];
  const { error } = await supabase
    .from("places")
    .select(allCols.join(", "))
    .limit(1);

  if (!error) {
    availableColumns = allCols;
  } else {
    // Fallback: hanya pakai base columns
    availableColumns = [...BASE_COLUMNS];

    // Coba tambahkan extra columns satu per satu
    for (const col of EXTRA_COLUMNS) {
      const { error: colErr } = await supabase
        .from("places")
        .select(col)
        .limit(1);
      if (!colErr) {
        availableColumns.push(col);
      }
    }
  }

  console.log("Detected place columns:", availableColumns.join(", "));
  return availableColumns;
}

async function buildSelect() {
  const cols = await detectColumns();
  return `${cols.join(", ")}, categories(name, icon_name)`;
}

async function getPlaces(req, res, next) {
  try {
    const categoryId = req.query.category;
    const selectStr = await buildSelect();

    let query = supabase
      .from("places")
      .select(selectStr)
      .order("name", { ascending: true });

    if (categoryId) {
      const parsedCategoryId = parseResourceId(categoryId);
      if (!parsedCategoryId) {
        return sendError(res, "category harus berupa UUID", 400);
      }
      query = query.eq("category_id", parsedCategoryId);
    }

    const { data, error } = await query;

    if (error) {
      if (isInvalidIdError(error)) {
        return sendError(
          res,
          "category harus sesuai dengan tipe ID di database",
          400
        );
      }
      throw error;
    }

    sendSuccess(res, "Data places berhasil ditemukan", data.map(formatPlace));
  } catch (error) {
    next(error);
  }
}

async function getPlaceById(req, res, next) {
  try {
    const placeId = parseResourceId(req.params.id);
    if (!placeId) {
      return sendError(res, "ID place harus berupa UUID", 400);
    }

    const selectStr = await buildSelect();
    const { data, error } = await supabase
      .from("places")
      .select(selectStr)
      .eq("id", placeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return sendError(res, "Place tidak ditemukan", 404);
      }
      if (isInvalidIdError(error)) {
        return sendError(
          res,
          "ID place tidak sesuai dengan tipe ID di database",
          400
        );
      }
      throw error;
    }

    sendSuccess(res, "Data place berhasil ditemukan", formatPlace(data));
  } catch (error) {
    next(error);
  }
}

async function createPlace(req, res, next) {
  try {
    const cols = await detectColumns();
    const insertData = pickWritablePlaceFields(req.validatedBody ?? req.body, cols);

    const selectStr = await buildSelect();
    const { data, error } = await supabase
      .from("places")
      .insert(insertData)
      .select(selectStr)
      .single();

    if (error) {
      throw error;
    }

    sendSuccess(res, "Place berhasil ditambahkan", formatPlace(data), 201);
  } catch (error) {
    next(error);
  }
}

async function updatePlace(req, res, next) {
  try {
    const placeId = parseResourceId(req.params.id);
    if (!placeId) {
      return sendError(res, "ID place harus berupa UUID", 400);
    }

    const cols = await detectColumns();
    const updateData = pickWritablePlaceFields(req.validatedBody ?? req.body, cols);

    if (Object.keys(updateData).length === 0) {
      return sendError(res, "Tidak ada field yang dapat diubah", 400);
    }

    const selectStr = await buildSelect();
    const { data, error } = await supabase
      .from("places")
      .update(updateData)
      .eq("id", placeId)
      .select(selectStr)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return sendError(res, "Place tidak ditemukan", 404);
      }
      if (isInvalidIdError(error)) {
        return sendError(
          res,
          "ID place tidak sesuai dengan tipe ID di database",
          400
        );
      }
      throw error;
    }

    sendSuccess(res, "Place berhasil diperbarui", formatPlace(data));
  } catch (error) {
    next(error);
  }
}

async function deletePlace(req, res, next) {
  try {
    const placeId = parseResourceId(req.params.id);
    if (!placeId) {
      return sendError(res, "ID place harus berupa UUID", 400);
    }

    const { data: existingPlace, error: findError } = await supabase
      .from("places")
      .select("id")
      .eq("id", placeId)
      .single();

    if (findError) {
      if (findError.code === "PGRST116") {
        return sendError(res, "Place tidak ditemukan", 404);
      }
      if (isInvalidIdError(findError)) {
        return sendError(
          res,
          "ID place tidak sesuai dengan tipe ID di database",
          400
        );
      }
      throw findError;
    }

    if (!existingPlace) {
      return sendError(res, "Place tidak ditemukan", 404);
    }

    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", placeId);

    if (error) {
      throw error;
    }

    sendSuccess(res, "Place berhasil dihapus", null);
  } catch (error) {
    next(error);
  }
}

function formatPlace(place) {
  return {
    id: place.id,
    name: place.name,
    category_id: place.category_id,
    category_name: place.categories?.name ?? null,
    icon_name: place.categories?.icon_name ?? null,
    address: place.address ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    description: place.description,
    phone: place.phone ?? null,
    opening_time: place.opening_time ?? null,
    closing_time: place.closing_time ?? null,
    photo_url: place.photo_url,
    rating: place.rating ?? null,
    google_maps_url: place.google_maps_url ?? null,
    created_at: place.created_at,
  };
}

function parseResourceId(value) {
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

function isInvalidIdError(error) {
  return error?.code === "22P02";
}

function pickWritablePlaceFields(body, availableDbColumns) {
  const availableColumnSet = new Set(availableDbColumns);
  const picked = {};

  for (const field of PLACE_WRITE_COLUMNS) {
    if (
      Object.prototype.hasOwnProperty.call(body, field) &&
      availableColumnSet.has(field)
    ) {
      picked[field] = body[field];
    }
  }

  return picked;
}

module.exports = {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
};
