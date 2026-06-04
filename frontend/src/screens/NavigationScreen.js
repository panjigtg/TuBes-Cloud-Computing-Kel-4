import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategoryIcon, getCategoryColor } from '../utils/icons';
import { getDistanceFromLatLonInMeters, formatDistance } from '../utils/distance';
import { fetchRoute, maneuverIcon, formatDuration } from '../utils/routing';
import { colors, radius, spacing, shadow, mapStyle } from '../theme';

const ARRIVAL_THRESHOLD = 30; // meters
const STEP_ADVANCE_THRESHOLD = 30; // meters

export default function NavigationScreen({ route, navigation }) {
  const { place, userLocation } = route.params;

  const [routeCoords, setRouteCoords] = useState([]);
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userPos, setUserPos] = useState(userLocation);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [remainingDuration, setRemainingDuration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [arrived, setArrived] = useState(false);

  const mapRef = useRef(null);
  const watchRef = useRef(null);

  const categoryColor = getCategoryColor(place.categories?.icon_name);
  const categoryIcon = getCategoryIcon(place.categories?.icon_name);
  const destination = { latitude: place.latitude, longitude: place.longitude };

  // Fetch route once on mount
  useEffect(() => {
    let active = true;
    loadRoute(active);
    return () => {
      active = false;
    };
  }, []);

  // Start watching position
  useEffect(() => {
    startWatching();
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, []);

  const loadRoute = async (active = true) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchRoute(userLocation, destination);
      if (!active) return;
      setRouteCoords(res.coordinates);
      setSteps(res.steps);
      setRemainingDistance(res.distance);
      setRemainingDuration(res.duration);
    } catch (err) {
      if (active) setError('Gagal mengambil rute. Periksa koneksi internet.');
    } finally {
      if (active) setLoading(false);
    }
  };

  const startWatching = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (loc) => {
        const pos = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        handlePositionUpdate(pos, loc.coords.heading);
      }
    );
  };

  const handlePositionUpdate = (pos, heading) => {
    setUserPos(pos);

    // Follow camera
    mapRef.current?.animateCamera(
      {
        center: pos,
        heading: heading >= 0 ? heading : 0,
        pitch: 45,
        zoom: 17,
      },
      { duration: 800 }
    );

    // Distance to destination
    const distToDest = getDistanceFromLatLonInMeters(
      pos.latitude,
      pos.longitude,
      destination.latitude,
      destination.longitude
    );
    setRemainingDistance(distToDest);

    // Check arrival
    if (distToDest <= ARRIVAL_THRESHOLD) {
      handleArrived();
      return;
    }

    // Advance step if close to current step's maneuver point
    setSteps((prevSteps) => {
      setCurrentStepIndex((prevIndex) => {
        if (prevIndex < prevSteps.length - 1) {
          const nextStep = prevSteps[prevIndex + 1];
          const distToNext = getDistanceFromLatLonInMeters(
            pos.latitude,
            pos.longitude,
            nextStep.coordinate.latitude,
            nextStep.coordinate.longitude
          );
          if (distToNext <= STEP_ADVANCE_THRESHOLD) {
            return prevIndex + 1;
          }
        }
        return prevIndex;
      });
      return prevSteps;
    });
  };

  const handleArrived = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setArrived(true);
  };

  const handleStop = () => {
    Alert.alert('Berhenti Navigasi', 'Yakin ingin berhenti navigasi?', [
      { text: 'Lanjutkan', style: 'cancel' },
      {
        text: 'Berhenti',
        style: 'destructive',
        onPress: () => {
          if (watchRef.current) {
            watchRef.current.remove();
            watchRef.current = null;
          }
          navigation.popToTop();
        },
      },
    ]);
  };

  const currentStep = steps[currentStepIndex];

  // Arrival screen
  if (arrived) {
    return (
      <View style={styles.arrivedContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />
        <MaterialCommunityIcons name="map-marker-check" size={80} color={colors.primary} />
        <Text style={styles.arrivedTitle}>Anda telah tiba!</Text>
        <Text style={styles.arrivedSubtitle}>{place.name}</Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Selesai</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading route
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Menyiapkan rute...</Text>
      </View>
    );
  }

  // Error
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadRoute(true)}>
          <Text style={styles.retryButtonText}>Coba Lagi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={{
          latitude: userPos.latitude,
          longitude: userPos.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={colors.primary}
            strokeWidth={5}
          />
        )}
        <Marker coordinate={destination}>
          <View style={[styles.destMarker, { backgroundColor: categoryColor }]}>
            <MaterialCommunityIcons name={categoryIcon} size={18} color={colors.white} />
          </View>
        </Marker>
      </MapView>

      {/* Instruction Panel */}
      <View style={styles.instructionPanel}>
        <MaterialCommunityIcons
          name={
            currentStep
              ? maneuverIcon(currentStep.type, currentStep.modifier)
              : 'navigation-variant'
          }
          size={36}
          color={colors.primary}
        />
        <View style={styles.instructionTextWrap}>
          <Text style={styles.instructionText} numberOfLines={2}>
            {currentStep ? currentStep.instruction : 'Menuju tujuan'}
          </Text>
          {currentStep?.name ? (
            <Text style={styles.instructionRoad} numberOfLines={1}>
              {currentStep.name}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Info Bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoTextWrap}>
          <Text style={styles.infoDistance}>
            {remainingDistance != null ? formatDistance(remainingDistance) : '-'} tersisa
          </Text>
          <Text style={styles.infoDuration}>
            {remainingDuration != null ? `± ${formatDuration(remainingDuration)}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <MaterialCommunityIcons name="close" size={18} color={colors.danger} />
          <Text style={styles.stopButtonText}>Berhenti</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
    paddingHorizontal: 40,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    marginTop: 16,
  },
  backLinkText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  destMarker: {
    padding: 8,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.white,
    ...shadow.low,
  },
  instructionPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    ...shadow.medium,
  },
  instructionTextWrap: {
    flex: 1,
    marginLeft: 16,
  },
  instructionText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  instructionRoad: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  infoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoDistance: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  infoDuration: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDanger,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stopButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  arrivedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
    paddingHorizontal: 40,
  },
  arrivedTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 20,
  },
  arrivedSubtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 32,
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: radius.lg,
    ...shadow.colored(colors.primary),
  },
  doneButtonText: {
    color: colors.textInverse,
    fontSize: 17,
    fontWeight: '700',
  },
});

