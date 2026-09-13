import {
  Camera,
  Map,
  Marker
} from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import type { MapProvider } from './MapProvider';
import { RoadEventMarker } from './RoadEventMarker';
import {
  getUserLocationCameraStop,
  regionToBounds
} from './maplibre-region';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const ReactNativeMapProvider: MapProvider = ({
  region,
  markers,
  userLocation,
  draftLocation,
  onMapLongPress,
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
      onLongPress={onMapLongPress ? (event) => {
        const [longitude, latitude] = event.nativeEvent.lngLat;
        onMapLongPress({ latitude, longitude });
      } : undefined}
      attribution
      attributionPosition={{ top: 144, right: 16 }}
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
          <RoadEventMarker eventType={marker.eventType} label={marker.title} />
        </Marker>
      ))}
      {draftLocation ? (
        <Marker
          id="report-location-draft"
          lngLat={[draftLocation.longitude, draftLocation.latitude]}
        >
          <View pointerEvents="none" style={styles.draftMarker} />
        </Marker>
      ) : null}
    </Map>
  );
};

const styles = StyleSheet.create({
  draftMarker: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#B45309'
  },
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
