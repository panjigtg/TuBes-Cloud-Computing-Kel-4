/**
 * Seed script — parse CSV and populate Supabase with bengkel data.
 *
 * PREREQUISITES:
 *   1. Jalankan migration_add_columns.sql di Supabase Dashboard terlebih dahulu
 *   2. npm install (dari folder database/)
 *
 * Usage:
 *   cd database
 *   node seed.js
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://pzoavdnqrqvvjibunnhk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2F2ZG5xcnF2dmppYnVubmhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDEzMzc4MywiZXhwIjoyMDk1NzA5NzgzfQ.MqfwgZr-Bk-sTka3hQmoCTeR4fiKim-bGGHXbq0OZXs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Category mapping (names must match existing categories in Supabase) ──────
const CATEGORY_NAMES = {
  "Bengkel Motor": true,
  "Bengkel Mobil": true,
  "Tambal Ban": true,
  "Service Resmi": true, // could be "Bengkel Resmi" in DB
  "Bengkel Resmi": true,
  "Bengkel Umum": true,
};

function determineCategory(types, querySource, name) {
  const typesLower = (types || "").toLowerCase();
  const queryLower = (querySource || "").toLowerCase();
  const nameLower = (name || "").toLowerCase();

  // Tambal ban
  if (
    typesLower.includes("tire_shop") ||
    queryLower.includes("tambal ban") ||
    nameLower.includes("tambal ban") ||
    nameLower.includes("ban ") ||
    nameLower.includes("tubeless") ||
    nameLower.includes("tubles") ||
    nameLower.includes("tiptop") ||
    nameLower.includes("tip-top") ||
    nameLower.includes("nitrogen")
  ) {
    return "Tambal Ban";
  }

  // Bengkel resmi (AHASS, etc)
  if (
    nameLower.includes("ahass") ||
    nameLower.includes("resmi") ||
    nameLower.includes("dealer")
  ) {
    return "Bengkel Resmi";
  }

  // Bengkel mobil
  if (
    queryLower.includes("bengkel mobil") ||
    nameLower.includes("mobil") ||
    nameLower.includes("car ") ||
    nameLower.includes("ac mobil") ||
    nameLower.includes("salon mobil") ||
    nameLower.includes("tune up") ||
    nameLower.includes("spooring")
  ) {
    return "Bengkel Mobil";
  }

  // Bengkel motor / service motor
  if (
    queryLower.includes("bengkel motor") ||
    queryLower.includes("service motor") ||
    nameLower.includes("motor")
  ) {
    return "Bengkel Motor";
  }

  // Default
  return "Bengkel Umum";
}

// ── CSV Parser (handles quoted fields with commas) ───────────────────────────
function parseCSV(csvText) {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else if (ch === "\r") {
      // skip carriage return
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Memulai seed database...\n");

  // 1. Read CSV
  const csvPath = path.join(__dirname, "bengkel_unair_b_dengan_foto.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(csvText);
  console.log(`📄 CSV berhasil dibaca: ${rows.length} baris\n`);

  // 2. Fetch existing categories from Supabase (they already exist with UUIDs)
  console.log("📁 Mengambil kategori dari database...");
  const { data: catData, error: catError } = await supabase
    .from("categories")
    .select("id, name");

  if (catError) {
    console.error("❌ Gagal fetch categories:", catError.message);
    return;
  }

  const categoryMap = {}; // name → uuid
  for (const cat of catData) {
    categoryMap[cat.name] = cat.id;
    console.log(`   ✓ ${cat.name} (${cat.id})`);
  }
  console.log("");

  // 3. Insert places
  console.log("📍 Memasukkan data bengkel...");
  let inserted = 0;
  let skipped = 0;

  // Batch places to insert
  const placesToInsert = [];

  for (const row of rows) {
    const name = row.nama;
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);

    if (!name || isNaN(lat) || isNaN(lng)) {
      skipped++;
      continue;
    }

    const categoryName = determineCategory(
      row.types,
      row.query_source,
      row.nama
    );

    // Try exact match first, then fuzzy
    let categoryId = categoryMap[categoryName];
    if (!categoryId) {
      // Try "Bengkel Resmi" vs "Service Resmi"
      if (categoryName === "Service Resmi") {
        categoryId = categoryMap["Bengkel Resmi"];
      }
    }
    if (!categoryId) {
      categoryId = categoryMap["Bengkel Umum"];
    }

    if (!categoryId) {
      console.error(`   ✗ No category ID for: ${categoryName}`);
      skipped++;
      continue;
    }

    placesToInsert.push({
      category_id: categoryId,
      name: name,
      address: row.alamat || null,
      latitude: lat,
      longitude: lng,
      description: null,
      phone: null,
      opening_time: "08:00",
      closing_time: "17:00",
      photo_url: null,
      rating: null,
      google_maps_url: row.google_maps_url || null,
    });
  }

  // Check for existing places to avoid duplicates
  const { data: existingPlaces } = await supabase
    .from("places")
    .select("name, latitude");

  const existingSet = new Set();
  for (const p of existingPlaces || []) {
    existingSet.add(`${p.name}|${Number(p.latitude).toFixed(4)}`);
  }

  const newPlaces = placesToInsert.filter((p) => {
    const key = `${p.name}|${Number(p.latitude).toFixed(4)}`;
    if (existingSet.has(key)) {
      console.log(`   → Skip (sudah ada): ${p.name}`);
      skipped++;
      return false;
    }
    return true;
  });

  if (newPlaces.length === 0) {
    console.log("\n✅ Semua data sudah ada di database. Tidak ada yang ditambahkan.");
    return;
  }

  // Insert in batches of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < newPlaces.length; i += BATCH_SIZE) {
    const batch = newPlaces.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("places").insert(batch);

    if (error) {
      console.error(`   ✗ Batch error (${i}-${i + batch.length}):`, error.message);
      skipped += batch.length;
    } else {
      for (const p of batch) {
        console.log(`   + ${p.name}`);
      }
      inserted += batch.length;
    }
  }

  console.log(`\n✅ Selesai!`);
  console.log(`   Berhasil: ${inserted} bengkel`);
  console.log(`   Dilewati: ${skipped}`);
  console.log(`   Total kategori: ${catData.length}`);
}

main().catch(console.error);
