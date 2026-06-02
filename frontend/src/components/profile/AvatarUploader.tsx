// Circular avatar with click-to-upload. Shows the self-hosted /uploads image
// when present (NB: design-system rule bans *external* image URLs — a same-origin
// /uploads avatar is allowed; fallback is the CSS-circle initial). On file pick
// it previews immediately, then uploads via the injected `onUpload` callback.

import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { hashToHsl, initial } from '../../utils/avatarColor'

export interface AvatarUploaderProps {
  username: string
  avatarUrl: string | null
  size?: number
  // Uploads the file and resolves with the new avatar URL.
  onUpload: (file: File) => Promise<string>
}

export function AvatarUploader({ username, avatarUrl, size = 100, onUpload }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const shown = preview ?? avatarUrl

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    console.debug('[AvatarUploader] selected', file.name)
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)
    try {
      await onUpload(file)
      console.debug('[AvatarUploader] uploaded')
    } catch (err) {
      console.warn('[AvatarUploader] upload failed', err)
      setPreview(null) // revert to the previous avatar on failure
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localUrl)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      className="avatar-uploader"
      onClick={() => inputRef.current?.click()}
      style={{
        width: size, height: size, borderRadius: 999,
        border: '3px solid var(--white)', boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden', flexShrink: 0,
      }}
    >
      {shown ? (
        <img
          src={shown}
          alt={username}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: hashToHsl(username),
            color: '#fff', fontSize: size * 0.4, fontWeight: 700,
          }}
        >
          {initial(username)}
        </div>
      )}

      <div className="avatar-overlay">
        {uploading ? <Loader2 size={22} className="spin" /> : <Camera size={22} />}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  )
}
