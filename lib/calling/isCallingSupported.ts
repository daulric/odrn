import Constants from 'expo-constants';

export function isCallingSupported(): boolean {
  // Expo Go doesn't include react-native-webrtc or other custom native modules.
  return (Constants as any).appOwnership !== 'expo';
}


