import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

/**
 * Google Maps API key for the native Android map (react-native-maps).
 *
 * Requires a billing-enabled GCP project. The Maps SDK for Android
 * provides $200/month free credit (~28K loads). Set a $0 budget alert
 * to stay within free-tier limits. See docs/DEVELOPMENT.md for setup.
 */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey && process.env.EAS_BUILD === 'true') {
  throw new Error(
    'GOOGLE_MAPS_API_KEY environment variable is required for native builds. ' +
      'Set it in eas.json env or as an EAS secret.',
  );
}

const config: ExpoConfig = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey ?? '',
      },
    },
  },
};

export default config;
