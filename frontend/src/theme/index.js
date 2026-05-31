/**
 * Clean Light Theme
 * Central design tokens for the entire app.
 */

/**
 * Slate + Indigo — Clean Light Theme
 * Inspired by Linear, Vercel, Notion design systems.
 */

export const colors = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bgBase:    '#F8F9FB',              // very light cool grey — page background
  bgSurface: '#FFFFFF',              // cards, inputs, modals
  bgElevated:'#FFFFFF',              // headers, bottom sheet
  bgOverlay: 'rgba(255,255,255,0.92)', // floating elements on map
  bgMuted:   '#F1F3F7',              // subtle section backgrounds, disabled

  // ── Brand ─────────────────────────────────────────────────────────────────
  primary:      '#4F46E5',           // indigo-600 — CTA, active state, links
  primaryLight: '#EEF2FF',           // indigo-50  — chip bg, badge bg
  primaryMid:   '#818CF8',           // indigo-400 — hover, secondary accent

  // ── Semantic ──────────────────────────────────────────────────────────────
  secondary:    '#EC4899',           // pink-500   — admin accent
  secondaryDim: '#FDF2F8',           // pink-50
  success:      '#059669',           // emerald-600 — save, confirm
  successDim:   '#ECFDF5',           // emerald-50
  warning:      '#D97706',           // amber-600  — caution
  warningDim:   '#FFFBEB',           // amber-50
  danger:       '#DC2626',           // red-600    — delete, error
  dangerDim:    '#FEF2F2',           // red-50

  // ── Text ──────────────────────────────────────────────────────────────────
  textPrimary:   '#0F172A',          // slate-900  — headings, body
  textSecondary: '#475569',          // slate-600  — labels, descriptions
  textMuted:     '#94A3B8',          // slate-400  — placeholders, hints
  textInverse:   '#FFFFFF',          // on coloured buttons

  // ── Borders ───────────────────────────────────────────────────────────────
  borderSubtle:  '#E2E8F0',          // slate-200  — card borders, dividers
  borderMedium:  '#CBD5E1',          // slate-300  — input borders
  borderPrimary: 'rgba(79,70,229,0.3)', // indigo tinted — focused inputs
  borderDanger:  'rgba(220,38,38,0.35)',

  // ── Utility ───────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 9999,
};

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
};

export const shadow = {
  low: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 4,
  },
  high: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 8,
  },
  colored: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  }),
};

/**
 * Map style — mendekati Google Maps default.
 *
 * Perubahan dari default:
 *  1. Sembunyikan semua POI icon & label → marker bengkel lebih menonjol.
 *  2. Sembunyikan transit icon.
 *  3. Bangunan (building) → fill abu muda, stroke abu gelap.
 *  4. Semua warna lain dibiarkan mendekati default Google Maps.
 */
export const mapStyle = [
  // ── Sembunyikan semua POI icon & label ───────────────────────────────────
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.attraction',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.place_of_worship',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  // Park tetap tampil tapi tanpa label
  {
    featureType: 'poi.park',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },

  // ── Sembunyikan transit icon ──────────────────────────────────────────────
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },

  // ── Bangunan — abu muda dengan garis abu gelap ────────────────────────────
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [{ color: '#E8E8E8' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#BDBDBD' }, { weight: 0.5 }],
  },
];

export default { colors, radius, spacing, shadow, mapStyle };
