import { StyleSheet, View } from 'react-native';

export default function MapRoutePlaceholder() {
  return <View accessibilityLabel="Экран карты" style={styles.screen} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' }
});
