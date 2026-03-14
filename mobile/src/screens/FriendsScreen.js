import { View, Text, TextInput, TouchableOpacity,
         FlatList, StyleSheet } from 'react-native'
import { useState } from 'react'
import { theme } from '../lib/theme'
import { subscribe } from '../lib/relay'

export function FriendsScreen() {
  const [friends, setFriends] = useState([])
  const [key, setKey]         = useState('')
  const [status, setStatus]   = useState('')

  const add = () => {
    const k = key.trim()
    if (k.length !== 64 || !/^[0-9a-f]+$/i.test(k)) {
      setStatus('Invalid key — must be 64 hex characters.')
      return
    }
    subscribe(k)
    setFriends(f => [...f, { address: k, handle: '' }])
    setKey('')
    setStatus('Following — syncing their profile via relay...')
    setTimeout(() => setStatus(''), 3000)
  }

  return (
    <View style={s.container}>
      <View style={s.addRow}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={key}
          onChangeText={setKey}
          placeholder="Paste 64-char node key..."
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={s.addBtn} onPress={add}>
          <Text style={s.addBtnText}>ADD</Text>
        </TouchableOpacity>
      </View>
      {status ? <Text style={s.status}>{status}</Text> : null}

      <FlatList
        data={friends}
        keyExtractor={f => f.address}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.handle}>{item.handle || 'unknown'}</Text>
            <Text style={s.key} selectable>{item.address.slice(0, 32)}…</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No friends yet.{'\n'}Share your node key to connect.</Text>
        }
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  addRow:    { flexDirection: 'row', gap: 8, padding: 12,
               borderBottomWidth: 1, borderBottomColor: theme.border },
  input:     { backgroundColor: theme.surface, color: theme.text, borderWidth: 1,
               borderColor: theme.border, padding: 10, fontFamily: 'monospace', fontSize: 13 },
  addBtn:    { backgroundColor: theme.accent, justifyContent: 'center', paddingHorizontal: 16 },
  addBtnText:{ color: '#000', fontWeight: 'bold', letterSpacing: 2, fontSize: 12 },
  status:    { color: theme.accent2, fontSize: 12, padding: 8, fontFamily: 'monospace' },
  card:      { borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 8,
               backgroundColor: theme.surface },
  handle:    { color: theme.text, fontSize: 15, fontWeight: 'bold' },
  key:       { color: theme.muted, fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  empty:     { color: theme.muted, textAlign: 'center', marginTop: 40, fontFamily: 'monospace',
               lineHeight: 22 },
})
