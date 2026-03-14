/**
 * Logo.js
 * Black square with a large green "V" — the Vibeport app icon.
 * Used in the tab bar header and splash.
 */

import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../lib/theme'

export function Logo({ size = 40 }) {
  return (
    <View style={[s.box, { width: size, height: size, borderRadius: size * 0.18 }]}>
      <Text style={[s.v, { fontSize: size * 0.65, lineHeight: size * 0.78 }]}>V</Text>
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#00ff41',
  },
  v: {
    color: '#00ff41',
    fontWeight: '900',
    fontFamily: 'monospace',
    includeFontPadding: false,
  },
})
