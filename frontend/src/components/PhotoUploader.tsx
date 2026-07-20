import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

interface Props {
  onFiles: (files: File[]) => void
  busy?: boolean
}

// A pure dropzone / file-picker: it hands selected files to the parent and
// doesn't care whether they get uploaded now (editing) or staged for upload
// on save (a brand-new entry that has no id yet).
export default function PhotoUploader({ onFiles, busy }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files))
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
          if (e.target.files?.length) onFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      <UploadCloud size={22} />
      <div className="photo-uploader-text">
        {busy ? 'Uploading…' : 'Drag photos here, or click to choose files'}
      </div>
    </div>
  )
}
