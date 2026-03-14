import { View, Text, TextInput, TouchableOpacity,
         StyleSheet, ScrollView } from 'react-native'
import { useState, useEffect } from 'react'
import { theme } from '../lib/theme'
import { getIdentity } from '../lib/identity'

export function ProfileScreen() {
  const [identity, setIdentity] = useState(null)
  const [handle, setHandle]     = useState('')
  const [bio, setBio]           = useState('')
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    getIdentity().then(setIdentity)
  }, [])

  const save = () => {
    // In full implementation, this broadcasts via relay
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.nodeCard}>
        <Text style={s.label}>YOUR NODE KEY</Text>
        <Text style={s.nodeKey} selectable>
          {identity?.pubkey?.slice(0, 32)}…
        </Text>
        <Text style={s.hint}>Share this so others can add you as a friend.</Text>
      </View>

      <Text style={s.label}>HANDLE</Text>
      <TextInput
        style={s.input}
        value={handle}
        onChangeText={setHandle}
        placeholder="@yourhandle"
        placeholderTextColor={theme.muted}
        maxLength={64}
        autoCapitalize="none"
      />

      <Text style={s.label}>BIO</Text>
      <TextInput
        style={[s.input, { height: 100 }]}
        value={bio}
        onChangeText={setBio}
        placeholder="a few words about you"
        placeholderTextColor={theme.muted}
        maxLength={500}
        multiline
      />

      <TouchableOpacity style={s.saveBtn} onPress={save}>
        <Text style={s.saveBtnText}>{saved ? 'SAVED ✓' : 'SAVE & BROADCAST'}</Text>
      </TouchableOpacity>

      <View style={s.statsRow}>
        <Text style={s.hint}>No follower counts. No likes. No metrics.</Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.bg },
  content:     { padding: 16, gap: 8 },
  nodeCard:    { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.accent,
                 padding: 12, marginBottom: 16 },
  label:       { color: theme.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4,
                 fontFamily: 'monospace' },
  nodeKey:     { color: theme.accent, fontSize: 11, fontFamily: 'monospace', marginBottom: 4 },
  hint:        { color: theme.muted, fontSize: 11 },
  input:       { backgroundColor: theme.surface, color: theme.text, borderWidth: 1,
                 borderColor: theme.border, padding: 10, fontFamily: 'monospace',
                 fontSize: 14, marginBottom: 12 },
  saveBtn:     { backgroundColor: theme.accent, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#000', fontWeight: 'bold', letterSpacing: 2, fontSize: 13 },
  statsRow:    { marginTop: 24, alignItems: 'center' },
})
