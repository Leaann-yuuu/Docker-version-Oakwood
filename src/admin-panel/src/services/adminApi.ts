import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080/api'

const adminApi = axios.create({ baseURL: API_BASE })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

export interface AdminUser {
  user_id: number
  username: string
  first_name: string
  last_name: string
  middle_name?: string | null
  email?: string | null
  contact_number?: string | null
  address?: string | null
  age?: number | null
  role: string
  profile_picture?: string | null
}

export interface LoginResponse {
  user: AdminUser
  token: string
}

export interface ActivePlateInfo {
  plate_number: string
  status?: 'idle' | 'scanning' | 'detected' | 'verifying' | 'verified' | 'error'
  authorized: boolean
  resident_name?: string | null
  car_model?: string | null
  car_color?: string | null
}

export interface DashboardOverviewData {
  gate_status: 'open' | 'closed'
  camera_status: 'online' | 'offline'
  entrance_camera_status: 'online' | 'offline'
  exit_camera_status: 'online' | 'offline'
  sensor_status: 'online' | 'offline'
  camera_stream_url?: string
  entrance_camera_stream_url?: string
  exit_camera_stream_url?: string
  entrance_active_plate?: ActivePlateInfo | null
  exit_active_plate?: ActivePlateInfo | null
  stats: {
    authorized_entries: number
    authorized_exits: number
    unauthorized_attempts: number
    total_residents: number
    pending_update_requests: number
    unread_notifications: number
  }
}

export const adminAuthApi = {
  login: (username: string, password: string) =>
    adminApi.post<LoginResponse>('/auth/admin/login', { username, password }),

  logout: () => adminApi.post('/auth/logout'),

  me: () => adminApi.get<{ user: AdminUser }>('/auth/me'),

  forgotPassword: (email: string) => adminApi.post('/auth/forgot-password', { email }),

  updateProfile: (formData: FormData) =>
    adminApi.post<{ message: string; user: AdminUser }>('/auth/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  register: (data: {
    first_name: string
    middle_name?: string
    last_name: string
    gender: string
    birth_date: string
    email: string
  }) => adminApi.post('/auth/admin/register', data),

  dashboardOverview: () => adminApi.get<DashboardOverviewData>('/dashboard/overview'),

  trafficChart: (period: string) =>
    adminApi.get<{
      period: string
      labels: string[]
      authorized: number[]
      unauthorized: number[]
    }>('/dashboard/traffic-chart?period=' + period),

  gateStatus: () => adminApi.get('/gate/status'),

  updateSystemHealth: (data: {
    camera_status?: string
    entrance_camera_status?: string
    exit_camera_status?: string
    sensor_status?: string
    camera_stream_url?: string
    entrance_camera_stream_url?: string
    exit_camera_stream_url?: string
  }) => adminApi.put('/gate/system-health', data),

  testConnection: (url: string) =>
    adminApi.post<{ online: boolean; message?: string }>('/gate/test-connection', { url }),

  loadGenders: () => adminApi.get('/gender/publicGenders'),
}

export interface NotificationEntry {
  notification_id: number
  user_id: number
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export const adminNotificationsApi = {
  getNotifications: () => adminApi.get<{ notifications: { data: NotificationEntry[] } | NotificationEntry[] }>('/notification'),
  markAllRead: () => adminApi.put('/notification/read-all'),
  deleteNotification: (id: number) => adminApi.delete(`/notification/${id}`),
  clearAllNotifications: () => adminApi.delete('/notification/clear-all'),
  approve: (id: number) => adminApi.post(`/notification/${id}/approve`),
  reject: (id: number) => adminApi.post(`/notification/${id}/reject`),
}

export default adminApi
