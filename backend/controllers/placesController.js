const supabase = require("../db/supabase");

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
      const parsedCategoryId = parsePositiveInteger(categoryId);
      if (!parsedCategoryId) {
        return res.status(400).json({
          message: "category harus berupa angka positif",
        });
      }
      query = query.eq("category_id", parsedCategoryId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json(data.map(formatPlace));
  } catch (error) {
    next(error);
  }
}

async function getPlaceById(req, res, next) {
  try {
    const placeId = parsePositiveInteger(req.params.id);
    if (!placeId) {
      return res.status(400).json({
        message: "ID place tidak valid",
      });
    }

    const selectStr = await buildSelect();
    const { data, error } = await supabase
      .from("places")
      .select(selectStr)
      .eq("id", placeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ message: "Place tidak ditemukan" });
      }
      throw error;
    }

    res.json(formatPlace(data));
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

    res.status(201).json(formatPlace(data));
  } catch (error) {
    next(error);
  }
}

async function updatePlace(req, res, next) {
  try {
    const placeId = parsePositiveInteger(req.params.id);
    if (!placeId) {
      return res.status(400).json({
        message: "ID place tidak valid",
      });
    }

    const cols = await detectColumns();
    const updateData = pickWritablePlaceFields(req.validatedBody ?? req.body, cols);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "Tidak ada field yang dapat diubah",
      });
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
        return res.status(404).json({ message: "Place tidak ditemukan" });
      }
      throw error;
    }

    res.json(formatPlace(data));
  } catch (error) {
    next(error);
  }
}

async function deletePlace(req, res, next) {
  try {
    const placeId = parsePositiveInteger(req.params.id);
    if (!placeId) {
      return res.status(400).json({
        message: "ID place tidak valid",
      });
    }

    const { data: existingPlace, error: findError } = await supabase
      .from("places")
      .select("id")
      .eq("id", placeId)
      .single();

    if (findError) {
      if (findError.code === "PGRST116") {
        return res.status(404).json({ message: "Place tidak ditemukan" });
      }
      throw findError;
    }

    if (!existingPlace) {
      return res.status(404).json({ message: "Place tidak ditemukan" });
    }

    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", placeId);

    if (error) {
      throw error;
    }

    res.json({ message: "Place berhasil dihapus" });
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

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
