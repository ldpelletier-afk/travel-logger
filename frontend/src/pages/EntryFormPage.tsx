import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Trash2, Star, Loader2, Search, MapPin } from 'lucide-react'
import {
  createCategory,
  createEntry,
  deleteEntry,
  deletePhoto,
  geocodeAddress,
  getEntry,
  getNationalParks,
  getStateParks,
  getStates,
  listCategories,
  updateEntry,
  updatePhotoCaption,
  uploadPhoto,
} from '../api/client'
import type { Category, Entry, GeocodeResult, ParkPreset, Photo, StateFeature } from '../api/types'
import { midsizeUrl } from '../lib/photos'
import PhotoUploader from '../components/PhotoUploader'
import Lightbox from '../components/Lightbox'
import ParkPicker from '../components/ParkPicker'
import { ICON_KEYS, iconFor } from '../components/icons'

interface ExifPrompt {
  lat?: number
  lng?: number
  takenAt?: string
}

interface StagedPhoto {
  id: string
  file: File
  url: string
  caption: string
}

export default function EntryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [notes, setNotes] = useState('')

  const [geocoding, setGeocoding] = useState(false)
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[] | null>(null)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)

  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6B8E4E')
  const [newCatIcon, setNewCatIcon] = useState('map-pin')
  const [newCatSaving, setNewCatSaving] = useState(false)
  const [newCatError, setNewCatError] = useState<string | null>(null)

  const [states, setStates] = useState<StateFeature[]>([])
  const [nationalParks, setNationalParks] = useState<ParkPreset[]>([])
  const [pickerStateFips, setPickerStateFips] = useState('')
  const [stateParks, setStateParks] = useState<ParkPreset[]>([])
  const [stateParksStatus, setStateParksStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [stateParksError, setStateParksError] = useState<string | null>(null)

  const [entry, setEntry] = useState<Entry | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [coverPhotoId, setCoverPhotoId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(!isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [exifPrompt, setExifPrompt] = useState<ExifPrompt | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Photos chosen on a brand-new entry (which has no id to attach to yet).
  // They're held in memory with object-URL previews and uploaded right after
  // the entry is created on save.
  const [staged, setStaged] = useState<StagedPhoto[]>([])
  const [stagedCoverId, setStagedCoverId] = useState<string | null>(null)
  const stagedRef = useRef(staged)
  stagedRef.current = staged

  // Revoke any outstanding object URLs when leaving the page.
  useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.url)), [])

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
    getNationalParks().then(setNationalParks).catch(() => {})
    getStates().then((fc) => setStates(fc.features)).catch(() => {})
  }, [])

  const selectedCategoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name,
    [categories, categoryId],
  )
  const isNationalPark = selectedCategoryName === 'national park'
  const isStatePark = selectedCategoryName === 'state park'

  function applyParkPreset(park: ParkPreset) {
    setName(park.name)
    setLatitude(String(park.lat))
    setLongitude(String(park.lng))
  }

  async function handleCreateCategory() {
    const name = newCatName.trim().toLowerCase()
    if (!name) return setNewCatError('Name is required')
    setNewCatSaving(true)
    setNewCatError(null)
    try {
      const created = await createCategory({ name, color: newCatColor, icon: newCatIcon })
      const cats = await listCategories()
      setCategories(cats)
      setCategoryId(created.id)
      setShowNewCategory(false)
      setNewCatName('')
    } catch (e) {
      setNewCatError(String(e))
    } finally {
      setNewCatSaving(false)
    }
  }

  function handleLoadStateParks() {
    if (!pickerStateFips) return
    setStateParksStatus('loading')
    setStateParksError(null)
    getStateParks(pickerStateFips)
      .then((parks) => {
        setStateParks(parks)
        setStateParksStatus('loaded')
      })
      .catch((e) => {
        setStateParksError(String(e))
        setStateParksStatus('error')
      })
  }

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    getEntry(Number(id))
      .then((e) => {
        if (cancelled) return
        setEntry(e)
        setName(e.name)
        setCategoryId(e.category_id)
        setAddress(e.address)
        setLatitude(String(e.latitude))
        setLongitude(String(e.longitude))
        setVisitDate(e.visit_date ?? '')
        setNotes(e.notes)
        setPhotos(e.photos)
        setCoverPhotoId(e.cover_photo_id)
        setLoaded(true)
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  // Editing: upload straight to the existing entry. New entry: stage in memory
  // until the entry exists (on save).
  async function handleFiles(files: File[]) {
    if (isEdit && entry) {
      setPhotoBusy(true)
      setPhotoError(null)
      try {
        for (const file of files) {
          const photo = await uploadPhoto(entry.id, file)
          handlePhotoUploaded(photo)
        }
      } catch (e) {
        setPhotoError(String(e))
      } finally {
        setPhotoBusy(false)
      }
    } else {
      setStaged((prev) => [
        ...prev,
        ...files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          caption: '',
        })),
      ])
    }
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((s) => s.id !== id)
    })
    setStagedCoverId((prev) => (prev === id ? null : prev))
  }

  function setStagedCaption(id: string, caption: string) {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, caption } : s)))
  }

  function handlePhotoUploaded(photo: Photo) {
    setPhotos((prev) => [...prev, photo])
    setCoverPhotoId((prev) => prev ?? photo.id)

    const latNum = parseFloat(latitude)
    const lngNum = parseFloat(longitude)
    const locationDiffers =
      photo.exif_lat != null &&
      photo.exif_lng != null &&
      (Number.isNaN(latNum) ||
        Number.isNaN(lngNum) ||
        Math.abs(latNum - photo.exif_lat) > 1e-4 ||
        Math.abs(lngNum - photo.exif_lng) > 1e-4)
    const exifDate = photo.exif_taken_at ? photo.exif_taken_at.slice(0, 10) : undefined
    const dateDiffers = !!exifDate && exifDate !== visitDate

    if (locationDiffers || dateDiffers) {
      setExifPrompt({
        lat: locationDiffers ? (photo.exif_lat ?? undefined) : undefined,
        lng: locationDiffers ? (photo.exif_lng ?? undefined) : undefined,
        takenAt: dateDiffers ? exifDate : undefined,
      })
    }
  }

  function applyExifLocation() {
    if (!exifPrompt) return
    if (exifPrompt.lat != null) setLatitude(String(exifPrompt.lat))
    if (exifPrompt.lng != null) setLongitude(String(exifPrompt.lng))
    setExifPrompt((prev) => (prev && prev.takenAt ? { takenAt: prev.takenAt } : null))
  }

  function applyExifDate() {
    if (!exifPrompt?.takenAt) return
    setVisitDate(exifPrompt.takenAt)
    setExifPrompt((prev) => (prev && prev.lat != null ? { lat: prev.lat, lng: prev.lng } : null))
  }

  async function handleFindCoordinates() {
    if (!address.trim()) return
    setGeocoding(true)
    setGeocodeError(null)
    setGeocodeResults(null)
    try {
      const results = await geocodeAddress(address.trim())
      if (results.length === 0) setGeocodeError('No matches found for that address.')
      else setGeocodeResults(results)
    } catch (e) {
      setGeocodeError(String(e))
    } finally {
      setGeocoding(false)
    }
  }

  function applyGeocodeResult(r: GeocodeResult) {
    setLatitude(String(r.lat))
    setLongitude(String(r.lng))
    setGeocodeResults(null)
  }

  async function handleDeletePhoto(photoId: number) {
    await deletePhoto(photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setCoverPhotoId((prev) => (prev === photoId ? null : prev))
  }

  async function handleSetCover(photoId: number) {
    if (!entry) return
    setCoverPhotoId(photoId)
    await updateEntry(entry.id, { cover_photo_id: photoId })
  }

  async function handleCaptionBlur(photoId: number, caption: string) {
    await updatePhotoCaption(photoId, caption)
  }

  async function handleDelete() {
    if (!entry) return
    if (!window.confirm(`Delete "${entry.name}"? This removes its photos too.`)) return
    await deleteEntry(entry.id)
    navigate('/')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (!name.trim()) return setError('Name is required')
    if (categoryId === '') return setError('Choose a category')
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return setError('Latitude must be between -90 and 90')
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return setError('Longitude must be between -180 and 180')

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId,
        latitude: lat,
        longitude: lng,
        address: address.trim(),
        visit_date: visitDate || null,
        notes,
      }
      if (isEdit && entry) {
        const updated = await updateEntry(entry.id, payload)
        setEntry(updated)
      } else {
        const created = await createEntry(payload)
        // Upload the staged photos to the freshly-created entry, preserving
        // order (the backend makes the first upload the cover by default).
        const coverId = stagedCoverId ?? staged[0]?.id
        let chosenCoverPhotoId: number | null = null
        for (const sp of staged) {
          const photo = await uploadPhoto(created.id, sp.file)
          if (sp.caption.trim()) await updatePhotoCaption(photo.id, sp.caption.trim())
          if (sp.id === coverId) chosenCoverPhotoId = photo.id
        }
        // Only override the default (first) cover if the user picked another.
        if (chosenCoverPhotoId !== null && coverId !== staged[0]?.id) {
          await updateEntry(created.id, { cover_photo_id: chosenCoverPhotoId })
        }
        staged.forEach((s) => URL.revokeObjectURL(s.url))
        navigate('/')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && !loaded && !error) return <div className="empty-state">Loading…</div>

  return (
    <div className="entry-form-page">
      <Link to={isEdit && entry ? `/entries/${entry.id}` : '/'} className="back-link">
        ← {isEdit ? 'Entry' : 'Catalog'}
      </Link>

      <h1>{isEdit ? 'Edit entry' : 'New entry'}</h1>

      {error && <div className="form-error">{error}</div>}

      <form className="entry-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="form-field">
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} required>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="new-category-toggle"
          onClick={() => {
            setShowNewCategory((v) => !v)
            setNewCatError(null)
          }}
        >
          {showNewCategory ? 'Cancel new category' : '+ New category'}
        </button>

        {showNewCategory && (
          <div className="new-category-box">
            {newCatError && <div className="form-error">{newCatError}</div>}
            <div className="form-row">
              <label className="form-field">
                <span>Category name</span>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. lighthouse"
                />
              </label>
              <label className="form-field">
                <span>Color</span>
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="new-category-color"
                />
              </label>
            </div>
            <label className="form-field">
              <span>Icon</span>
              <div className="new-category-icons">
                {ICON_KEYS.map((key) => {
                  const Icon = iconFor(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`new-category-icon${newCatIcon === key ? ' active' : ''}`}
                      onClick={() => setNewCatIcon(key)}
                      aria-label={key}
                      aria-pressed={newCatIcon === key}
                    >
                      <Icon size={15} />
                    </button>
                  )
                })}
              </div>
            </label>
            <div className="form-actions">
              <button type="button" className="btn-primary" onClick={handleCreateCategory} disabled={newCatSaving}>
                {newCatSaving ? <Loader2 size={14} className="spin" /> : null}
                Create category
              </button>
            </div>
          </div>
        )}

        {isNationalPark && (
          <div className="form-field">
            <span>Pick a national park</span>
            <ParkPicker parks={nationalParks} onSelect={applyParkPreset} placeholder="Search 63 national parks…" />
          </div>
        )}

        {isStatePark && (
          <div className="form-field">
            <span>Pick a state park</span>
            <div className="address-lookup-row">
              <select value={pickerStateFips} onChange={(e) => setPickerStateFips(e.target.value)}>
                <option value="">Choose a state…</option>
                {[...states]
                  .sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME))
                  .map((s) => (
                    <option key={s.properties.STATEFP} value={s.properties.STATEFP}>
                      {s.properties.NAME}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLoadStateParks}
                disabled={!pickerStateFips || stateParksStatus === 'loading'}
              >
                {stateParksStatus === 'loading' ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                Load parks
              </button>
            </div>
            <span className="form-field-hint">
              Looks up state parks via OpenStreetMap. First lookup for a state can take up to 30 seconds; it's
              cached locally after that.
            </span>
            {stateParksStatus === 'error' && <div className="form-error">{stateParksError}</div>}
            {stateParksStatus === 'loaded' && (
              <ParkPicker parks={stateParks} onSelect={applyParkPreset} placeholder="Search state parks…" />
            )}
          </div>
        )}

        <label className="form-field">
          <span>Address</span>
          <div className="address-lookup-row">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Gettysburg, PA 17325"
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleFindCoordinates}
              disabled={geocoding || !address.trim()}
            >
              {geocoding ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
              Find
            </button>
          </div>
          <span className="form-field-hint">
            Looks up coordinates via OpenStreetMap (sends this text to a public geocoding service).
          </span>
        </label>

        {geocodeError && <div className="form-error">{geocodeError}</div>}

        {geocodeResults && (
          <div className="geocode-results">
            {geocodeResults.map((r, i) => (
              <button key={i} type="button" className="geocode-result" onClick={() => applyGeocodeResult(r)}>
                <MapPin size={13} />
                <span>{r.displayName}</span>
              </button>
            ))}
          </div>
        )}

        <div className="form-row">
          <label className="form-field">
            <span>Latitude</span>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 43.4726"
              required
            />
          </label>
          <label className="form-field">
            <span>Longitude</span>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. -72.3833"
              required
            />
          </label>
        </div>

        <label className="form-field">
          <span>Visit date</span>
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>

        <label className="form-field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : null}
            {isEdit ? 'Save changes' : 'Create entry'}
          </button>
          {isEdit && (
            <button type="button" className="btn-danger" onClick={handleDelete}>
              <Trash2 size={14} /> Delete entry
            </button>
          )}
        </div>
      </form>

      <div className="photo-section">
        <h2>Photos</h2>

        {!isEdit && (
          <p className="form-field-hint">
            Add photos now — they upload automatically when you create the entry.
          </p>
        )}

        {exifPrompt && (
          <div className="exif-prompt">
            <span>This photo has EXIF data that doesn't match the entry.</span>
            <div className="exif-prompt-actions">
              {exifPrompt.lat != null && (
                <button type="button" onClick={applyExifLocation}>
                  Use photo location ({exifPrompt.lat.toFixed(4)}, {exifPrompt.lng!.toFixed(4)})
                </button>
              )}
              {exifPrompt.takenAt && (
                <button type="button" onClick={applyExifDate}>
                  Use photo date ({exifPrompt.takenAt})
                </button>
              )}
              <button type="button" className="exif-prompt-dismiss" onClick={() => setExifPrompt(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <PhotoUploader onFiles={handleFiles} busy={photoBusy} />
        {photoError && <div className="form-error">{photoError}</div>}

        {isEdit && photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-grid-item">
                <button type="button" className="photo-grid-thumb" onClick={() => setLightboxIndex(i)}>
                  <img src={midsizeUrl(p.thumb_path)} alt={p.caption || ''} />
                  {coverPhotoId === p.id && (
                    <span className="photo-grid-cover-badge">
                      <Star size={11} fill="currentColor" /> Cover
                    </span>
                  )}
                </button>
                <input
                  className="photo-grid-caption"
                  defaultValue={p.caption}
                  placeholder="Caption…"
                  onBlur={(e) => handleCaptionBlur(p.id, e.target.value)}
                />
                <div className="photo-grid-actions">
                  {coverPhotoId !== p.id && (
                    <button type="button" onClick={() => handleSetCover(p.id)}>
                      Set as cover
                    </button>
                  )}
                  <button type="button" className="danger" onClick={() => handleDeletePhoto(p.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isEdit && staged.length > 0 && (
          <div className="photo-grid">
            {staged.map((sp) => {
              const isCover = (stagedCoverId ?? staged[0]?.id) === sp.id
              return (
                <div key={sp.id} className="photo-grid-item">
                  <div className="photo-grid-thumb photo-grid-thumb-static">
                    <img src={sp.url} alt={sp.caption || ''} />
                    {isCover && (
                      <span className="photo-grid-cover-badge">
                        <Star size={11} fill="currentColor" /> Cover
                      </span>
                    )}
                  </div>
                  <input
                    className="photo-grid-caption"
                    value={sp.caption}
                    placeholder="Caption…"
                    onChange={(e) => setStagedCaption(sp.id, e.target.value)}
                  />
                  <div className="photo-grid-actions">
                    {!isCover && (
                      <button type="button" onClick={() => setStagedCoverId(sp.id)}>
                        Set as cover
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => removeStaged(sp.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
