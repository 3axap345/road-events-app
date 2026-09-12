import {
  Camera,
  Map,
  Marker,
  UserLocation
} from '@maplibre/maplibre-react-native';
import { View } from 'react-native';

import type { MapProvider } from './MapProvider';
import { regionToBounds } from './maplibre-region';

const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export const ReactNativeMapProvider: MapProvider = ({
  region,
  markers,
  onMarkerPress,
  showsUserLocation = false
}) => {
  const bounds = regionToBounds(region);

  return (
    <Map
      mapStyle={MAP_STYLE_URL}
      style={{ flex: 1 }}
    >
      <Camera
        initialViewState={{
          bounds
        }}
      />

      {showsUserLocation ? <UserLocation /> : null}

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