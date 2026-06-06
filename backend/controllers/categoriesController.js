const supabase = require("../db/supabase");

async function getCategories(_req, res, next) {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon_name")
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
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("name", req.body.name)
      .single();

    if (existing) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: req.body.name,
        icon_name: req.body.icon_name,
      })
      .select("id, name, icon_name")
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
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon_name")
      .eq("id", req.params.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          message: "Category not found",
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
