import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { fetchPlaces as apiFetchPlaces, fetchCategories as apiFetchCategories, createPlace as apiCreatePlace, deletePlace as apiDeletePlace } from '../services/api';
import { getCategoryIcon, getCategoryColor } from '../utils/icons';
import { colors, radius, shadow, mapStyle } from '../theme';

export default function AdminDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress]         = useState('');
  const [phone, setPhone]             = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('17:00');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [imageUri, setImageUri]       = useState(null);
  const [pickedLocation, setPickedLocation] = useState(null); // { latitude, longitude }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [categories, setCategories]   = useState([]);
  const [places, setPlaces]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showForm, setShowForm]       = useState(true);

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCategories();
    fetchPlaces();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await apiFetchCategories();
      if (data) setCategories(data);
    } catch (err) {
      console.warn('Gagal fetch categories:', err.message);
    }
  };

  const fetchPlaces = async () => {
    try {
      const data = await apiFetchPlaces();
      // Re-nest for compatibility with existing card rendering
      const normalized = (data ?? []).map((p) => ({
        ...p,
        categories: { name: p.category_name, icon_name: p.icon_name },
      }));
      setPlaces(normalized);
    } catch (err) {
      console.warn('Gagal fetch places:', err.message);
    }
  };

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
      initialCoordinate: pickedLocation ?? undefined,
      onConfirm: (coord) => setPickedLocation(coord),
    });
  }, [navigation, pickedLocation]);

  // ── Save new bengkel ──────────────────────────────────────────────────────
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
    let photoUrl = null;

    try {
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

      const { error } = await apiCreatePlace({
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
      }).then(() => ({ error: null })).catch((e) => ({ error: e }));

      if (error) {
        Alert.alert('Error', 'Gagal menyimpan data: ' + error.message);
        setLoading(false);
        return;
      }

      Alert.alert('Berhasil', 'Bengkel baru berhasil ditambahkan!');
      resetForm();
      fetchPlaces();
    } catch (err) {
      Alert.alert('Error', 'Terjadi kesalahan: ' + err.message);
    }

    setLoading(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAddress('');
    setPhone('');
    setOpeningTime('08:00');
    setClosingTime('17:00');
    setSelectedCategory(null);
    setImageUri(null);
    setPickedLocation(null);
  };

  // ── Delete bengkel ────────────────────────────────────────────────────────
  const handleDelete = (placeId) => {
    Alert.alert(
      'Hapus Bengkel',
      'Yakin ingin menghapus bengkel ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeletePlace(placeId);
              fetchPlaces();
            } catch (err) {
              Alert.alert('Error', 'Gagal menghapus: ' + err.message);
            }
          },
        },
      ]
    );
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.replace('Home');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgBase} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard Admin</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, showForm && styles.tabActive]}
          onPress={() => setShowForm(true)}
        >
          <MaterialCommunityIcons
            name="plus-circle"
            size={18}
            color={showForm ? colors.textInverse : colors.textSecondary}
          />
          <Text style={[styles.tabText, showForm && styles.tabTextActive]}>
            Tambah Baru
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !showForm && styles.tabActive]}
          onPress={() => setShowForm(false)}
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={18}
            color={!showForm ? colors.textInverse : colors.textSecondary}
          />
          <Text style={[styles.tabText, !showForm && styles.tabTextActive]}>
            Daftar ({places.length})
          </Text>
        </TouchableOpacity>
      </View>

      {showForm ? (
        /* ── Tab 1: Add Form ── */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Upload */}
          <TouchableOpacity style={styles.photoUpload} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photoPreview} />
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

          {/* Location Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lokasi Bengkel *</Text>
            {pickedLocation ? (
              /* Preview map after location is picked */
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
                  >
                    <Marker coordinate={pickedLocation}>
                      <View style={styles.previewMarker}>
                        <MaterialCommunityIcons name="map-marker" size={28} color={colors.primary} />
                      </View>
                    </Marker>
                  </MapView>
                  {/* Change location button overlay */}
                  <TouchableOpacity style={styles.changeLocBtn} onPress={openMapPicker}>
                    <MaterialCommunityIcons name="pencil" size={14} color={colors.primary} />
                    <Text style={styles.changeLocText}>Ubah</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.coordReadOnly}>
                  {pickedLocation.latitude.toFixed(6)}, {pickedLocation.longitude.toFixed(6)}
                </Text>
              </View>
            ) : (
              /* Pick location button */
              <TouchableOpacity style={styles.pickLocBtn} onPress={openMapPicker}>
                <MaterialCommunityIcons name="map-marker-plus" size={24} color={colors.primary} />
                <View style={styles.pickLocTextWrap}>
                  <Text style={styles.pickLocTitle}>Pilih Lokasi di Peta</Text>
                  <Text style={styles.pickLocSub}>Tap untuk membuka peta</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Save Button */}
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
                <Text style={styles.saveButtonText}>Simpan Bengkel</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── Tab 2: Places List ── */
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="store-off" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Belum ada bengkel</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.placeCard}>
              <View style={styles.placeCardContent}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.placeCardImage} />
                ) : (
                  <View
                    style={[
                      styles.placeCardImagePlaceholder,
                      { backgroundColor: getCategoryColor(item.categories?.icon_name) + '20' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getCategoryIcon(item.categories?.icon_name)}
                      size={22}
                      color={getCategoryColor(item.categories?.icon_name)}
                    />
                  </View>
                )}
                <View style={styles.placeCardInfo}>
                  <Text style={styles.placeCardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.placeCardCategory}>{item.categories?.name || 'Lainnya'}</Text>
                  <Text style={styles.placeCardCoord}>
                    {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                  </Text>
                </View>
                {/* Action buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      navigation.navigate('EditBengkel', { place: item, onSaved: fetchPlaces })
                    }
                  >
                    <MaterialCommunityIcons name="pencil" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item.id)}
                  >
                    <MaterialCommunityIcons name="trash-can" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
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
    padding: 8,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  tabTextActive: {
    color: colors.textInverse,
  },

  // ── Form ──────────────────────────────────────────────────────────────────
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
  },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
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

  // ── Location picker ───────────────────────────────────────────────────────
  pickLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 16,
  },
  pickLocTextWrap: { flex: 1, marginLeft: 12 },
  pickLocTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  pickLocSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  locationPreviewWrap: {},
  mapPreviewCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    position: 'relative',
  },
  mapPreview: {
    width: '100%',
    height: 160,
  },
  previewMarker: {
    marginBottom: 14, // offset pin tip
  },
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

  // ── Save button ───────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.md,
    marginTop: 8,
    ...shadow.colored(colors.success),
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: { padding: 16, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginTop: 12 },

  placeCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  placeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  placeCardImage: { width: 50, height: 50, borderRadius: 10 },
  placeCardImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeCardInfo: { flex: 1, marginLeft: 12 },
  placeCardName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  placeCardCategory: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  placeCardCoord: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: { padding: 8 },

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
