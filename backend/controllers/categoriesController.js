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
    const categoryData = req.validatedBody ?? req.body;
    const { data: existing, error: findError } = await supabase
      .from("categories")
      .select("id")
      .eq("name", categoryData.name)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existing) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: categoryData.name,
        icon_name: categoryData.icon_name,
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
    const categoryId = parsePositiveInteger(req.params.id);
    if (!categoryId) {
      return res.status(400).json({
        message: "ID category tidak valid",
      });
    }

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon_name")
      .eq("id", categoryId)
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

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  getCategories,
  addCategories,
  getCategoryById,
};
