import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { defaultTheme, getEnv } from '@ridefood/config';
import {
  MapViewFallback,
  type MapViewWrapperProps,
} from './MapViewFallback';

export type { MapMarker, MapViewWrapperProps } from './MapViewFallback';

/** Native MapView — falls back to mock map when Google Maps key is absent. */
export function MapViewWrapper({
  style,
  center,
  zoom = 14,
  markers = [],
  showsUserLocation = true,
  onPress,
  onMarkerPress,
}: MapViewWrapperProps) {
  const env = getEnv();
  if (!env.googleMapsApiKey) {
    return (
      <MapViewFallback
        style={style}
        center={center}
        zoom={zoom}
        markers={markers}
        onPress={onPress}
        onMarkerPress={onMarkerPress}
      />
    );
  }

  const latDelta = 0.02 * (16 / zoom);
  const lngDelta = 0.02 * (16 / zoom);

  return (
    <MapView
      style={[styles.map, style]}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      }}
      region={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      }}
      showsUserLocation={showsUserLocation}
      onPress={(e) => {
        const c = e.nativeEvent.coordinate;
        onPress?.({ lat: c.latitude, lng: c.longitude });
      }}
    >
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.coordinate.lat, longitude: m.coordinate.lng }}
          title={m.title}
          description={m.description}
          pinColor={m.color ?? defaultTheme.colors.primary}
          onPress={() => onMarkerPress?.(m.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%' },
});
