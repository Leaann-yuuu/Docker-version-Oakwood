export type VisitorRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type RequestedBy = 'resident' | 'guard';

export interface Visitor {
  visitor_id: number;
  full_name: string;
  contact_number: string;
  vehicle_plate?: string | null;
  vehicle_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VisitorResidentInfo {
  user_id: number;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  contact_number?: string | null;
  address?: string | null;
  plate_number?: string | null;
  car_model?: string | null;
}

export interface VisitorGuardInfo {
  user_id: number;
  first_name: string;
  last_name: string;
}

export interface VisitorRequestItem {
  request_id: number;
  visitor_id: number;
  resident_id: number;
  guard_id?: number | null;
  requested_by: RequestedBy;
  visit_date: string;
  visit_time: string;
  purpose: string;
  status: VisitorRequestStatus;
  notes?: string | null;
  guard_remarks?: string | null;
  created_at: string;
  updated_at: string;
  visitor: Visitor;
  resident?: VisitorResidentInfo;
  guard?: VisitorGuardInfo;
}

export interface ResidentOption {
  user_id: number;
  name: string;
  contact_number?: string | null;
  address?: string | null;
  plate_number?: string | null;
  car_model?: string | null;
}

export interface ResidentCreatePayload {
  full_name: string;
  contact_number: string;
  visit_date: string;
  visit_time: string;
  purpose: string;
  vehicle_plate: string;
  vehicle_type: string;
  notes?: string;
}

export interface GuardCreatePayload {
  full_name: string;
  contact_number: string;
  resident_id: number;
  visit_date: string;
  visit_time: string;
  purpose: string;
  vehicle_plate: string;
  vehicle_type: string;
  notes?: string;
  guard_remarks?: string;
}

export interface GuardReviewPayload {
  decision: 'APPROVED' | 'DENIED';
  guard_remarks?: string;
}

export interface ResidentRespondPayload {
  response: 'CONFIRM' | 'REJECT';
  notes?: string;
}

export interface VisitorSummary {
  pending_resident?: number;
  pending_walkins?: number;
  active_passes?: number;
  completed?: number;
  pending_reviews?: number;
  pending_confirmations?: number;
  today_approved?: number;
  today_completed?: number;
  today_total?: number;
}
