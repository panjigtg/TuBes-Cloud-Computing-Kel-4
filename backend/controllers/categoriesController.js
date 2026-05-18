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

module.exports = {
  getCategories,
};
