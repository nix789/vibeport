import { View, Text, FlatList, TextInput, TouchableOpacity,
         StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useState, useEffect } from 'react'
import { theme } from '../lib/theme'
import { send, on } from '../lib/relay'

export function HomeScreen() {
  const [posts, setPosts]   = useState([])
  const [text, setText]     = useState('')
  const [mood, setMood]     = useState('')

  useEffect(() => {
    const off = on('__binary', () => {
      // incoming posts from relay would be parsed here
    })
    return off
  }, [])

  const submit = () => {
    if (!text.trim()) return
    const post = { type: 'new_post', payload: { content: text.trim(), mood, ts: Date.now() } }
    send(post)
    setPosts(p => [{ ...post.payload, id: Date.now() }, ...p])
    setText('')
    setMood('')
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="what's on your mind?"
          placeholderTextColor={theme.muted}
          multiline
          maxLength={2000}
        />
        <View style={s.composerRow}>
          <TextInput
            style={[s.input, s.moodInput]}
            value={mood}
            onChangeText={setMood}
            placeholder="mood"
            placeholderTextColor={theme.muted}
            maxLength={32}
          />
          <TouchableOpacity style={s.postBtn} onPress={submit}>
            <Text style={s.postBtnText}>POST</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        renderItem={({ item }) => (
          <View style={s.postCard}>
            <Text style={s.postContent}>{item.content}</Text>
            {item.mood ? <Text style={s.postMood}>feeling: {item.mood}</Text> : null}
            <Text style={s.postTime}>{new Date(item.ts).toLocaleTimeString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No posts yet. Say something.</Text>}
        contentContainerStyle={{ padding: 12 }}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.bg },
  composer:     { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  composerRow:  { flexDirection: 'row', gap: 8, marginTop: 8 },
  input:        { backgroundColor: theme.surface, color: theme.text, borderWidth: 1,
                  borderColor: theme.border, padding: 10, fontFamily: 'monospace', fontSize: 14 },
  moodInput:    { flex: 1 },
  postBtn:      { backgroundColor: theme.accent, justifyContent: 'center', paddingHorizontal: 20 },
  postBtnText:  { color: '#000', fontWeight: 'bold', fontSize: 12, letterSpacing: 2 },
  postCard:     { borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 8,
                  backgroundColor: theme.surface },
  postContent:  { color: theme.text, fontSize: 15 },
  postMood:     { color: theme.accent2, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  postTime:     { color: theme.muted, fontSize: 11, marginTop: 6 },
  empty:        { color: theme.muted, textAlign: 'center', marginTop: 40, fontFamily: 'monospace' },
})
