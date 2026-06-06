import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { fetchPlaces as apiFetchPlaces, fetchCategories as apiFetchCategories } from '../services/api';
import { getDistanceFromLatLonInMeters, formatDistance } from '../utils/distance';
import { getCategoryIcon, getCategoryColor } from '../utils/icons';
import { colors, radius, shadow, mapStyle } from '../theme';
import BengkelMarker from '../components/BengkelMarker';

const { height } = Dimensions.get('window');

// ─── Bottom sheet snap positions ─────────────────────────────────────────────
const SNAP_COLLAPSED = height - 100;
const SNAP_HALF      = height * 0.52;

function nearestSnap(value, snapExpanded) {
  const snaps = [SNAP_COLLAPSED, SNAP_HALF, snapExpanded];
  return snaps.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

// Bottom nav bar height (used for spacing calculations)
const BOTTOM_NAV_H = 88;
// My location FAB size
const FAB_SIZE = 48;
// Gap between FAB and sheet handle — kecilkan agar lebih dekat
const FAB_GAP = 4;

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // SNAP_EXPANDED: sheet top stops just below filter chips
  const SNAP_EXPANDED = insets.top + 48 + 8 + 40 + 20;

  const [location, setLocation]               = useState(null);
  const [places, setPlaces]                   = useState([]);
  const [categories, setCategories]           = useState([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [loading, setLoading]                 = useState(true);
  const [locationDenied, setLocationDenied]   = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sheetState, setSheetState]           = useState('half');
  const [markersReady, setMarkersReady]       = useState(false);
  const mapRef   = useRef(null);
  const lastY    = useRef(SNAP_HALF);
  const sheetY   = useRef(new Animated.Value(SNAP_HALF)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // FAB translateY: posisikan FAB tepat di atas handle sheet.
  // Sheet berada di translateY = sheetY, artinya top edge sheet ada di sheetY dari atas layar.
  // Kita ingin FAB bottom = sheetY - FAB_GAP, dari atas layar.
  // FAB di-anchor bottom:0, jadi translateY = -(height - sheetY + FAB_GAP + FAB_SIZE)
  const fabTranslateY = sheetY.interpolate({
    inputRange:  [SNAP_EXPANDED, SNAP_HALF, SNAP_COLLAPSED],
    outputRange: [
      -(height - SNAP_EXPANDED  + FAB_GAP + FAB_SIZE),
      -(height - SNAP_HALF      + FAB_GAP + FAB_SIZE),
      -(height - SNAP_COLLAPSED + FAB_GAP + FAB_SIZE),
    ],
    extrapolate: 'clamp',
  });

  // ─── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6,
      onPanResponderGrant: () => {
        sheetY.stopAnimation((val) => {
          lastY.current = val;
          sheetY.setOffset(val);
          sheetY.setValue(0);
        });
      },
      onPanResponderMove: (_, gs) => {
        const next = lastY.current + gs.dy;
        if (next >= SNAP_EXPANDED && next <= SNAP_COLLAPSED) {
          sheetY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        sheetY.flattenOffset();
        const current = lastY.current + gs.dy;
        const target  = nearestSnap(current, SNAP_EXPANDED);
        animateToSnap(target);
      },
    })
  ).current;

  const animateToSnap = (target) => {
    lastY.current = target;
    let newState = 'half';
    if (Math.abs(target - SNAP_COLLAPSED) < 5) newState = 'collapsed';
    else if (Math.abs(target - SNAP_EXPANDED) < 5) newState = 'expanded';
    setSheetState(newState);
    Animated.spring(sheetY, {
      toValue: target,
      useNativeDriver: true,
      tension: 65,
      friction: 12,
    }).start();
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    requestLocation();
    fetchCategories();
    fetchPlaces();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  // Allow markers to render first, then freeze for performance
  useEffect(() => {
    const len = filteredPlaces?.length ?? 0;
    if (len > 0 && !markersReady) {
      const t = setTimeout(() => setMarkersReady(true), 600);
      return () => clearTimeout(t);
    }
  }, [filteredPlaces?.length, markersReady]);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationDenied(true); setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
      setLocationDenied(false);
      setLoading(false);
    } catch {
      setLocationDenied(true);
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiFetchCategories();
      setCategories(data ?? []);
    } catch (err) {
      console.warn('Gagal fetch categories:', err.message);
    }
  };

  const fetchPlaces = async () => {
    try {
      const data = await apiFetchPlaces();
      // Re-nest flat API fields into categories object for component compatibility
      const normalized = (data ?? []).map((p) => ({
        ...p,
        categories: { name: p.category_name, icon_name: p.icon_name },
      }));
      setPlaces(normalized);
    } catch (err) {
      console.warn('Gagal fetch places:', err.message);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const placesWithDistance = useMemo(() => {
    const safePlaces = places ?? [];
    if (!location) return safePlaces;
    return safePlaces
      .map((p) => ({
        ...p,
        distance: getDistanceFromLatLonInMeters(
          location.latitude, location.longitude,
          p.latitude, p.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [places, location]);

  const filteredPlaces = useMemo(() => {
    let result = placesWithDistance ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => (p.name ?? '').toLowerCase().includes(q) ||
               ((p.description ?? '').toLowerCase().includes(q))
      );
    }
    if (selectedCategory) {
      result = result.filter((p) => p.category_id === selectedCategory);
    }
    return result;
  }, [placesWithDistance, searchQuery, selectedCategory]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const animateToPlace = (place) => {
    mapRef.current?.animateToRegion(
      { latitude: place.latitude, longitude: place.longitude,
        latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  };

  const goToMyLocation = () => {
    if (!location) return;
    mapRef.current?.animateToRegion(
      { latitude: location.latitude, longitude: location.longitude,
        latitudeDelta: 0.004, longitudeDelta: 0.004 },
      500
    );
  };

  const isCollapsed = sheetState === 'collapsed';

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.fullCenter}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Mengambil lokasi Anda...</Text>
      </View>
    );
  }

  if (locationDenied) {
    return (
      <View style={styles.fullCenter}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />
        <MaterialCommunityIcons name="map-marker-off" size={80} color={colors.danger} />
        <Text style={styles.deniedTitle}>Izin Lokasi Diperlukan</Text>
        <Text style={styles.deniedText}>
          Aplikasi membutuhkan akses lokasi untuk menampilkan bengkel terdekat.
          Silakan aktifkan izin lokasi di pengaturan perangkat Anda.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestLocation}>
          <Text style={styles.retryButtonText}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  const safeTop      = insets.top;
  const searchBarTop = safeTop + 12;
  const filterRowTop = searchBarTop + 48 + 8;
  const safeBottom   = insets.bottom;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={{
          latitude:      location?.latitude  || -6.2,
          longitude:     location?.longitude || 106.816666,
          latitudeDelta:  0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {filteredPlaces.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            onPress={() => {
              animateToPlace(place);
              navigation.navigate('Detail', { place, userLocation: location });
            }}
            anchor={{ x: 0.12, y: 1 }}
            tracksViewChanges={!markersReady}
          >
            <BengkelMarker
              iconName={getCategoryIcon(place.categories?.icon_name)}
              color={getCategoryColor(place.categories?.icon_name)}
              name={place.name}
            />
          </Marker>
        ))}
      </MapView>

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, { top: searchBarTop }]}>
        <View style={styles.searchInner}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari bengkel..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Category filter ── */}
      <Animated.View style={[styles.filterRow, { top: filterRowTop, opacity: fadeAnim }]}>
        <FlatList
          data={[{ id: null, name: 'Semua', icon_name: 'apps' }, ...categories]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id || 'all'}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selectedCategory === item.id && styles.chipActive]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <MaterialCommunityIcons
                name={item.icon_name === 'apps' ? 'apps' : getCategoryIcon(item.icon_name)}
                size={14}
                color={selectedCategory === item.id ? colors.textInverse : colors.textSecondary}
              />
              <Text style={[styles.chipText, selectedCategory === item.id && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      {/* ── My Location FAB — follows sheet position ── */}
      <Animated.View
        style={[
          styles.fabWrap,
          { right: 16, transform: [{ translateY: fabTranslateY }] },
        ]}
      >
        <TouchableOpacity style={styles.fabBtn} onPress={goToMyLocation}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>

        {/* Handle area */}
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <TouchableOpacity
            onPress={() => {
              if (sheetState === 'half') animateToSnap(SNAP_EXPANDED);
              else if (sheetState === 'expanded') animateToSnap(SNAP_HALF);
            }}
            activeOpacity={1}
            style={{ alignItems: 'center' }}
          >
            <View style={styles.handleBar} />
          </TouchableOpacity>

          <View style={styles.handleRow}>
            {isCollapsed ? (
              <TouchableOpacity
                style={styles.openListBtn}
                onPress={() => animateToSnap(SNAP_HALF)}
              >
                <MaterialCommunityIcons name="format-list-bulleted" size={16} color={colors.primary} />
                <Text style={styles.openListText}>
                  {'Daftar Bengkel (' + filteredPlaces.length + ')'}
                </Text>
                <MaterialCommunityIcons name="chevron-up" size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.resultCount}>
                  {filteredPlaces.length + ' bengkel ditemukan'}
                </Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => animateToSnap(SNAP_COLLAPSED)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* List */}
        {!isCollapsed && (
          filteredPlaces.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="map-search" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Belum ada bengkel terdaftar</Text>
              <Text style={styles.emptySubtitle}>
                Bengkel akan muncul di sini setelah admin menambahkan data
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredPlaces}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => {
                    animateToPlace(item);
                    navigation.navigate('Detail', { place: item, userLocation: location });
                  }}
                >
                  <View style={styles.cardRow}>
                    {item.photo_url ? (
                      <Image source={{ uri: item.photo_url }} style={styles.cardThumb} />
                    ) : (
                      <View style={[styles.cardThumbPlaceholder, { backgroundColor: getCategoryColor(item.categories?.icon_name) + '25' }]}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(item.categories?.icon_name)}
                          size={26}
                          color={getCategoryColor(item.categories?.icon_name)}
                        />
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.cardBadgeRow}>
                        <View style={[styles.badge, { backgroundColor: getCategoryColor(item.categories?.icon_name) + '18' }]}>
                          <MaterialCommunityIcons
                            name={getCategoryIcon(item.categories?.icon_name)}
                            size={11}
                            color={getCategoryColor(item.categories?.icon_name)}
                          />
                          <Text style={[styles.badgeText, { color: getCategoryColor(item.categories?.icon_name) }]}>
                            {item.categories?.name || 'Lainnya'}
                          </Text>
                        </View>
                      </View>
                      {item.description ? (
                        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.cardDist}>
                      <MaterialCommunityIcons name="map-marker-distance" size={15} color={colors.primary} />
                      <Text style={styles.distText}>
                        {item.distance ? formatDistance(item.distance) : '—'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )
        )}

        {/* ── Bottom Nav Bar — always visible inside sheet ── */}
        <View style={[styles.bottomNav, { paddingBottom: safeBottom + 8 }]}>
          {/* Explore tab */}
          <TouchableOpacity style={styles.navItem} onPress={() => animateToSnap(SNAP_HALF)}>
            <MaterialCommunityIcons
              name="map-search"
              size={26}
              color={sheetState !== 'collapsed' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, sheetState !== 'collapsed' && styles.navLabelActive]}>
              Explore
            </Text>
          </TouchableOpacity>

          {/* Dashboard tab */}
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Login')}>
            <MaterialCommunityIcons name="shield-account" size={26} color={colors.textMuted} />
            <Text style={styles.navLabel}>Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },

  // ── Full-screen states ────────────────────────────────────────────────────
  fullCenter: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bgBase, paddingHorizontal: 40,
  },
  loadingText: { color: colors.textSecondary, marginTop: 16, fontSize: 16 },
  deniedTitle: {
    color: colors.textPrimary, fontSize: 22, fontWeight: '700',
    marginTop: 20, textAlign: 'center',
  },
  deniedText: {
    color: colors.textSecondary, fontSize: 15, marginTop: 12,
    textAlign: 'center', lineHeight: 22,
  },
  retryButton: {
    marginTop: 24, backgroundColor: colors.primary,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: radius.md,
    ...shadow.colored(colors.primary),
  },
  retryButtonText: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },

  // ── Search bar ────────────────────────────────────────────────────────────
  searchBar: {
    position: 'absolute', left: 16, right: 16, zIndex: 30, height: 48,
    justifyContent: 'center',
  },
  searchInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgOverlay,
    borderRadius: radius.lg, paddingHorizontal: 14, height: '100%',
    borderWidth: 1, borderColor: colors.borderSubtle,
    ...shadow.medium,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 0 },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterRow: { position: 'absolute', left: 0, right: 0, zIndex: 25 },
  filterList: { paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgOverlay,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: radius.full, marginRight: 8,
    borderWidth: 1, borderColor: colors.borderSubtle,
    ...shadow.low,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, marginLeft: 5, fontWeight: '500' },
  chipTextActive: { color: colors.textInverse, fontWeight: '600' },

  // ── My Location FAB ───────────────────────────────────────────────────────
  fabWrap: {
    position: 'absolute',
    bottom: 0,   // anchor point; translateY moves it up from here
    zIndex: 30,
  },
  fabBtn: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderSubtle,
    ...shadow.medium,
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: height + 200,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    ...shadow.high, shadowOffset: { width: 0, height: -4 },
    zIndex: 20,
  },

  // ── Handle ────────────────────────────────────────────────────────────────
  handleArea: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8 },
  handleBar: {
    width: 40, height: 4, backgroundColor: colors.textMuted,
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  handleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  resultCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  openListBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 4,
  },
  openListText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyBox: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' },

  // ── Card list ─────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    marginBottom: 10, borderWidth: 1, borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardThumb: { width: 60, height: 60, borderRadius: radius.md },
  cardThumbPlaceholder: {
    width: 60, height: 60, borderRadius: radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardBadgeRow: { flexDirection: 'row', marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm,
  },
  badgeText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  cardDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  cardDist: { alignItems: 'center', marginLeft: 8, minWidth: 44 },
  distText: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 3, textAlign: 'center' },

  // ── Bottom Nav Bar ────────────────────────────────────────────────────────
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14,
  },
  navLabel: {
    fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 4,
  },
  navLabelActive: {
    color: colors.primary, fontWeight: '700',
  },
});
