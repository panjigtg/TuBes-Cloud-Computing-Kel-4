const supabase = require("../db/supabase");

async function getCategories(_req, res, next) {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function addCategories(req, res, next) {
  try {
    const name = req.body.name?.trim();
    const icon = req.body.icon?.trim() || null;

    if (!name) {
      return res.status(400).json({
        message: "Field name wajib diisi",
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return res.status(409).json({
        message: "Kategori sudah ada",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name,
        icon,
      })
      .select("id, name, icon")
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function getCategoryById(req, res, next) {
  try {
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        message: "ID kategori tidak valid",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon")
      .eq("id", categoryId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          message: "Kategori tidak ditemukan",
        });
      }

      throw error;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
}


module.exports = {
  getCategories,
  addCategories,
  getCategoryById,
};
