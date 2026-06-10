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
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapComponents';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { fetchPlaces as apiFetchPlaces, fetchCategories as apiFetchCategories } from '../services/api';
import { getDistanceFromLatLonInMeters, formatDistance } from '../utils/distance';
import { getCategoryIcon, getCategoryColor } from '../utils/icons';
import { colors, radius, shadow } from '../theme';
import { supabase } from '../lib/supabase';
import BengkelMarker from '../components/BengkelMarker';

const { height, width } = Dimensions.get('window');
const IS_COMPACT = width < 380 || height < 720;

const SEARCH_H = IS_COMPACT ? 48 : 52;
const CHIP_H = IS_COMPACT ? 38 : 42;
const MAP_CONTROL_SIZE = IS_COMPACT ? 42 : 46;
const MAP_CONTROL_ICON_SIZE = IS_COMPACT ? 20 : 22;
const NAV_ICON_SIZE = IS_COMPACT ? 22 : 24;
const SHEET_X = IS_COMPACT ? 18 : 20;
const THUMB_SIZE = IS_COMPACT ? 48 : 54;

const SNAP_COLLAPSED = height - (IS_COMPACT ? 154 : 172);
const SNAP_HALF      = height * (IS_COMPACT ? 0.66 : 0.64);

function nearestSnap(value, snapExpanded) {
  const snaps = [SNAP_COLLAPSED, SNAP_HALF, snapExpanded];
  return snaps.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

// Bottom nav bar height (used for spacing calculations)
const BOTTOM_NAV_H = IS_COMPACT ? 74 : 80;
// My location FAB size
// Gap between FAB and sheet handle — kecilkan agar lebih dekat
const MAP_TOOLS_BOTTOM = height - SNAP_HALF + (IS_COMPACT ? 18 : 24);

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const SNAP_EXPANDED = insets.top + SEARCH_H + CHIP_H + (IS_COMPACT ? 32 : 38);

  const [location, setLocation]               = useState(null);
  const [places, setPlaces]                   = useState([]);
  const [categories, setCategories]           = useState([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [loading, setLoading]                 = useState(true);
  const [locationDenied, setLocationDenied]   = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [mapType, setMapType]                 = useState('standard');
  const [sheetState, setSheetState]           = useState('half');
  const [markersReady, setMarkersReady]       = useState(false);
  const mapRef   = useRef(null);
  const lastY    = useRef(SNAP_HALF);
  const sheetY   = useRef(new Animated.Value(SNAP_HALF)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const goToAdmin = async () => {
    const { data } = await supabase.auth.getSession();
    navigation.navigate(data?.session ? 'AdminDashboard' : 'Login');
  };

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
  const searchBarTop = safeTop + (IS_COMPACT ? 8 : 10);
  const filterRowTop = searchBarTop + SEARCH_H + (IS_COMPACT ? 8 : 10);
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
        mapType={mapType}
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
          <MaterialCommunityIcons
            name="map-marker-radius"
            size={IS_COMPACT ? 24 : 26}
            color="#4285F4"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Telusuri bengkel di sini"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.searchManageButton}
              onPress={goToAdmin}
              activeOpacity={0.85}
            >
              <Text style={styles.searchManageText}>Kelola</Text>
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
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedCategory(item.id)}
              >
                <MaterialCommunityIcons
                  name={item.icon_name === 'apps' ? 'home' : getCategoryIcon(item.icon_name)}
                  size={IS_COMPACT ? 17 : 18}
                  color={isActive ? colors.textPrimary : colors.textSecondary}
                />
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>

      {/* ── My Location FAB — follows sheet position ── */}
      <View style={[styles.mapControls, { right: 16 }]}>
        <TouchableOpacity
          style={styles.mapControlBtn}
          onPress={() => setMapType((current) => current === 'standard' ? 'satellite' : 'standard')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="layers-outline" size={MAP_CONTROL_ICON_SIZE} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapControlBtn} onPress={goToMyLocation} activeOpacity={0.85}>
          <MaterialCommunityIcons name="crosshairs-gps" size={MAP_CONTROL_ICON_SIZE} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

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
                <View>
                  <Text style={styles.sheetTitle}>Bengkel terdekat</Text>
                  <Text style={styles.resultCount}>
                    {filteredPlaces.length + ' bengkel ditemukan'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-up" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <>
                <View>
                  <Text style={styles.sheetTitle}>Bengkel terdekat</Text>
                  <Text style={styles.resultCount}>
                    {filteredPlaces.length + ' bengkel ditemukan'}
                  </Text>
                </View>
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
                          size={IS_COMPACT ? 22 : 24}
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
              size={NAV_ICON_SIZE}
              color={sheetState !== 'collapsed' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, sheetState !== 'collapsed' && styles.navLabelActive]}>
              Jelajahi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => animateToSnap(SNAP_EXPANDED)}>
            <MaterialCommunityIcons name="store-search" size={NAV_ICON_SIZE} color={colors.textMuted} />
            <Text style={styles.navLabel}>Daftar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={goToMyLocation}>
            <MaterialCommunityIcons name="crosshairs-gps" size={NAV_ICON_SIZE} color={colors.textMuted} />
            <Text style={styles.navLabel}>Lokasi</Text>
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
    position: 'absolute', left: SHEET_X, right: SHEET_X, zIndex: 40, height: SEARCH_H,
    justifyContent: 'center',
  },
  searchInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: SEARCH_H / 2, paddingLeft: IS_COMPACT ? 11 : 12, paddingRight: 6, height: '100%',
    ...shadow.medium,
  },
  searchIcon: { marginRight: IS_COMPACT ? 8 : 10 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: IS_COMPACT ? 14 : 15, paddingVertical: 0 },
  searchManageButton: {
    height: IS_COMPACT ? 32 : 34,
    paddingHorizontal: IS_COMPACT ? 10 : 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMuted,
  },
  searchManageText: {
    color: colors.textPrimary,
    fontSize: IS_COMPACT ? 12 : 13,
    fontWeight: '700',
  },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterRow: { position: 'absolute', left: 0, right: 0, zIndex: 35 },
  filterList: { paddingHorizontal: SHEET_X, paddingVertical: 3 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface,
    paddingHorizontal: IS_COMPACT ? 12 : 14, height: CHIP_H,
    borderRadius: CHIP_H / 2, marginRight: 8,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)',
    ...shadow.medium,
  },
  chipActive: { borderColor: 'rgba(66,133,244,0.55)' },
  chipText: { color: colors.textSecondary, fontSize: IS_COMPACT ? 12 : 13, marginLeft: 7, fontWeight: '600' },
  chipTextActive: { color: colors.textPrimary, fontWeight: '700' },

  // ── My Location FAB ───────────────────────────────────────────────────────
  mapControls: {
    position: 'absolute',
    bottom: MAP_TOOLS_BOTTOM,
    zIndex: 18,
    gap: IS_COMPACT ? 8 : 10,
  },
  mapControlBtn: {
    width: MAP_CONTROL_SIZE, height: MAP_CONTROL_SIZE, borderRadius: MAP_CONTROL_SIZE / 2,
    backgroundColor: colors.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    ...shadow.medium,
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: height + 200,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: IS_COMPACT ? 22 : 24, borderTopRightRadius: IS_COMPACT ? 22 : 24,
    ...shadow.high, shadowOffset: { width: 0, height: -3 },
    zIndex: 20,
  },

  // ── Handle ────────────────────────────────────────────────────────────────
  handleArea: { paddingTop: IS_COMPACT ? 9 : 10, paddingHorizontal: SHEET_X, paddingBottom: IS_COMPACT ? 9 : 10 },
  handleBar: {
    width: 42, height: 4, backgroundColor: '#D1D5DB',
    borderRadius: 999, alignSelf: 'center', marginBottom: IS_COMPACT ? 10 : 12,
  },
  handleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: IS_COMPACT ? 20 : 22,
    fontWeight: '700',
  },
  resultCount: { color: colors.textSecondary, fontSize: IS_COMPACT ? 12 : 13, fontWeight: '500', marginTop: 2 },
  closeBtn: {
    width: IS_COMPACT ? 30 : 32, height: IS_COMPACT ? 30 : 32, borderRadius: 16,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  openListBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 2,
  },
  openListText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyBox: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center' },

  // ── Card list ─────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 0, paddingBottom: BOTTOM_NAV_H + 18 },
  card: {
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SHEET_X, paddingVertical: IS_COMPACT ? 10 : 12 },
  cardThumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 11 },
  cardThumbPlaceholder: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { color: colors.textPrimary, fontSize: IS_COMPACT ? 14 : 15, fontWeight: '700' },
  cardBadgeRow: { flexDirection: 'row', marginTop: 3 },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm,
  },
  badgeText: { fontSize: IS_COMPACT ? 10 : 11, fontWeight: '600', marginLeft: 4 },
  cardDesc: { color: colors.textSecondary, fontSize: IS_COMPACT ? 11 : 12, marginTop: 3, lineHeight: IS_COMPACT ? 14 : 16 },
  cardDist: { alignItems: 'center', marginLeft: 8, minWidth: IS_COMPACT ? 38 : 42 },
  distText: { color: colors.primary, fontSize: IS_COMPACT ? 11 : 12, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  // ── Bottom Nav Bar ────────────────────────────────────────────────────────
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: IS_COMPACT ? 8 : 9,
    paddingBottom: IS_COMPACT ? 7 : 8,
  },
  navLabel: {
    fontSize: IS_COMPACT ? 11 : 12, fontWeight: '500', color: colors.textMuted, marginTop: 4,
  },
  navLabelActive: {
    color: colors.primary, fontWeight: '700',
  },
});
