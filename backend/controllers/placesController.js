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
      query = query.eq("category_id", categoryId);
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
    const selectStr = await buildSelect();
    const { data, error } = await supabase
      .from("places")
      .select(selectStr)
      .eq("id", req.params.id)
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
    // Filter body to only include columns that exist
    const cols = await detectColumns();
    const insertData = {};
    for (const key of Object.keys(req.body)) {
      if (cols.includes(key) || key === "category_id") {
        insertData[key] = req.body[key];
      }
    }

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
    // Filter body to only include columns that exist
    const cols = await detectColumns();
    const updateData = {};
    for (const key of Object.keys(req.body)) {
      if (cols.includes(key) || key === "category_id") {
        updateData[key] = req.body[key];
      }
    }

    const selectStr = await buildSelect();
    const { data, error } = await supabase
      .from("places")
      .update(updateData)
      .eq("id", req.params.id)
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
    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", req.params.id);

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

module.exports = {
  getPlaces,
  getPlaceById,
  createPlace,
  updatePlace,
  deletePlace,
};
