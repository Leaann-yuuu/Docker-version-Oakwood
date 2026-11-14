import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminNotificationsApi, type NotificationEntry } from '../services/adminApi'
import { formatDate } from '../utils/formatDate'
import { useModalAnimation } from '../hooks/useModalAnimation'
import ToastMessage from '../components/ToastMessage/ToastMessage'
import { MaskedEmail } from '../components/MaskedEmail/MaskedEmail'

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080/api').replace(/\/api\/?$/, '')

const resolveDocumentUrl = (path?: string | null): string | null => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/api/')) return `${BACKEND_ORIGIN}${path}`
  const clean = path.replace(/^\/+/, '')
  if (clean.startsWith('img/vehicles/or_cr/')) {
    return `${BACKEND_ORIGIN}/api/resident-documents/or_cr/${clean.split('/').pop()}`
  }
  if (clean.startsWith('img/vehicles/license/')) {
    return `${BACKEND_ORIGIN}/api/resident-documents/license/${clean.split('/').pop()}`
  }
  return `${BACKEND_ORIGIN}/storage/${clean}`
}

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  type: 'accept' | 'reject' | 'delete' | 'clear_all'
  loading: boolean
}

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  type,
  loading,
}: ConfirmationModalProps) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen)
  if (!shouldRender) return null

  const isDestructive = type === 'reject' || type === 'delete' || type === 'clear_all'
  const actionBtnClass = isDestructive
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white'

  const getConfirmButtonText = () => {
    if (loading) return 'Processing...'
    if (type === 'reject') return 'Reject Request'
    if (type === 'delete') return 'Delete Notification'
    if (type === 'clear_all') return 'Clear All'
    return 'Accept Request'
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={onCancel}
    >
      <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
      <div
        className={`relative w-full max-w-md rounded-xl bg-[#1e1e24]/80 p-6 shadow-2xl border border-white/10 backdrop-blur-xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-sm text-zinc-300 mb-6 leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${actionBtnClass}`}
          >
            {getConfirmButtonText()}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'accept' | 'reject' | 'delete' | 'clear_all'
    notificationId: number
  } | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{
    residentName: string
    activeTab: 'or_cr' | 'valid_id' | 'both'
    orCrUrl: string | null
    validIdUrl: string | null
    vehicleType?: string | null
    plateNumber?: string | null
  } | null>(null)

  const fetchNotifications = (silent = false) => {
    if (!silent) setLoading(true)
    adminNotificationsApi.getNotifications()
      .then((res) => {
        const list = Array.isArray(res.data.notifications) 
          ? res.data.notifications 
          : (res.data.notifications as any).data ?? []
        setNotifications(list)
      })
      .catch(() => setNotifications([]))
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }

  useEffect(() => {
    fetchNotifications()
    const intervalId = setInterval(() => {
      fetchNotifications(true)
    }, 5000)
    return () => clearInterval(intervalId)
  }, [])

  const handleApproveClick = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Accept Registration Request',
      message: 'Are you sure you want to accept this registration request and send credentials to user? This will send their account details via their provided email address.',
      type: 'accept',
      notificationId: id,
    })
  }

  const handleRejectClick = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Reject Registration Request',
      message: 'Are you sure you want to reject this registration request? The user account will be rejected and deleted.',
      type: 'reject',
      notificationId: id,
    })
  }

  const handleDeleteClick = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Notification',
      message: 'Are you sure you want to delete this notification? This action cannot be undone.',
      type: 'delete',
      notificationId: id,
    })
  }

  const handleClearAllClick = () => {
    setConfirmState({
      isOpen: true,
      title: 'Clear All Notifications',
      message: 'Are you sure you want to delete all notifications? This action cannot be undone.',
      type: 'clear_all',
      notificationId: 0,
    })
  }

  const handleMarkAllRead = async () => {
    try {
      await adminNotificationsApi.markAllRead()
      fetchNotifications()
      window.dispatchEvent(new Event('notifications_updated'))
    } catch (err) {}
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Notifications</h1>
          <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">View recent system and security notifications.</p>
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition cursor-pointer shadow-sm"
            >
              Mark all as read
            </button>
            <button
              onClick={handleClearAllClick}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-900/40 transition cursor-pointer"
              title="Delete all notifications"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear all</span>
            </button>
          </div>
        )}
      </div>

      <ToastMessage
        isVisible={!!message}
        title={
          message?.isError
            ? "Action failed"
            : message?.text?.includes('rejected')
            ? "Request rejected"
            : message?.text?.includes('deleted') || message?.text?.includes('cleared')
            ? "Notifications updated"
            : "Registration approved"
        }
        message={message?.text || ""}
        isFailed={message?.isError || message?.text?.includes('rejected')}
        onClose={() => setMessage(null)}
        autoCloseMs={3000}
        size="default"
        overlay={true}
      />

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 dark:border-white/5 dark:bg-[#18181b]">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-8 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
              <div className="h-28 rounded-lg bg-zinc-100 border border-zinc-200 p-4 dark:bg-zinc-900/50 dark:border-white/5" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-12 text-center shadow-sm dark:border-white/5 dark:bg-[#18181b]">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">You&apos;re all caught up. No new notifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => {
            let details: any = null
            if (n.type === 'registration_approval') {
              try {
                details = JSON.parse(n.message)
              } catch (e) {}
            }

            return (
              <div
                key={n.notification_id}
                className={`rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition dark:border-white/5 dark:bg-[#18181b] ${!n.is_read ? 'ring-2 ring-emerald-500/40 dark:ring-emerald-400/40' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{n.title}</span>
                      {!n.is_read && (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                      )}
                    </div>
                    <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{formatDate(n.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(n.notification_id)}
                      disabled={actionLoading !== null}
                      title="Delete notification"
                      className="rounded-lg p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {n.type === 'registration_approval' && details ? (() => {
                    const isResidentRequest = String(details.role || '').toLowerCase() === 'resident'
                    const orCrUrl = resolveDocumentUrl(details.or_cr_image)
                    const validIdUrl = resolveDocumentUrl(details.valid_id_image)
                    const openVerificationModal = (tab: 'or_cr' | 'valid_id' | 'both') => {
                      setPreviewDoc({
                        residentName: details.name,
                        activeTab: tab,
                        orCrUrl,
                        validIdUrl,
                        vehicleType: details.vehicle_type,
                        plateNumber: details.plate_number,
                      })
                    }

                    return (
                      <div className="rounded-lg bg-zinc-50 p-4 border border-zinc-200/80 dark:bg-zinc-900/50 dark:border-white/5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Request Details</p>
                          <div className="flex flex-wrap gap-2.5 shrink-0">
                            <button
                              onClick={() => handleApproveClick(n.notification_id)}
                              disabled={actionLoading !== null}
                              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-700/25"
                            >
                              Approve Request
                            </button>
                            <button
                              onClick={() => handleRejectClick(n.notification_id)}
                              disabled={actionLoading !== null}
                              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-rose-700/25"
                            >
                              Reject Request
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-700 dark:text-zinc-300 text-[13.5px]">
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Name:</span> 
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{details.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Role:</span> 
                            <span className="capitalize font-semibold text-zinc-900 dark:text-zinc-100">{details.role.replace('_', ' ')}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Email:</span> 
                            <MaskedEmail email={details.email} />
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Contact No:</span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {details.contact_number || 'Not provided'}
                            </span>
                          </div>

                          {isResidentRequest && (
                            <>
                              <div className="flex items-center gap-3">
                                <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Vehicle Type:</span>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                  {details.vehicle_type || 'Not provided'}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Plate Number:</span>
                                {details.plate_number ? (
                                  <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-emerald-700 dark:text-emerald-300">
                                    {details.plate_number}
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 dark:text-zinc-400 italic">Not provided</span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 md:col-span-2">
                                <span className="text-zinc-500 dark:text-zinc-400 w-32 font-medium shrink-0">Valid ID &amp; OR/CR:</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openVerificationModal('or_cr')}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25 transition cursor-pointer"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View Valid ID &amp; OR/CR
                                  </button>
                                  {(orCrUrl || validIdUrl) ? (
                                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                      Uploaded
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                      No file
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })() : (
                    <p className="text-zinc-700 dark:text-zinc-300">{n.message}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmState?.isOpen ?? false}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        type={confirmState?.type ?? 'accept'}
        loading={confirmState ? actionLoading === confirmState.notificationId : false}
        onCancel={() => setConfirmState(prev => prev ? { ...prev, isOpen: false } : null)}
        onConfirm={async () => {
          if (!confirmState) return
          const id = confirmState.notificationId
          setActionLoading(id)
          setMessage(null)
          try {
            if (confirmState.type === 'accept') {
              const res = await adminNotificationsApi.approve(id)
              setMessage({ text: res.data.message ?? 'Registration request approved successfully.' })
            } else if (confirmState.type === 'reject') {
              const res = await adminNotificationsApi.reject(id)
              setMessage({ text: res.data.message ?? 'Registration request rejected and account deleted.' })
            } else if (confirmState.type === 'delete') {
              const res = await adminNotificationsApi.deleteNotification(id)
              setMessage({ text: res.data.message ?? 'Notification deleted successfully.' })
            } else if (confirmState.type === 'clear_all') {
              const res = await adminNotificationsApi.clearAllNotifications()
              setMessage({ text: res.data.message ?? 'All notifications have been cleared.' })
            }
            setConfirmState(prev => prev ? { ...prev, isOpen: false } : null)
            fetchNotifications()
            window.dispatchEvent(new Event('notifications_updated'))
          } catch (err: any) {
            setMessage({ text: err.response?.data?.message ?? 'Action failed.', isError: true })
          } finally {
            setActionLoading(null)
          }
        }}
      />

      {previewDoc && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 p-5 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {previewDoc.residentName} — Valid ID & OR/CR Verification
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Vehicle Type: <span className="font-semibold text-zinc-200">{previewDoc.vehicleType || 'Not provided'}</span>
                  {' • '}
                  Plate Number: <span className="font-mono font-semibold text-emerald-400">{previewDoc.plateNumber || 'Not provided'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-950/70 p-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      Valid ID (Resident Verification)
                    </span>
                    {previewDoc.validIdUrl ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Uploaded
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Not Uploaded
                      </span>
                    )}
                  </div>
                  {previewDoc.validIdUrl && (
                    <a
                      href={previewDoc.validIdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition"
                    >
                      Open Full Image
                    </a>
                  )}
                </div>
                {previewDoc.validIdUrl ? (
                  <div className="flex min-h-[260px] max-h-[65vh] items-center justify-center overflow-auto rounded-lg bg-black/70 p-2">
                    <img
                      src={previewDoc.validIdUrl}
                      alt="Valid ID Document"
                      className="max-h-[60vh] w-auto rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
                    <p className="text-sm font-semibold text-zinc-300">No Valid ID Uploaded</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      This resident did not attach a Valid ID photo during registration.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col rounded-xl border border-white/10 bg-zinc-950/70 p-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      Vehicle OR/CR Document
                    </span>
                    {previewDoc.orCrUrl ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Uploaded
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Not Uploaded
                      </span>
                    )}
                  </div>
                  {previewDoc.orCrUrl && (
                    <a
                      href={previewDoc.orCrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition"
                    >
                      Open Full Image
                    </a>
                  )}
                </div>
                {previewDoc.orCrUrl ? (
                  <div className="flex min-h-[260px] max-h-[65vh] items-center justify-center overflow-auto rounded-lg bg-black/70 p-2">
                    <img
                      src={previewDoc.orCrUrl}
                      alt="Vehicle OR/CR Document"
                      className="max-h-[60vh] w-auto rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
                    <p className="text-sm font-semibold text-zinc-300">No OR/CR Uploaded</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      This resident did not attach a Vehicle OR/CR photo during registration.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default NotificationsPage
