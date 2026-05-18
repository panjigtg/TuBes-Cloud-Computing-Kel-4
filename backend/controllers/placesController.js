const supabase = require("../db/supabase");

async function getPlaces(req, res, next) {
  try {
    const categoryId = req.query.category;

    let query = supabase
      .from("places")
      .select(`
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
      `)
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
    const { data, error } = await supabase
      .from("places")
      .select(`
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
      `)
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
    const { data, error } = await supabase
      .from("places")
      .insert(req.body)
      .select(`
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
      `)
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

module.exports = {
  getPlaces,
  getPlaceById,
  createPlace,
};
