# **Driver Community Map**
Community road-event map built with React Native, Expo, TypeScript, Supabase, and React Native Maps.
## **Tech stack**
- React Native
- Expo SDK 57
- TypeScript
- Expo Router
- React Native Maps
- Expo Location
- Supabase
- Zustand
- TanStack Query
- Zod
## **Requirements**
- Node.js
- npm
- Expo account
- EAS CLI
- Android Studio / Android device for native development-build validation

Install EAS CLI if needed:

npm install -g eas-cli

Log in to Expo:

eas login
## **Install dependencies**
npm install

Do not use --force or --legacy-peer-deps to bypass dependency conflicts.
## **Environment variables**
Create a local .env file for development.

Example:

EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url

EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

Only values intentionally safe for inclusion in the client bundle may use the EXPO_PUBLIC_ prefix.

Never place privileged server-side secrets in the Expo application, including:

- Supabase service-role keys
- database passwords
- private API credentials
- signing secrets

Do not commit .env files containing real credentials.

For CI/CD or EAS builds, store sensitive build-time values using the appropriate Expo/EAS environment or secret-management mechanism rather than hardcoding them in the repository.
## **Development**
Start the Expo development server:

npx expo start

For this project, native functionality must ultimately be validated with a development build rather than relying only on Expo Go.
## **Development build**
Create an Android development build:

eas build --profile development --platform android

After installing the generated development client on the Android device or emulator, start Metro for the dev client:

npx expo start --dev-client

Then open the installed Driver Community Map development build.

If native dependencies or native configuration change, create a new development build before validating those changes.
## **Native validation**
Configuration tests do not replace testing on an actual development build.

The following behavior must be verified on a real Android device or emulator with the development client:

- the application launches successfully;
- Google Maps renders correctly;
- the Android Google Maps API key is accepted by the native build;
- foreground location permission is displayed by Android;
- granting location permission shows the user's location;
- denying location permission keeps the app usable and falls back to Bishkek;
- map markers render correctly and can be selected;
- the selected road-event card opens and dismisses correctly;
- Supabase anonymous authentication succeeds;
- active road events load from the configured Supabase project.
## **Project validation**
Run the repository checks before committing changes:

npm run lint

npm run typecheck

npm test

npx expo install --check

npx expo-doctor

git diff --check

All checks should pass before the task is considered complete.
## **EAS configuration**
Development builds are configured through eas.json.

The development profile must support the Expo development client required for native testing of:

- Expo Router
- Expo Location
- React Native Maps

Do not modify package versions or native dependencies unless there is a concrete reason to do so.
