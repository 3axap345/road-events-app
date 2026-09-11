import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform } from 'react-native';

import type { MapProvider } from './MapProvider';

export const ReactNativeMapProvider: MapProvider = ({
  region,
  markers,
  onMarkerPress,
  showsUserLocation = false
}) => (
  <MapView
    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
    region={region}
    showsUserLocation={showsUserLocation}
    style={{ flex: 1 }}
  >
    {markers.map((marker) => (
      <Marker
        key={marker.id}
        coordinate={marker.coordinate}
        title={marker.title}
        description={marker.description}
        onPress={() => onMarkerPress?.(marker.id)}
      />
    ))}
  </MapView>
);
