import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PlayerPage() {
  const { kind, id } = useParams()
  const [embed, setEmbed] = useState(null)

  useEffect(() => {
    async function fetchEmbed() {
      try {
        const endpoint = kind === 'tv' ? `${API_BASE}/vidsrc/embed/tv` : `${API_BASE}/vidsrc/embed/movie`
        const res = await axios.get(endpoint, { params: { tmdb: id } })
        setEmbed(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchEmbed()
  }, [kind, id])

  return (
    <div style={{ padding: 14 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {embed?.embed_url ? (
          <div style={{ position: 'relative', paddingTop: '56.25%' }}>
            <iframe title="player" src={embed.embed_url} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} allowFullScreen frameBorder={0}></iframe>
          </div>
        ) : (
          <div>Loading player...</div>
        )}
      </div>
    </div>
  )
}
