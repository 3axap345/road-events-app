import {
  Camera,
  Map,
  Marker
} from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import type { MapProvider } from './MapProvider';
import {
  getUserLocationCameraStop,
  regionToBounds
} from './maplibre-region';

const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export const ReactNativeMapProvider: MapProvider = ({
  region,
  markers,
  userLocation,
  onMarkerPress,
  showsUserLocation = false
}) => {
  const bounds = regionToBounds(region);

  const userLocationCameraStop =
    getUserLocationCameraStop(userLocation);

  const cameraKey = userLocation
    ? `user-location-${userLocation.latitude}-${userLocation.longitude}`
    : 'fallback-region';

  return (
    <Map
      mapStyle={MAP_STYLE_URL}
      style={{ flex: 1 }}
    >
      <Camera
        key={cameraKey}
        initialViewState={{
          ...(userLocationCameraStop ?? { bounds })
        }}
        trackUserLocation={
          showsUserLocation ? 'default' : undefined
        }
      />

      {userLocation ? (
        <Marker
          id="current-user-location"
          lngLat={[
            userLocation.longitude,
            userLocation.latitude
          ]}
        >
          <View style={styles.userLocationMarker}>
            <View style={styles.userLocationDot} />
          </View>
        </Marker>
      ) : null}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          id={marker.id}
          lngLat={[
            marker.coordinate.longitude,
            marker.coordinate.latitude
          ]}
          onPress={() => onMarkerPress?.(marker.id)}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#111827',
              borderWidth: 3,
              borderColor: '#ffffff'
            }}
          />
        </Marker>
      ))}
    </Map>
  );
};

const styles = StyleSheet.create({
  userLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  userLocationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#38BDF8'
  }
});
