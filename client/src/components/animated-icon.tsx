import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return <View onLayout={() => SplashScreen.hideAsync().finally(() => setTimeout(() => setVisible(false), 700))} style={styles.splashOverlay}><Image source={require('@/assets/images/secQRypt_logo.png')} style={styles.image} contentFit="contain" /><Text style={styles.appName}>SecQrypt</Text><ActivityIndicator color="#FFFFFF" size="small" style={styles.loader} /></View>;
}

const styles = StyleSheet.create({
  image: {
    width: 150,
    height: 150,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 18,
  },
  loader: {
    marginTop: 22,
  },
});
