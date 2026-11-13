import axiosInstance from "./AxiosInstance";
import type {
  GuardCreatePayload,
  GuardReviewPayload,
  ResidentCreatePayload,
  ResidentOption,
  ResidentRespondPayload,
  VisitorRequestItem,
  VisitorSummary,
} from "../interfaces/VisitorInterface";

class VisitorService {
  // Resident pre-registers visitor
  async residentCreate(payload: ResidentCreatePayload) {
    return axiosInstance.post<{ message: string; request: VisitorRequestItem }>(
      "/visitor/resident-create",
      payload
    );
  }

  // Resident views their visitor requests
  async loadResidentRequests(page = 1, status?: string) {
    const params = new URLSearchParams({ page: String(page) });
    if (status && status !== "ALL") params.append("status", status);
    return axiosInstance.get<{
      requests: {
        data: VisitorRequestItem[];
        current_page: number;
        last_page: number;
        total: number;
      };
    }>(`/visitor/my-requests?${params.toString()}`);
  }

  // Resident confirms or rejects walk-in visitor from guard
  async residentRespond(requestId: number, payload: ResidentRespondPayload) {
    return axiosInstance.put<{ message: string; request: VisitorRequestItem }>(
      `/visitor/resident-respond/${requestId}`,
      payload
    );
  }

  // Resident cancels their own visitor request
  async residentCancel(requestId: number) {
    return axiosInstance.put<{ message: string; request: VisitorRequestItem }>(
      `/visitor/resident-cancel/${requestId}`
    );
  }

  // Guard registers a walk-in visitor arriving at gate
  async guardCreate(payload: GuardCreatePayload) {
    return axiosInstance.post<{ message: string; request: VisitorRequestItem }>(
      "/visitor/guard-create",
      payload
    );
  }

  // Guard reviews resident request (APPROVE or DENY)
  async guardReview(requestId: number, payload: GuardReviewPayload) {
    return axiosInstance.put<{ message: string; request: VisitorRequestItem }>(
      `/visitor/guard-review/${requestId}`,
      payload
    );
  }

  // Guard marks visit completed or cancelled
  async updateStatus(requestId: number, status: 'COMPLETED' | 'CANCELLED', guardRemarks?: string) {
    return axiosInstance.put<{ message: string; request: VisitorRequestItem }>(
      `/visitor/status/${requestId}`,
      { status, guard_remarks: guardRemarks }
    );
  }

  // Guard/Admin loads all visitor requests
  async loadGuardRequests(options: {
    page?: number;
    status?: string;
    requested_by?: string;
    search?: string;
    date?: string;
  } = {}) {
    const params = new URLSearchParams();
    if (options.page) params.append("page", String(options.page));
    if (options.status && options.status !== "ALL") params.append("status", options.status);
    if (options.requested_by && options.requested_by !== "ALL") params.append("requested_by", options.requested_by);
    if (options.search) params.append("search", options.search);
    if (options.date) params.append("date", options.date);

    return axiosInstance.get<{
      requests: {
        data: VisitorRequestItem[];
        current_page: number;
        last_page: number;
        total: number;
      };
    }>(`/visitor/guard-requests?${params.toString()}`);
  }

  // Guard loads residents list for dropdown
  async loadResidents() {
    return axiosInstance.get<{ residents: ResidentOption[] }>("/visitor/residents");
  }

  // Summary statistics
  async getSummary() {
    return axiosInstance.get<VisitorSummary>("/visitor/summary");
  }
}

export default new VisitorService();
