import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * BengkelMarker — pin dengan label di sebelah kanan.
 *
 *   ●  Bengkel Jaya
 *   ▼
 *
 * Catatan penting untuk react-native-maps:
 * - Jangan pakai shadow/elevation di dalam custom marker — bisa menyebabkan
 *   marker tidak tampil di Android.
 * - Gunakan border sebagai pengganti shadow.
 * - Ukuran harus eksplisit (width/height), bukan bergantung pada konten saja.
 */
export default function BengkelMarker({ iconName, color, name = '' }) {
  const safeName = name ?? '';
  const maxChars = 16;
  const label = safeName.length > maxChars ? safeName.slice(0, maxChars - 1) + '…' : safeName;

  return (
    <View style={styles.wrapper}>
      {/* Pin circle */}
      <View style={[styles.circle, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={iconName} size={18} color="#FFFFFF" />
      </View>

      {/* Triangle tail */}
      <View style={[styles.tail, { borderTopColor: color }]} />

      {/* Label — positioned absolute to the right of the circle */}
      {label ? (
        <View style={styles.labelWrap}>
          <Text style={styles.labelText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Fixed size so react-native-maps can measure it correctly
    width: 160,
    height: 52,
    // Pin circle sits at left, label to the right
  },

  circle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    // No shadow/elevation — causes issues on Android inside Marker
  },

  tail: {
    position: 'absolute',
    top: 35,   // just below circle bottom
    left: 14,  // centered under circle (38/2 - 5 = 14)
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor set inline
  },

  labelWrap: {
    position: 'absolute',
    top: 6,    // vertically centered with circle
    left: 44,  // right of circle (38 + 6 gap)
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 112,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
});
