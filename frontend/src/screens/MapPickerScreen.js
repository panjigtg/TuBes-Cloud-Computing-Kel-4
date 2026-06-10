import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapComponents';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, mapStyle } from '../theme';

/**
 * MapPickerScreen
 *
 * Params (route.params):
 *   - initialCoordinate?: { latitude, longitude }  — pre-selected location (edit mode)
 *   - onConfirm: (coordinate: { latitude, longitude }) => void  — callback when confirmed
 *
 * Usage:
 *   navigation.navigate('MapPicker', {
 *     initialCoordinate: { latitude: -6.2, longitude: 106.8 },
 *     onConfirm: (coord) => { setLocation(coord); },
 *   });
 */
export default function MapPickerScreen({ route, navigation }) {
  const { initialCoordinate, onConfirm } = route.params ?? {};
  const insets = useSafeAreaInsets();

  const [markerCoord, setMarkerCoord] = useState(
    initialCoordinate ?? null
  );
  const [adminLocation, setAdminLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(!initialCoordinate);
  const mapRef = useRef(null);

  // On mount: get admin's current GPS to set initial map region
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;
        const coord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setAdminLocation(coord);
        // If no initial coordinate, place marker at admin's location
        if (!initialCoordinate) {
          setMarkerCoord(coord);
        }
      } catch (_) {
        // GPS unavailable — map will show default region
      } finally {
        if (active) setLoadingLocation(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const initialRegion = initialCoordinate
    ? {
        latitude: initialCoordinate.latitude,
        longitude: initialCoordinate.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : adminLocation
    ? {
        latitude: adminLocation.latitude,
        longitude: adminLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    : {
        // Fallback: Jakarta
        latitude: -6.2088,
        longitude: 106.8456,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  const handleMapPress = (e) => {
    setMarkerCoord(e.nativeEvent.coordinate);
  };

  const handleMarkerDragEnd = (e) => {
    setMarkerCoord(e.nativeEvent.coordinate);
  };

  const handleMyLocation = () => {
    if (!adminLocation) return;
    setMarkerCoord(adminLocation);
    mapRef.current?.animateToRegion(
      {
        latitude: adminLocation.latitude,
        longitude: adminLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      400
    );
  };

  const handleConfirm = () => {
    if (!markerCoord) return;
    onConfirm?.(markerCoord);
    navigation.goBack();
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
          <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pilih Lokasi Bengkel</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Map */}
      {loadingLocation ? (
        <View style={styles.loadingMap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Mengambil lokasi...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapStyle}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {markerCoord && (
            <Marker
              coordinate={markerCoord}
              draggable
              onDragEnd={handleMarkerDragEnd}
            >
              <View style={styles.markerPin}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={40}
                  color={colors.primary}
                />
              </View>
            </Marker>
          )}
        </MapView>
      )}

      {/* My Location FAB */}
      {!loadingLocation && (
        <TouchableOpacity
          style={[
            styles.myLocBtn,
            { bottom: 180 + insets.bottom },
          ]}
          onPress={handleMyLocation}
          disabled={!adminLocation}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color={adminLocation ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>
      )}

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        {markerCoord ? (
          <View style={styles.coordRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color={colors.primary} />
            <Text style={styles.coordText}>
              {markerCoord.latitude.toFixed(6)}, {markerCoord.longitude.toFixed(6)}
            </Text>
          </View>
        ) : (
          <Text style={styles.hintText}>Tap di peta atau geser marker untuk memilih lokasi</Text>
        )}
        <Text style={styles.subHint}>
          {markerCoord
            ? 'Geser marker atau tap titik lain untuk mengubah lokasi'
            : 'Tap di peta atau geser marker untuk memilih lokasi'}
        </Text>
        <TouchableOpacity
          style={[styles.confirmBtn, !markerCoord && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!markerCoord}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="check" size={22} color={colors.textInverse} />
          <Text style={styles.confirmBtnText}>Gunakan Lokasi Ini</Text>
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgOverlay,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  loadingMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
    fontSize: 15,
  },
  markerPin: {
    alignItems: 'center',
    // Offset so the tip of the pin is at the coordinate
    marginBottom: 20,
  },
  myLocBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bgOverlay,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.medium,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    ...shadow.high,
    shadowOffset: { width: 0, height: -4 },
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  coordText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 15,
    marginBottom: 4,
  },
  subHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 16,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...shadow.colored(colors.primary),
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: colors.textInverse,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },
});
