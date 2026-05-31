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
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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
                  {place.categories?.name || 'Lainnya'}
                </Text>
              </View>
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
              <MaterialCommunityIcons name={categoryIcon} size={24} color={categoryColor} />
              <Text style={styles.statValue} numberOfLines={1}>
                {place.categories?.name?.split(' ')[1] || 'Umum'}
              </Text>
              <Text style={styles.statLabel}>Kategori</Text>
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

      {/* Navigation Button */}
      <View style={styles.bottomBar}>
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
    paddingBottom: 100,
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
    marginTop: 10,
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
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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
  },
  routeButton: {
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
