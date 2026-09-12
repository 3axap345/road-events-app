import { useEffect, useState } from 'react';

import {
  expoForegroundLocationGateway,
  getCurrentLocation,
  type ForegroundLocationGateway
} from './location-service';
import type { CurrentLocationState } from './location-types';

export function useCurrentLocation(
  gateway: ForegroundLocationGateway = expoForegroundLocationGateway
): CurrentLocationState {
  const [location, setLocation] = useState<CurrentLocationState>({
    kind: 'loading'
  });

  useEffect(() => {
    let isMounted = true;

    void getCurrentLocation(
      gateway,
      (cachedLocation) => {
        if (isMounted) {
          setLocation(cachedLocation);
        }
      }
    ).then((nextLocation) => {
      if (isMounted) {
        setLocation(nextLocation);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [gateway]);

  return location;
}
