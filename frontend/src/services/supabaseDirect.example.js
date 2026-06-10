// // Direct Supabase data access example.

// // IMPORTANT:
// // This file is intentionally fully commented and is not imported anywhere.
// // The active project architecture must keep places/categories access through
// // the backend REST API, not directly from the mobile app.

// // Use this only as a reference for the old/direct approach or for discussion
// // in documentation. Never put SUPABASE_SERVICE_ROLE_KEY in frontend code.

// import { supabase } from "../lib/supabase";

// export async function fetchPlacesDirect(categoryId) {
//   let query = supabase
//     .from("places")
//     .select(`
//       id,
//       category_id,
//       name,
//       description,
//       latitude,
//       longitude,
//       photo_url,
//       created_at,
//       address,
//       phone,
//       opening_time,
//       closing_time,
//       rating,
//       google_maps_url,
//       categories (
//         name,
//         icon_name
//       )
//     `)
//     .order("name", { ascending: true });

//   if (categoryId) {
//     query = query.eq("category_id", categoryId);
//   }

//   const { data, error } = await query;

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data ?? [];
// }

// export async function fetchPlaceByIdDirect(id) {
//   const { data, error } = await supabase
//     .from("places")
//     .select(`
//       id,
//       category_id,
//       name,
//       description,
//       latitude,
//       longitude,
//       photo_url,
//       created_at,
//       address,
//       phone,
//       opening_time,
//       closing_time,
//       rating,
//       google_maps_url,
//       categories (
//         name,
//         icon_name
//       )
//     `)
//     .eq("id", id)
//     .single();

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data;
// }

// export async function fetchCategoriesDirect() {
//   const { data, error } = await supabase
//     .from("categories")
//     .select("id, name, icon_name")
//     .order("name", { ascending: true });

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data ?? [];
// }

// export async function createPlaceDirect(placeData) {
//   const { data, error } = await supabase
//     .from("places")
//     .insert({
//       category_id: placeData.category_id,
//       name: placeData.name,
//       description: placeData.description ?? null,
//       latitude: placeData.latitude,
//       longitude: placeData.longitude,
//       photo_url: placeData.photo_url ?? null,
//       address: placeData.address ?? null,
//       phone: placeData.phone ?? null,
//       opening_time: placeData.opening_time ?? null,
//       closing_time: placeData.closing_time ?? null,
//       rating: placeData.rating ?? null,
//       google_maps_url: placeData.google_maps_url ?? null,
//     })
//     .select()
//     .single();

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data;
// }

// export async function updatePlaceDirect(id, placeData) {
//   const { data, error } = await supabase
//     .from("places")
//     .update(placeData)
//     .eq("id", id)
//     .select()
//     .single();

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data;
// }

// export async function deletePlaceDirect(id) {
//   const { error } = await supabase
//     .from("places")
//     .delete()
//     .eq("id", id);

//   if (error) {
//     throw new Error(error.message);
//   }

//   return true;
// }
