import { useEffect, useState } from 'react'
import { reportApi, type GateLogEntry } from '../services/reportApi'
import type { ActivityLogEntry } from '../services/guardApi'

export interface PaginationMeta {
  currentPage: number
  lastPage: number
  total: number
  from: number | null
  to: number | null
}

export const useAccessLogs = (filters: { direction?: string; status?: string; search?: string } = {}) => {
  const [logs, setLogs] = useState<GateLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<PaginationMeta>({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: null,
    to: null,
  })

  useEffect(() => {
    setPage(1)
  }, [filters.direction, filters.status, filters.search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const handle = window.setTimeout(() => {
      reportApi
        .loadAccessLogs(page, filters)
        .then((res) => {
          const raw = res.data.logs as unknown as {
            data?: GateLogEntry[]
            current_page?: number
            last_page?: number
            total?: number
            from?: number
            to?: number
          }
          setLogs(raw.data ?? [])
          setMeta({
            currentPage: raw.current_page ?? page,
            lastPage: raw.last_page ?? 1,
            total: raw.total ?? 0,
            from: raw.from ?? null,
            to: raw.to ?? null,
          })
        })
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [page, filters.direction, filters.status, filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  return { logs, loading, page, setPage, meta }
}

export const useSecurityActivityLogs = (filters: { event_type?: string; search?: string } = {}) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<PaginationMeta>({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: null,
    to: null,
  })

  useEffect(() => {
    setPage(1)
  }, [filters.event_type, filters.search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const handle = window.setTimeout(() => {
      reportApi
        .loadActivityLogs(page, filters)
        .then((res) => {
          const raw = res.data.logs as unknown as {
            data?: ActivityLogEntry[]
            current_page?: number
            last_page?: number
            total?: number
            from?: number
            to?: number
          }
          setLogs(raw.data ?? [])
          setMeta({
            currentPage: raw.current_page ?? page,
            lastPage: raw.last_page ?? 1,
            total: raw.total ?? 0,
            from: raw.from ?? null,
            to: raw.to ?? null,
          })
        })
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [page, filters.event_type, filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  return { logs, loading, page, setPage, meta }
}

export const useIncidentRequests = () => {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportApi
      .loadUpdateRequests(1)
      .then((res) => setRequests(res.data.requests?.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  return { requests, loading }
}
