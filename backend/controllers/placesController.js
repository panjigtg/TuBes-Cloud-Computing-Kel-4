const supabase = require("../db/supabase");

const PLACE_SELECT = `
  id,
  category_id,
  categories(name),
  name,
  address,
  latitude,
  longitude,
  description,
  phone,
  opening_time,
  closing_time,
  photo_url,
  rating
`;

async function getPlaces(req, res, next) {
  try {
    const categoryId = req.query.category;

    let query = supabase
      .from("places")
      .select(PLACE_SELECT)
      .order("name", { ascending: true });

    if (categoryId) {
      const parsedCategoryId = Number(categoryId);

      if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
        return res.status(400).json({
          message: "Query category tidak valid",
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
    const placeId = Number(req.params.id);

    if (!Number.isInteger(placeId) || placeId <= 0) {
      return res.status(400).json({
        message: "ID place tidak valid",
      });
    }

    const { data, error } = await supabase
      .from("places")
      .select(PLACE_SELECT)
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
    const payload = buildPlacePayload(req.body);

    const { data, error } = await supabase
      .from("places")
      .insert(payload)
      .select(PLACE_SELECT)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(formatPlace(data));
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
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    description: place.description,
    phone: place.phone,
    opening_time: place.opening_time,
    closing_time: place.closing_time,
    photo_url: place.photo_url,
    rating: place.rating,
  };
}

function buildPlacePayload(body) {
  return {
    category_id: body.category_id,
    name: body.name.trim(),
    address: body.address.trim(),
    latitude: body.latitude,
    longitude: body.longitude,
    description: body.description?.trim() || null,
    phone: body.phone?.trim() || null,
    opening_time: body.opening_time,
    closing_time: body.closing_time,
    photo_url: body.photo_url?.trim() || null,
    rating: body.rating === undefined ? null : Number(body.rating),
  };
}

module.exports = {
  getPlaces,
  getPlaceById,
  createPlace,
};
