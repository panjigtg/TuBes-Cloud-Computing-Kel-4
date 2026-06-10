/**
 * API Service Layer
 *
 * Semua komunikasi data places/categories melalui backend API.
 * Supabase client tetap digunakan HANYA untuk:
 *   - Auth (login admin)
 *   - Storage (upload foto)
 */

import { supabase } from "../lib/supabase";

// Production (Vercel)
const API_BASE_URL = "https://bengkelbrainrot.vercel.app/api";
// Ganti dengan URL ini saat production (setelah deploy ke Render):
// const API_BASE_URL = "https://your-render-url.onrender.com/api";

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const authHeaders = await getAuthHeaders();

    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers,
      },
    });

    // Handle non-JSON errors (e.g. 502 from proxy)
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
    }

    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.message || `Request failed: ${res.status}`);
    }

    if (
      payload &&
      typeof payload === "object" &&
      Object.prototype.hasOwnProperty.call(payload, "status") &&
      Object.prototype.hasOwnProperty.call(payload, "data")
    ) {
      return payload.data;
    }

    return payload;
  } catch (error) {
    // Network error or JSON parse error
    if (error.message === "Network request failed") {
      throw new Error(
        "Tidak dapat terhubung ke server. Pastikan backend berjalan."
      );
    }
    throw error;
  }
}

export async function fetchPlaces(categoryId) {
  const query = categoryId ? `?category=${categoryId}` : "";
  return request(`/places${query}`);
}

export async function fetchPlaceById(id) {
  return request(`/places/${id}`);
}

export async function createPlace(placeData) {
  return request("/places", {
    method: "POST",
    body: JSON.stringify(placeData),
  });
}

export async function updatePlace(id, placeData) {
  return request(`/places/${id}`, {
    method: "PUT",
    body: JSON.stringify(placeData),
  });
}

export async function deletePlace(id) {
  return request(`/places/${id}`, {
    method: "DELETE",
  });
}

export async function fetchCategories() {
  return request("/categories");
}

export async function fetchCategoryById(id) {
  return request(`/categories/${id}`);
}

export async function createCategory(categoryData) {
  return request("/categories", {
    method: "POST",
    body: JSON.stringify(categoryData),
  });
}
