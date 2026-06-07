const supabase = require("../db/supabase");
const { sendSuccess, sendError } = require("../utils/response");

async function getCategories(_req, res, next) {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon_name")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    sendSuccess(res, "Data kategori berhasil ditemukan", data);
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
      return sendError(res, "Category already exists", 409);
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

    sendSuccess(res, "Category berhasil ditambahkan", data, 201);
  } catch (error) {
    next(error);
  }
}

async function getCategoryById(req, res, next) {
  try {
    const categoryId = parseResourceId(req.params.id);
    if (!categoryId) {
      return sendError(res, "ID category harus berupa UUID", 400);
    }

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon_name")
      .eq("id", categoryId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return sendError(res, "Category not found", 404);
      }
      if (isInvalidIdError(error)) {
        return sendError(
          res,
          "ID category tidak sesuai dengan tipe ID di database",
          400
        );
      }

      throw error;
    }

    sendSuccess(res, "Data category berhasil ditemukan", data);
  } catch (error) {
    next(error);
  }
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

module.exports = {
  getCategories,
  addCategories,
  getCategoryById,
};
