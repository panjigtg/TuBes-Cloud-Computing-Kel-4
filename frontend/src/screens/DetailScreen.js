import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapComponents';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getDistanceFromLatLonInMeters, formatDistance } from '../utils/distance';
import { getCategoryIcon, getCategoryColor } from '../utils/icons';
import { fetchRoute, formatDuration } from '../utils/routing';
import { colors, radius, spacing, shadow, mapStyle } from '../theme';

const { width } = Dimensions.get('window');

export default function DetailScreen({ route, navigation }) {
  const { place, userLocation } = route.params;

  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const distance =
    userLocation && place.latitude && place.longitude
      ? getDistanceFromLatLonInMeters(
          userLocation.latitude,
          userLocation.longitude,
          place.latitude,
          place.longitude
        )
      : null;

  const categoryColor = getCategoryColor(place.categories?.icon_name);
  const categoryIcon = getCategoryIcon(place.categories?.icon_name);

  useEffect(() => {
    let active = true;
    if (userLocation) {
      setRouteLoading(true);
      fetchRoute(userLocation, { latitude: place.latitude, longitude: place.longitude })
        .then((res) => {
          if (!active) return;
          setRouteCoords(res.coordinates);
          setRouteInfo({ distance: res.distance, duration: res.duration });
        })
        .catch((err) => {
          console.warn('Route preview error:', err.message);
        })
        .finally(() => {
          if (active) setRouteLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, []);

  const startNavigation = () => {
    navigation.navigate('Navigation', { place, userLocation });
  };

  const openInGoogleMaps = () => {
    if (place.google_maps_url) {
      Linking.openURL(place.google_maps_url);
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
      Linking.openURL(url);
    }
  };

  const callPhone = () => {
    if (place.phone) {
      Linking.openURL(`tel:${place.phone}`);
    }
  };

  // Format opening hours
  const formatTime = (time) => {
    if (!time) return null;
    // time could be "08:00:00" or "08:00"
    return time.substring(0, 5);
  };

  const openTime = formatTime(place.opening_time);
  const closeTime = formatTime(place.closing_time);
  const hasHours = openTime && closeTime;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          {place.photo_url ? (
            <Image source={{ uri: place.photo_url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: categoryColor + '20' }]}>
              <MaterialCommunityIcons name={categoryIcon} size={80} color={categoryColor} />
            </View>
          )}
          <View style={styles.heroOverlay} />

          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.placeName}>{place.name}</Text>
            <View style={styles.categoryRow}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: categoryColor + '20' },
                ]}
              >
                <MaterialCommunityIcons
                  name={categoryIcon}
                  size={16}
                  color={categoryColor}
                />
                <Text style={[styles.categoryText, { color: categoryColor }]}>
                  {place.categories?.name || place.category_name || 'Lainnya'}
                </Text>
              </View>
              {place.rating != null && (
                <View style={styles.ratingBadge}>
                  <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.ratingText}>{Number(place.rating).toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="map-marker-distance" size={24} color={colors.primary} />
              <Text style={styles.statValue}>
                {distance ? formatDistance(distance) : '-'}
              </Text>
              <Text style={styles.statLabel}>Jarak</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="clock-outline" size={24} color={colors.success} />
              <Text style={styles.statValue}>
                {routeInfo ? formatDuration(routeInfo.duration) : '-'}
              </Text>
              <Text style={styles.statLabel}>Est. Waktu</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="clock-time-eight-outline" size={24} color={colors.warning} />
              <Text style={styles.statValue} numberOfLines={1}>
                {hasHours ? `${openTime}` : '-'}
              </Text>
              <Text style={styles.statLabel}>{hasHours ? `s/d ${closeTime}` : 'Jam Buka'}</Text>
            </View>
          </View>

          {/* Info Section — Address, Phone, Hours */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Informasi Bengkel</Text>
            <View style={styles.infoCard}>
              {/* Address */}
              {place.address ? (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                  <Text style={styles.infoText}>{place.address}</Text>
                </View>
              ) : null}

              {/* Phone */}
              {place.phone ? (
                <TouchableOpacity style={styles.infoRow} onPress={callPhone}>
                  <MaterialCommunityIcons name="phone" size={20} color={colors.success} />
                  <Text style={[styles.infoText, styles.infoLink]}>{place.phone}</Text>
                </TouchableOpacity>
              ) : null}

              {/* Opening Hours */}
              {hasHours ? (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={colors.warning} />
                  <Text style={styles.infoText}>{openTime} — {closeTime}</Text>
                </View>
              ) : null}

              {/* Google Maps Link */}
              <TouchableOpacity style={styles.infoRow} onPress={openInGoogleMaps}>
                <MaterialCommunityIcons name="google-maps" size={20} color="#4285F4" />
                <Text style={[styles.infoText, styles.infoLink]}>Buka di Google Maps</Text>
              </TouchableOpacity>

              {/* No info fallback */}
              {!place.address && !place.phone && !hasHours && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="information-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.infoText, { color: colors.textMuted }]}>
                    Informasi lengkap belum tersedia
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Description Section */}
          {place.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Deskripsi & Layanan</Text>
              <View style={styles.descriptionCard}>
                <Text style={styles.descriptionText}>{place.description}</Text>
              </View>
            </View>
          )}

          {/* Route Preview Section */}
          {userLocation && (
            <View style={styles.routeSection}>
              <Text style={styles.sectionTitle}>Pratinjau Rute</Text>
              <View style={styles.mapCard}>
                <MapView
                  style={styles.miniMap}
                  provider={PROVIDER_GOOGLE}
                  customMapStyle={mapStyle}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  initialRegion={{
                    latitude: (userLocation.latitude + place.latitude) / 2,
                    longitude: (userLocation.longitude + place.longitude) / 2,
                    latitudeDelta: Math.abs(userLocation.latitude - place.latitude) * 2.2 + 0.01,
                    longitudeDelta: Math.abs(userLocation.longitude - place.longitude) * 2.2 + 0.01,
                  }}
                >
                  <Marker coordinate={userLocation}>
                    <View style={styles.userDot} />
                  </Marker>
                  <Marker coordinate={{ latitude: place.latitude, longitude: place.longitude }}>
                    <View style={[styles.destMarker, { backgroundColor: categoryColor }]}>
                      <MaterialCommunityIcons name={categoryIcon} size={14} color={colors.white} />
                    </View>
                  </Marker>
                  {routeCoords.length > 0 && (
                    <Polyline
                      coordinates={routeCoords}
                      strokeColor={colors.primary}
                      strokeWidth={4}
                    />
                  )}
                </MapView>
                {routeLoading && (
                  <View style={styles.mapLoadingOverlay}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Location Section */}
          <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>Koordinat Lokasi</Text>
            <View style={styles.locationCard}>
              <View style={styles.coordRow}>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.primary} />
                <Text style={styles.coordText}>
                  {place.latitude?.toFixed(6)}, {place.longitude?.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar — Two buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.gmapsButton}
          onPress={openInGoogleMaps}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="google-maps" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.routeButton, !userLocation && styles.routeButtonDisabled]}
          onPress={startNavigation}
          disabled={!userLocation}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="navigation-variant" size={22} color={colors.textInverse} />
          <Text style={styles.routeButtonText}>Mulai Navigasi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    width,
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 28, 30, 0.25)',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 12,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: radius.md,
    padding: 10,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
  },
  titleSection: {
    marginBottom: 20,
  },
  placeName: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },

  // ── Info Section ───────────────────────────────────────────────────────────
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
  infoLink: {
    color: colors.primary,
    fontWeight: '600',
  },

  // ── Description ────────────────────────────────────────────────────────────
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  descriptionText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },

  // ── Route Preview ──────────────────────────────────────────────────────────
  routeSection: {
    marginBottom: 24,
  },
  mapCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  miniMap: {
    width: '100%',
    height: 180,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.4)',
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
  },
  destMarker: {
    padding: 6,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // ── Location ───────────────────────────────────────────────────────────────
  locationSection: {
    marginBottom: 24,
  },
  locationCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // ── Bottom Bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gmapsButton: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...shadow.colored(colors.primary),
  },
  routeButtonDisabled: {
    opacity: 0.5,
  },
  routeButtonText: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
});
