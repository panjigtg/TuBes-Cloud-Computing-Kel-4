import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapComponents';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { fetchCategories as apiFetchCategories, updatePlace as apiUpdatePlace } from '../services/api';
import { getCategoryIcon, getCategoryColor } from '../utils/icons';
import { colors, radius, shadow, mapStyle } from '../theme';

/**
 * EditBengkelScreen
 *
 * Params (route.params):
 *   - place: the bengkel object to edit
 *   - onSaved?: () => void  — callback to refresh parent list
 */
export default function EditBengkelScreen({ route, navigation }) {
  const { place, onSaved } = route.params;
  const insets = useSafeAreaInsets();

  // ── Form state (pre-filled) ───────────────────────────────────────────────
  const [name, setName]               = useState(place.name ?? '');
  const [description, setDescription] = useState(place.description ?? '');
  const [address, setAddress]         = useState(place.address ?? '');
  const [phone, setPhone]             = useState(place.phone ?? '');
  const [openingTime, setOpeningTime] = useState(place.opening_time ? place.opening_time.substring(0, 5) : '08:00');
  const [closingTime, setClosingTime] = useState(place.closing_time ? place.closing_time.substring(0, 5) : '17:00');
  const [selectedCategory, setSelectedCategory] = useState(place.category_id ?? null);
  const [imageUri, setImageUri]       = useState(null);       // null = keep existing
  const [pickedLocation, setPickedLocation] = useState({
    latitude: place.latitude,
    longitude: place.longitude,
  });

  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Fetch categories once
  React.useEffect(() => {
    apiFetchCategories().then((data) => {
      if (data) {
        setCategories(data);
        setCategoriesLoaded(true);
      }
    }).catch((err) => console.warn('Gagal fetch categories:', err.message));
  }, []);

  // ── Image picker ──────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Diperlukan', 'Izin akses galeri diperlukan untuk memilih foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImageUri(manipulated.uri);
    }
  };

  // ── Open map picker ───────────────────────────────────────────────────────
  const openMapPicker = useCallback(() => {
    navigation.navigate('MapPicker', {
      initialCoordinate: pickedLocation,
      onConfirm: (coord) => setPickedLocation(coord),
    });
  }, [navigation, pickedLocation]);

  // ── Save changes ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama bengkel harus diisi');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Pilih kategori bengkel');
      return;
    }
    if (!pickedLocation) {
      Alert.alert('Error', 'Pilih lokasi bengkel di peta');
      return;
    }

    setLoading(true);
    let photoUrl = place.photo_url; // keep existing by default

    try {
      // Upload new photo if changed
      if (imageUri) {
        const fileName = `bengkel_${Date.now()}.jpg`;
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('bengkel-photos')
          .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
          Alert.alert('Error', 'Gagal mengunggah foto: ' + uploadError.message);
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('bengkel-photos')
          .getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      const updateData = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        opening_time: openingTime || '08:00',
        closing_time: closingTime || '17:00',
        category_id: selectedCategory,
        latitude: pickedLocation.latitude,
        longitude: pickedLocation.longitude,
        photo_url: photoUrl,
      };

      try {
        await apiUpdatePlace(place.id, updateData);
      } catch (err) {
        Alert.alert('Error', 'Gagal menyimpan perubahan: ' + err.message);
        setLoading(false);
        return;
      }

      Alert.alert('Berhasil', 'Perubahan berhasil disimpan!');
      onSaved?.();
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Terjadi kesalahan: ' + err.message);
    }

    setLoading(false);
  };

  // ── Cancel with confirmation ──────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert('Batalkan Perubahan?', 'Perubahan yang belum disimpan akan hilang.', [
      { text: 'Lanjut Edit', style: 'cancel' },
      { text: 'Batalkan', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // ── Current photo to display ──────────────────────────────────────────────
  const displayPhotoUri = imageUri ?? place.photo_url;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
          <Text style={styles.headerBtnText}>Batal</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Bengkel</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerBtn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.headerSaveText}>Simpan</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo */}
        <TouchableOpacity style={styles.photoUpload} onPress={pickImage}>
          {displayPhotoUri ? (
            <>
              <Image source={{ uri: displayPhotoUri }} style={styles.photoPreview} />
              <View style={styles.photoEditOverlay}>
                <MaterialCommunityIcons name="camera-plus" size={24} color={colors.white} />
                <Text style={styles.photoEditText}>Tap untuk ganti foto</Text>
              </View>
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons name="camera-plus" size={40} color={colors.primary} />
              <Text style={styles.photoPlaceholderText}>Pilih Foto Bengkel</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nama Bengkel *</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="store" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Contoh: Bengkel Jaya Motor"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Category */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kategori *</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryOption,
                  selectedCategory === cat.id && {
                    borderColor: getCategoryColor(cat.icon_name),
                    backgroundColor: getCategoryColor(cat.icon_name) + '20',
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <MaterialCommunityIcons
                  name={getCategoryIcon(cat.icon_name)}
                  size={20}
                  color={selectedCategory === cat.id ? getCategoryColor(cat.icon_name) : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryOptionText,
                    selectedCategory === cat.id && { color: getCategoryColor(cat.icon_name) },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Alamat</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="map-marker" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Jl. Contoh No.123, Kota"
              placeholderTextColor={colors.textMuted}
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>No. Telepon</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="phone" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="081234567890"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Opening Hours */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Jam Operasional</Text>
          <View style={styles.hoursRow}>
            <View style={[styles.inputContainer, styles.hourInput]}>
              <MaterialCommunityIcons name="clock-start" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="08:00"
                placeholderTextColor={colors.textMuted}
                value={openingTime}
                onChangeText={setOpeningTime}
              />
            </View>
            <Text style={styles.hoursSeparator}>—</Text>
            <View style={[styles.inputContainer, styles.hourInput]}>
              <MaterialCommunityIcons name="clock-end" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="17:00"
                placeholderTextColor={colors.textMuted}
                value={closingTime}
                onChangeText={setClosingTime}
              />
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Deskripsi / Layanan</Text>
          <View style={[styles.inputContainer, styles.textAreaContainer]}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Deskripsi layanan bengkel..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Location — always shows map preview since we have existing coords */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lokasi Bengkel *</Text>
          <View style={styles.locationPreviewWrap}>
            <View style={styles.mapPreviewCard}>
              <MapView
                style={styles.mapPreview}
                provider={PROVIDER_GOOGLE}
                customMapStyle={mapStyle}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                initialRegion={{
                  latitude: pickedLocation.latitude,
                  longitude: pickedLocation.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                region={{
                  latitude: pickedLocation.latitude,
                  longitude: pickedLocation.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
              >
                <Marker coordinate={pickedLocation}>
                  <View style={styles.previewMarker}>
                    <MaterialCommunityIcons name="map-marker" size={28} color={colors.primary} />
                  </View>
                </Marker>
              </MapView>
              <TouchableOpacity style={styles.changeLocBtn} onPress={openMapPicker}>
                <MaterialCommunityIcons name="pencil" size={14} color={colors.primary} />
                <Text style={styles.changeLocText}>Ubah</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.coordReadOnly}>
              {pickedLocation.latitude.toFixed(6)}, {pickedLocation.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Save Button (also at bottom for convenience) */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={22} color={colors.white} />
              <Text style={styles.saveButtonText}>Simpan Perubahan</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    minWidth: 60,
  },
  headerBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    marginLeft: 4,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSaveText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 60,
  },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  photoUpload: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.borderPrimary,
    borderStyle: 'dashed',
    position: 'relative',
  },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,28,30,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditText: {
    color: colors.white,
    fontSize: 13,
    marginTop: 6,
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
  },
  photoPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },

  inputGroup: { marginBottom: 16 },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingVertical: 14,
  },
  textAreaContainer: { alignItems: 'flex-start' },
  textArea: { minHeight: 80, paddingTop: 14 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  categoryOptionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },

  locationPreviewWrap: {},
  mapPreviewCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    position: 'relative',
  },
  mapPreview: { width: '100%', height: 160 },
  previewMarker: { marginBottom: 14 },
  changeLocBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgOverlay,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeLocText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  coordReadOnly: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.md,
    marginTop: 8,
    ...shadow.colored(colors.primary),
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },

  // ── Hours input ──────────────────────────────────────────────────────────
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourInput: {
    flex: 1,
  },
  hoursSeparator: {
    color: colors.textMuted,
    fontSize: 18,
    marginHorizontal: 10,
    fontWeight: '600',
  },
});
