import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { adminAuthApi } from '../../services/adminApi'
import { guardApi, type GuardUser, type VehicleInfo } from '../../services/guardApi'
import { formatPlateInput } from '../../utils/plateFormat'
import { formatDateShort } from '../../utils/formatDate'
import { useModalAnimation } from '../../hooks/useModalAnimation'
import GuardActivityLogs from './GuardActivityLogs'

interface GuardDetailsProps {
  isOpen: boolean
  user: GuardUser | null
  onClose: () => void
  onUpdate?: () => void
}

const roleLabel = (role: string) => (role === 'resident' ? 'Resident' : 'Security Guard')

const userFullName = (user: GuardUser) =>
  [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const CarIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-9-4h10l1.5-4.5A2 2 0 0016.6 6H7.4a2 2 0 00-1.9 1.5L4 13m0 0v5a1 1 0 001 1h1m12-6v5a1 1 0 001 1h1M4 13h16" />
  </svg>
)

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)



const GuardDetailsModal = ({ isOpen, user, onClose, onUpdate }: GuardDetailsProps) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [genders, setGenders] = useState<{ gender_id: number; gender: string }[]>([])
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([])

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix_name: '',
    username: '',
    email: '',
    contact_number: '',
    birth_date: '',
    gender: '',
    address: '',
    plate_number: '',
    car_model: '',
    car_color: '',
  })

  useEffect(() => {
    if (!user) return
    setIsEditing(false)
    setIsDeleting(false)
    setError('')
    setForm({
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      suffix_name: '',
      username: user.username || '',
      email: user.email || '',
      contact_number: user.contact_number || '',
      birth_date: user.birth_date ? user.birth_date.split('T')[0] : '',
      gender: String(user.gender?.gender_id || ''),
      address: user.address || '',
      plate_number: formatPlateInput(user.plate_number || ''),
      car_model: user.car_model || '',
      car_color: user.car_color || '',
    })

    const initialVehicles: VehicleInfo[] =
      user.vehicles && user.vehicles.length > 0
        ? user.vehicles.map((v) => ({
            vehicle_id: v.vehicle_id,
            plate_number: formatPlateInput(v.plate_number || ''),
            car_model: v.car_model || '',
            car_color: v.car_color || '',
            is_primary: Boolean(v.is_primary),
          }))
        : user.plate_number
          ? [
              {
                plate_number: formatPlateInput(user.plate_number),
                car_model: user.car_model || '',
                car_color: user.car_color || '',
                is_primary: true,
              },
            ]
          : [
              {
                plate_number: '',
                car_model: '',
                car_color: '',
                is_primary: true,
              },
            ]

    if (initialVehicles.length > 0 && !initialVehicles.some((v) => v.is_primary)) {
      initialVehicles[0].is_primary = true
    }
    setVehicles(initialVehicles)
  }, [user])

  const displayVehicles = useMemo<VehicleInfo[]>(() => {
    if (!user) return []
    if (user.vehicles && user.vehicles.length > 0) {
      return user.vehicles
    }
    if (user.plate_number) {
      return [
        {
          plate_number: user.plate_number,
          car_model: user.car_model || 'Vehicle',
          car_color: user.car_color || 'N/A',
          is_primary: true,
        },
      ]
    }
    return []
  }, [user])

  const handleAddVehicle = () => {
    if (vehicles.length >= 10) return
    setVehicles((prev) => [
      ...prev,
      {
        plate_number: '',
        car_model: '',
        car_color: '',
        is_primary: prev.length === 0,
      },
    ])
  }

  const handleRemoveVehicle = (index: number) => {
    if (vehicles.length <= 1) return
    setVehicles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (!updated.some((v) => v.is_primary) && updated.length > 0) {
        updated[0].is_primary = true
      }
      return updated
    })
  }

  const handleSetPrimaryVehicle = (index: number) => {
    setVehicles((prev) =>
      prev.map((v, i) => ({
        ...v,
        is_primary: i === index,
      }))
    )
  }

  const handleVehicleChange = (index: number, field: keyof VehicleInfo, value: string) => {
    setVehicles((prev) =>
      prev.map((v, i) => {
        if (i !== index) return v
        const val = field === 'plate_number' ? formatPlateInput(value) : value
        return {
          ...v,
          [field]: val,
        }
      })
    )
  }

  const loadGendersIfNeeded = async () => {
    if (genders.length > 0) return
    try {
      const res = await adminAuthApi.loadGenders()
      setGenders(res.data?.genders ?? [])
    } catch {
      // Ignore fallback
    }
  }

  const handleStartEdit = () => {
    loadGendersIfNeeded()
    setIsEditing(true)
    setError('')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError('')

    const isResident = user.role === 'resident'

    try {
      const payload: Record<string, any> = {
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
        contact_number: form.contact_number,
        birth_date: form.birth_date,
        gender: form.gender,
        address: form.address,
      }

      if (isResident) {

        if (vehicles.length === 0) {
          setError('At least one vehicle must be registered.')
          setSaving(false)
          return
        }

        // Validate each vehicle has plate, model, color
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i]
          if (!v.plate_number.trim()) {
            setError(`Vehicle #${i + 1} is missing a plate number.`)
            setSaving(false)
            return
          }
          if (!v.car_model.trim()) {
            setError(`Vehicle #${i + 1} is missing a vehicle model.`)
            setSaving(false)
            return
          }
          if (!v.car_color.trim()) {
            setError(`Vehicle #${i + 1} is missing a vehicle color.`)
            setSaving(false)
            return
          }
        }

        // Validate duplicate plate numbers
        const cleanPlates = vehicles.map((v) => v.plate_number.trim().toUpperCase().replace(/\s+/g, ''))
        const plateSet = new Set(cleanPlates)
        if (plateSet.size !== cleanPlates.length) {
          setError('Duplicate plate numbers detected. Each vehicle must have a unique plate number.')
          setSaving(false)
          return
        }

        payload.vehicles = vehicles
        const primary = vehicles.find((v) => v.is_primary) || vehicles[0]
        payload.plate_number = primary.plate_number
        payload.car_model = primary.car_model
        payload.car_color = primary.car_color
      } else {
        payload.suffix_name = form.suffix_name || null
      }

      await guardApi.updateUser(user.user_id, payload, isResident)
      setIsEditing(false)
      onUpdate?.()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const resp = axiosErr.response?.data
      if (resp?.errors) {
        setError(Object.values(resp.errors).flat().join(' '))
      } else {
        setError(resp?.message || 'Failed to update details.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!user) return
    setDeleting(true)
    setError('')
    try {
      await guardApi.deleteUser(user.user_id, user.role === 'resident')
      setIsDeleting(false)
      onUpdate?.()
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || 'Failed to delete account.')
    } finally {
      setDeleting(false)
    }
  }

  if (!shouldRender || !user) return null

  const isResident = user.role === 'resident'

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={onClose}>
      <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
      <div
        className={`relative flex h-[min(92vh,960px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#18181e]/80 backdrop-blur-xl shadow-2xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-6 sm:px-8">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-zinc-100 sm:text-2xl">{roleLabel(user.role)} Details</h2>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && !isDeleting && (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  <EditIcon />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDeleting(true); setError('') }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                >
                  <TrashIcon />
                  Delete
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close staff details"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {isDeleting ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center backdrop-blur-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <TrashIcon />
              </div>
              <h3 className="mt-4 text-lg font-bold text-zinc-100">Confirm Deletion</h3>
              <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
                Are you sure you want to delete <strong className="text-zinc-200">{userFullName(user)}</strong>? This action will deactivate the account.
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleting(false)}
                  disabled={deleting}
                  className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete Account'}
                </button>
              </div>
            </div>
          ) : isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Edit Account Information</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 shadow-sm shadow-emerald-700/25 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">First Name</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Middle Name</label>
                  <input
                    type="text"
                    value={form.middle_name}
                    onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Last Name</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Username</label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Email</label>
                  <input
                    type="email"
                    required={isResident}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Contact Number</label>
                  <input
                    type="text"
                    required={isResident}
                    value={form.contact_number}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                    maxLength={11}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100"
                  >
                    <option value="">Select Gender</option>
                    {genders.length > 0 ? (
                      genders.map((g) => (
                        <option key={g.gender_id} value={g.gender_id}>
                          {g.gender}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                        <option value="3">Prefer Not to Say</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Address</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter complete address..."
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {isResident && (
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                        <CarIcon />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                          <span>Registered Vehicles</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              vehicles.length >= 10
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-white/10 text-zinc-300'
                            }`}
                          >
                            {vehicles.length} / 10 Cars
                          </span>
                        </h4>
                        <p className="text-xs text-zinc-400">
                          Add up to 10 vehicles authorized for gate access and ANPR license plate recognition.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddVehicle}
                      disabled={vehicles.length >= 10}
                      className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-emerald-600/15 border border-emerald-500/35 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-600/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <PlusIcon />
                      <span>Add Another Car</span>
                    </button>
                  </div>

                  {vehicles.length >= 10 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 flex items-center gap-2">
                      <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Maximum limit of 10 registered vehicles reached for this resident.</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {vehicles.map((veh, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border p-4 transition-all ${
                          veh.is_primary
                            ? 'border-emerald-500/30 bg-emerald-950/15'
                            : 'border-white/10 bg-black/25'
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-xs font-bold font-mono text-zinc-300">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                              Car {idx + 1}
                            </span>
                            {veh.is_primary ? (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                Primary Car
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryVehicle(idx)}
                                className="text-[11px] font-semibold text-zinc-400 hover:text-emerald-300 underline decoration-dotted transition-colors"
                              >
                                Set as primary
                              </button>
                            )}
                          </div>

                          {vehicles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveVehicle(idx)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                              title="Remove vehicle"
                            >
                              <TrashIcon />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                              Plate Number <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. ABC1234"
                              value={veh.plate_number}
                              onChange={(e) => handleVehicleChange(idx, 'plate_number', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 font-mono text-sm font-bold uppercase tracking-wider text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 placeholder:font-normal placeholder:tracking-normal"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                              Vehicle Model <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Toyota Vios"
                              value={veh.car_model}
                              onChange={(e) => handleVehicleChange(idx, 'car_model', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                              Vehicle Color <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Pearl White"
                              value={veh.car_color}
                              onChange={(e) => handleVehicleChange(idx, 'car_color', e.target.value)}
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-white/10 dark:bg-[#121212] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100 sm:text-3xl">{userFullName(user)}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {roleLabel(user.role)} - @{user.username}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Email" value={user.email ?? 'N/A'} />
                <Detail label="Username" value={user.username} />
                <Detail label="Date of Birth" value={formatDateShort(user.birth_date)} />
                <Detail label="Gender" value={user.gender?.gender ?? 'N/A'} />
                <Detail label="Contact Number" value={user.contact_number ?? 'N/A'} />
                <Detail label="Age" value={String(user.age ?? 'N/A')} />
                <Detail label="Address" value={user.address ?? 'N/A'} />
              </div>

              {isResident && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                        <CarIcon />
                      </span>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                        Registered Vehicles ({displayVehicles.length}/10)
                      </h4>
                    </div>
                    <span className="text-xs text-zinc-500">
                      Authorized for ANPR Camera & Gate Access
                    </span>
                  </div>

                  {displayVehicles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
                      No vehicles currently registered for this resident.
                    </div>
                  ) : (
                    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                      {displayVehicles.map((veh, idx) => (
                        <div
                          key={idx}
                          className={`relative overflow-hidden rounded-xl border p-4.5 transition-all ${
                            veh.is_primary
                              ? 'border-emerald-500/40 bg-emerald-950/20'
                              : 'border-white/10 bg-black/30 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-[11px] font-bold font-mono text-zinc-400">
                                #{idx + 1}
                              </span>
                              <div className="inline-block rounded-md border-2 border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-base font-extrabold tracking-wider text-white shadow-inner">
                                {veh.plate_number}
                              </div>
                            </div>
                            {veh.is_primary && (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                Primary
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider">Model</p>
                              <p className="mt-0.5 font-medium text-zinc-200 truncate">{veh.car_model || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider">Color</p>
                              <p className="mt-0.5 font-medium text-zinc-200 truncate">{veh.car_color || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!isResident && (
                <GuardActivityLogs userId={user.user_id} title={`Login / Logout History - ${user.first_name}`} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-white/5 bg-black/25 p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
  </div>
)

export default GuardDetailsModal
