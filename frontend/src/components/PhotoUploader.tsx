import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { uploadPhoto } from '../api/client'
import type { Photo } from '../api/types'

interface Props {
  entryId: number
  onUploaded: (photo: Photo) => void
}

export default function PhotoUploader({ entryId, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadPhoto(entryId, file)
        onUploaded(photo)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`photo-uploader${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/tiff,image/heic"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <UploadCloud size={22} />
      <div className="photo-uploader-text">
        {uploading ? 'Uploading…' : 'Drag photos here, or click to choose files'}
      </div>
      {error && <div className="photo-uploader-error">{error}</div>}
    </div>
  )
}
