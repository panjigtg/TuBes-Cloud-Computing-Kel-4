/**
 * Category icon + color mapping.
 * Icons: MaterialCommunityIcons names.
 * Colors: vivid, high-contrast for light map backgrounds.
 */

const iconMap = {
  'car':          'car-wrench',
  'motorbike':    'motorbike',
  'tire':         'tire',
  'shield-check': 'shield-star',
  'wrench':       'wrench',
};

export function getCategoryIcon(iconName) {
  return iconMap[iconName] || 'store-cog';
}

/**
 * Per-category marker colors — vivid, high-contrast on light map.
 * Palette aligned with Slate + Indigo theme.
 *
 * car          → indigo (selaras dengan primary app)
 * motorbike    → violet
 * tire         → emerald
 * shield-check → amber (official/resmi)
 * wrench       → orange
 * default      → slate
 */
const colorMap = {
  'car':          '#4F46E5',  // indigo-600  — selaras primary
  'motorbike':    '#7C3AED',  // violet-700
  'tire':         '#059669',  // emerald-600
  'shield-check': '#B45309',  // amber-700
  'wrench':       '#EA580C',  // orange-600
};

export function getCategoryColor(iconName) {
  return colorMap[iconName] || '#475569'; // slate-600 fallback
}
