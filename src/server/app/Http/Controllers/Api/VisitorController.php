<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\UpdateRequest;
use App\Models\User;
use App\Models\Visitor;
use App\Models\VisitorRequest;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VisitorController extends Controller
{
    /**
     * Flow 1: Resident registers an expected visitor in advance.
     */
    public function residentCreate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:150',
            'contact_number' => 'required|string|max:30',
            'visit_date' => 'required|date',
            'visit_time' => 'required|string|max:30',
            'purpose' => 'required|string|max:255',
            'vehicle_plate' => 'required|string|max:30',
            'vehicle_type' => 'required|string|max:50',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($validated, $user, $request) {
            $visitor = Visitor::create([
                'full_name' => trim($validated['full_name']),
                'contact_number' => trim($validated['contact_number']),
                'vehicle_plate' => strtoupper(trim($validated['vehicle_plate'])),
                'vehicle_type' => trim($validated['vehicle_type']),
            ]);

            $visitorRequest = VisitorRequest::create([
                'visitor_id' => $visitor->visitor_id,
                'resident_id' => $user->user_id,
                'guard_id' => null,
                'requested_by' => 'resident',
                'visit_date' => $validated['visit_date'],
                'visit_time' => $validated['visit_time'],
                'purpose' => trim($validated['purpose']),
                'status' => 'PENDING',
                'notes' => $validated['notes'] ?? null,
            ]);


            $residentName = $user->owner_name;
            $guards = User::whereIn('role', ['security_guard', 'admin'])->get();

            $message = "New Visitor Request: {$visitor->full_name} wants to visit Resident {$residentName} on {$validated['visit_date']} at {$validated['visit_time']}.";

            foreach ($guards as $guard) {
                Notification::create([
                    'user_id' => $guard->user_id,
                    'request_id' => $visitorRequest->request_id,
                    'title' => 'New Visitor Request',
                    'message' => $message,
                    'type' => 'visitor_request',
                    'is_read' => false,
                ]);
            }

            ActivityLogService::record('resident_visitor_request_created', $user->username, $user->user_id, $request, [
                'request_id' => $visitorRequest->request_id,
                'visitor' => $visitor->full_name,
                'resident' => $residentName,
            ]);

            return response()->json([
                'message' => 'Visitor request submitted successfully. Waiting for security guard review.',
                'request' => $visitorRequest->load(['visitor', 'resident']),
            ], 201);
        });
    }

    /**
     * Flow 1: Security guard reviews (Approve / Deny) a resident's visitor request.
     */
    public function guardReview(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'decision' => 'required|in:APPROVED,DENIED',
            'guard_remarks' => 'nullable|string',
        ]);

        $visitorRequest = VisitorRequest::with(['visitor', 'resident'])->findOrFail($id);
        $decision = $validated['decision'];
        $guard = $request->user();

        // If request already has this decision, update remarks and return cleanly
        if ($visitorRequest->status === $decision) {
            if (!empty($validated['guard_remarks'])) {
                $visitorRequest->update([
                    'guard_remarks' => $validated['guard_remarks'],
                    'guard_id' => $guard?->user_id ?? $visitorRequest->guard_id,
                ]);
            }
            return response()->json([
                'message' => "Visitor request is already {$decision}.",
                'request' => $visitorRequest->fresh(['visitor', 'resident', 'securityGuard']),
            ]);
        }

        // Only block terminal finished visits
        if (in_array($visitorRequest->status, ['COMPLETED', 'CANCELLED'], true)) {
            return response()->json([
                'message' => "Request cannot be reviewed because it is already {$visitorRequest->status}."
            ], 422);
        }

        DB::transaction(function () use ($visitorRequest, $guard, $decision, $validated, $request) {
            $visitorRequest->update([
                'status' => $decision,
                'guard_id' => $guard?->user_id ?? $visitorRequest->guard_id,
                'guard_remarks' => $validated['guard_remarks'] ?? $visitorRequest->guard_remarks,
            ]);

            $visitorName = $visitorRequest->visitor?->full_name ?? 'Visitor';

            if ($decision === 'APPROVED') {
                $title = 'Visitor Request Approved';
                $message = "Your visitor request for {$visitorName} has been approved by the security guard.";
                $type = 'visitor_approved';
            } else {
                $title = 'Visitor Request Denied';
                $message = "Your visitor request for {$visitorName} has been denied by the security guard.";
                $type = 'visitor_denied';
            }

            if ($visitorRequest->resident_id) {
                Notification::create([
                    'user_id' => $visitorRequest->resident_id,
                    'request_id' => $visitorRequest->request_id,
                    'title' => $title,
                    'message' => $message,
                    'type' => $type,
                    'is_read' => false,
                ]);
            }

            // Sync corresponding mobile update request if linked
            if (!empty($visitorRequest->notes) && preg_match('/\[UpdateReq ID:\s*(\d+)\]/', $visitorRequest->notes, $matches)) {
                $updateRequestId = (int) $matches[1];
                $updateReq = UpdateRequest::find($updateRequestId);
                if ($updateReq && $updateReq->status === 'pending') {
                    $updateReq->update([
                        'status' => $decision === 'APPROVED' ? 'approved' : 'rejected',
                        'admin_notes' => $validated['guard_remarks'] ?? ($decision === 'APPROVED' ? 'Approved by Security Guard' : 'Denied by Security Guard'),
                    ]);
                }
            }

            ActivityLogService::record("guard_visitor_request_{$decision}", $guard?->username ?? 'security_guard', $guard?->user_id, $request, [
                'request_id' => $visitorRequest->request_id,
                'decision' => $decision,
                'visitor' => $visitorName,
            ]);
        });

        return response()->json([
            'message' => "Visitor request has been {$decision}.",
            'request' => $visitorRequest->fresh(['visitor', 'resident', 'securityGuard']),
        ]);
    }

    /**
     * Flow 2: Security guard registers a walk-in visitor arriving at the gate.
     */
    public function guardCreate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:150',
            'contact_number' => 'required|string|max:30',
            'resident_id' => 'required|exists:tbl_users,user_id',
            'visit_date' => 'required|date',
            'visit_time' => 'required|string|max:30',
            'purpose' => 'required|string|max:255',
            'vehicle_plate' => 'required|string|max:30',
            'vehicle_type' => 'required|string|max:50',
            'notes' => 'nullable|string',
            'guard_remarks' => 'nullable|string',
        ]);

        $guard = $request->user();
        $resident = User::findOrFail($validated['resident_id']);

        return DB::transaction(function () use ($validated, $guard, $resident, $request) {
            $visitor = Visitor::create([
                'full_name' => trim($validated['full_name']),
                'contact_number' => trim($validated['contact_number']),
                'vehicle_plate' => strtoupper(trim($validated['vehicle_plate'])),
                'vehicle_type' => trim($validated['vehicle_type']),
            ]);

            $visitorRequest = VisitorRequest::create([
                'visitor_id' => $visitor->visitor_id,
                'resident_id' => $resident->user_id,
                'guard_id' => $guard->user_id,
                'requested_by' => 'guard',
                'visit_date' => $validated['visit_date'],
                'visit_time' => $validated['visit_time'],
                'purpose' => trim($validated['purpose']),
                'status' => 'PENDING',
                'notes' => $validated['notes'] ?? null,
                'guard_remarks' => $validated['guard_remarks'] ?? null,
            ]);

            $message = "Visitor Alert: {$visitor->full_name} is at the subdivision gate and is requesting to visit you. Purpose: {$validated['purpose']} | Time: {$validated['visit_time']}";

            Notification::create([
                'user_id' => $resident->user_id,
                'request_id' => $visitorRequest->request_id,
                'title' => 'Visitor Alert',
                'message' => $message,
                'type' => 'walkin_request',
                'is_read' => false,
            ]);

            ActivityLogService::record('guard_walkin_visitor_registered', $guard->username, $guard->user_id, $request, [
                'request_id' => $visitorRequest->request_id,
                'visitor' => $visitor->full_name,
                'resident' => $resident->owner_name,
            ]);

            return response()->json([
                'message' => "Walk-in visitor request sent to Resident {$resident->owner_name} for confirmation.",
                'request' => $visitorRequest->load(['visitor', 'resident', 'securityGuard']),
            ], 201);
        });
    }

    /**
     * Flow 2: Resident confirms or rejects the walk-in visitor.
     */
    public function residentRespond(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'response' => 'required|in:CONFIRM,REJECT',
            'notes' => 'nullable|string',
        ]);

        $visitorRequest = VisitorRequest::with(['visitor', 'resident', 'securityGuard'])->findOrFail($id);
        $user = $request->user();

        if ($visitorRequest->resident_id !== $user->user_id) {
            return response()->json(['message' => 'Unauthorized action for this visitor request.'], 403);
        }

        if ($visitorRequest->status !== 'PENDING') {
            return response()->json([
                'message' => "This request has already been {$visitorRequest->status}."
            ], 422);
        }

        $responseChoice = $validated['response'];
        $newStatus = $responseChoice === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';

        DB::transaction(function () use ($visitorRequest, $user, $newStatus, $responseChoice, $validated, $request) {
            $visitorRequest->update([
                'status' => $newStatus,
                'notes' => !empty($validated['notes'])
                    ? ($visitorRequest->notes ? "{$visitorRequest->notes} | Resident Note: {$validated['notes']}" : $validated['notes'])
                    : $visitorRequest->notes,
            ]);

            $visitorName = $visitorRequest->visitor->full_name;
            $residentName = $user->owner_name;

            if ($newStatus === 'CONFIRMED') {
                $guardTitle = 'Visitor Confirmed';
                $guardMessage = "Visitor Confirmed: Resident {$residentName} has confirmed {$visitorName}'s visit.";
                $resTitle = 'Visitor Confirmed';
                $resMessage = "Visitor Confirmed: You have confirmed {$visitorName}'s visit.";
                $type = 'visitor_confirmed';
            } else {
                $guardTitle = 'Visitor Rejected';
                $guardMessage = "Visitor Rejected: Resident {$residentName} has rejected {$visitorName}'s visit.";
                $resTitle = 'Visitor Rejected';
                $resMessage = "Visitor Rejected: You have rejected {$visitorName}'s visit.";
                $type = 'visitor_rejected';
            }

            // Notify security guards and admin
            $guards = User::whereIn('role', ['security_guard', 'admin'])->get();
            foreach ($guards as $guard) {
                Notification::create([
                    'user_id' => $guard->user_id,
                    'request_id' => $visitorRequest->request_id,
                    'title' => $guardTitle,
                    'message' => $guardMessage,
                    'type' => $type,
                    'is_read' => false,
                ]);
            }

            // Notification for resident record
            Notification::create([
                'user_id' => $user->user_id,
                'request_id' => $visitorRequest->request_id,
                'title' => $resTitle,
                'message' => $resMessage,
                'type' => $type,
                'is_read' => true,
            ]);

            ActivityLogService::record("resident_walkin_{$newStatus}", $user->username, $user->user_id, $request, [
                'request_id' => $visitorRequest->request_id,
                'visitor' => $visitorName,
                'resident' => $residentName,
                'status' => $newStatus,
            ]);
        });

        return response()->json([
            'message' => "Visitor request {$newStatus} successfully.",
            'request' => $visitorRequest->fresh(['visitor', 'resident', 'securityGuard']),
        ]);
    }

    /**
     * Mark a visit completed or cancelled by guard/admin.
     */
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:COMPLETED,CANCELLED',
            'guard_remarks' => 'nullable|string',
        ]);

        $visitorRequest = VisitorRequest::with(['visitor', 'resident'])->findOrFail($id);
        $user = $request->user();

        $visitorRequest->update([
            'status' => $validated['status'],
            'guard_id' => $user->user_id,
            'guard_remarks' => $validated['guard_remarks'] ?? $visitorRequest->guard_remarks,
        ]);

        ActivityLogService::record("visitor_request_{$validated['status']}", $user->username, $user->user_id, $request, [
            'request_id' => $visitorRequest->request_id,
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => "Visitor status updated to {$validated['status']}.",
            'request' => $visitorRequest->fresh(['visitor', 'resident', 'securityGuard']),
        ]);
    }

    /**
     * Cancel own visitor request by resident.
     */
    public function residentCancel(Request $request, $id): JsonResponse
    {
        $visitorRequest = VisitorRequest::findOrFail($id);
        $user = $request->user();

        if ($visitorRequest->resident_id !== $user->user_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (in_array($visitorRequest->status, ['DENIED', 'REJECTED', 'CANCELLED'], true)) {
            return response()->json(['message' => "Request is already {$visitorRequest->status}."], 422);
        }

        $visitorRequest->update([
            'status' => 'CANCELLED',
            'notes' => $visitorRequest->notes ? "{$visitorRequest->notes} [Cancelled by resident]" : "[Cancelled by resident]",
        ]);

        $this->revokeLinkedUpdateRequest($visitorRequest, 'Cancelled by resident');

        ActivityLogService::record('resident_visitor_pass_cancelled', $user->username, $user->user_id, $request, [
            'request_id' => $visitorRequest->request_id,
        ]);

        return response()->json([
            'message' => 'Visitor request cancelled successfully.',
            'request' => $visitorRequest->fresh(['visitor', 'securityGuard']),
        ]);
    }

    /**
     * Delete a visitor pass anytime by the resident.
     */
    public function residentDelete(Request $request, $id): JsonResponse
    {
        $visitorRequest = VisitorRequest::with('visitor')->findOrFail($id);
        $user = $request->user();

        if ($visitorRequest->resident_id !== $user->user_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $visitorName = $visitorRequest->visitor?->full_name ?? 'Visitor';

        $this->revokeLinkedUpdateRequest($visitorRequest, 'Deleted by resident');

        $visitorRequest->delete();

        ActivityLogService::record('resident_visitor_pass_deleted', $user->username, $user->user_id, $request, [
            'request_id' => (int) $id,
            'visitor' => $visitorName,
        ]);

        return response()->json([
            'message' => 'Visitor pass deleted successfully.',
        ]);
    }

    /**
     * Delete a visitor request record by a security guard or admin.
     */
    public function guardDelete(Request $request, $id): JsonResponse
    {
        $visitorRequest = VisitorRequest::with('visitor')->findOrFail($id);
        $user = $request->user();
        $visitorName = $visitorRequest->visitor?->full_name ?? 'Visitor';
        $status = $visitorRequest->status;

        $this->revokeLinkedUpdateRequest(
            $visitorRequest,
            'Deleted by ' . ($user?->role === 'admin' ? 'admin' : 'security guard')
        );

        $visitorRequest->delete();

        ActivityLogService::record('guard_visitor_request_deleted', $user?->username ?? 'guard', $user?->user_id, $request, [
            'request_id' => (int) $id,
            'visitor' => $visitorName,
            'status' => $status,
        ]);

        return response()->json([
            'message' => 'Visitor record deleted successfully.',
        ]);
    }

    /**
     * Extend the duration of stay (visit_end_date) for a resident's visitor pass.
     */
    public function residentExtendDuration(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'add_days' => 'nullable|integer|min:1|max:30',
            'visit_end_date' => 'nullable|date',
        ]);

        if (empty($validated['add_days']) && empty($validated['visit_end_date'])) {
            return response()->json(['message' => 'Please provide add_days or visit_end_date.'], 422);
        }

        $visitorRequest = VisitorRequest::with(['visitor', 'resident', 'securityGuard'])->findOrFail($id);
        $user = $request->user();

        if ($visitorRequest->resident_id !== $user->user_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (in_array($visitorRequest->status, ['DENIED', 'REJECTED', 'CANCELLED'], true)) {
            return response()->json(['message' => "Cannot extend a {$visitorRequest->status} visitor pass."], 422);
        }

        $startDate = \Carbon\Carbon::parse($visitorRequest->visit_date)->toDateString();
        $currentEnd = $visitorRequest->visit_end_date
            ? \Carbon\Carbon::parse($visitorRequest->visit_end_date)->toDateString()
            : $startDate;

        if (! empty($validated['visit_end_date'])) {
            $newEndDate = \Carbon\Carbon::parse($validated['visit_end_date'])->toDateString();
            if ($newEndDate < $startDate) {
                return response()->json(['message' => 'End date cannot be earlier than the visit start date.'], 422);
            }
        } else {
            $baseDate = max($currentEnd, now()->toDateString());
            $newEndDate = \Carbon\Carbon::parse($baseDate)->addDays((int) $validated['add_days'])->toDateString();
        }

        $visitorRequest->update([
            'visit_end_date' => $newEndDate,
        ]);

        // Sync linked guest_access UpdateRequest if present
        if (! empty($visitorRequest->notes) && preg_match('/\[UpdateReq ID:\s*(\d+)\]/', $visitorRequest->notes, $matches)) {
            $updateReq = UpdateRequest::find((int) $matches[1]);
            if ($updateReq) {
                $changes = $updateReq->requested_changes ?? [];
                $changes['access_end_date'] = $newEndDate;
                $changes['valid_until'] = $newEndDate;
                $updateReq->update(['requested_changes' => $changes]);
            }
        }

        ActivityLogService::record('resident_visitor_duration_extended', $user->username, $user->user_id, $request, [
            'request_id' => $visitorRequest->request_id,
            'visit_end_date' => $newEndDate,
        ]);

        return response()->json([
            'message' => "Visitor stay extended until {$newEndDate}.",
            'request' => $visitorRequest->fresh(['visitor', 'securityGuard']),
        ]);
    }

    private function revokeLinkedUpdateRequest(VisitorRequest $visitorRequest, string $reason): void
    {
        if (! empty($visitorRequest->notes) && preg_match('/\[UpdateReq ID:\s*(\d+)\]/', $visitorRequest->notes, $matches)) {
            $updateReq = UpdateRequest::find((int) $matches[1]);
            if ($updateReq && in_array($updateReq->status, ['pending', 'approved'], true)) {
                $updateReq->update([
                    'status' => 'rejected',
                    'admin_notes' => $reason,
                ]);
            }
        }
    }

    /**
     * List visitor requests for the authenticated resident.
     */
    public function loadResidentRequests(Request $request): JsonResponse
    {
        $query = VisitorRequest::with(['visitor', 'securityGuard'])
            ->where('resident_id', $request->user()->user_id);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($requestedBy = $request->query('requested_by')) {
            $query->where('requested_by', $requestedBy);
        }

        $requests = $query->orderByDesc('created_at')->paginate(20);

        return response()->json(['requests' => $requests]);
    }

    /**
     * List all visitor requests for Security Guards and Admins.
     */
    public function loadGuardRequests(Request $request): JsonResponse
    {
        $query = VisitorRequest::with(['visitor', 'resident', 'securityGuard']);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($requestedBy = $request->query('requested_by')) {
            $query->where('requested_by', $requestedBy);
        }

        if ($date = $request->query('date')) {
            $query->whereDate('visit_date', $date);
        }

        if ($search = $request->query('search')) {
            $search = trim($search);
            $query->where(function ($q) use ($search) {
                $q->whereHas('visitor', function ($vq) use ($search) {
                    $vq->where('full_name', 'like', "%{$search}%")
                        ->orWhere('vehicle_plate', 'like', "%{$search}%")
                        ->orWhere('contact_number', 'like', "%{$search}%");
                })->orWhereHas('resident', function ($rq) use ($search) {
                    $rq->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                })->orWhere('purpose', 'like', "%{$search}%");
            });
        }

        $perPage = min(max((int) $request->query('per_page', 100), 10), 200);
        $requests = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json(['requests' => $requests]);
    }

    /**
     * List active residents for Guard to choose when a walk-in arrives.
     */
    public function loadResidents(Request $request): JsonResponse
    {
        $residents = User::where('role', 'resident')
            ->where('is_deleted', 0)
            ->where('is_approved', 1)
            ->select('user_id', 'first_name', 'middle_name', 'last_name', 'contact_number', 'address', 'plate_number', 'car_model')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(function ($r) {
                return [
                    'user_id' => $r->user_id,
                    'name' => $r->owner_name,
                    'contact_number' => $r->contact_number,
                    'address' => $r->address,
                    'plate_number' => $r->plate_number,
                    'car_model' => $r->car_model,
                ];
            });

        return response()->json(['residents' => $residents]);
    }

    /**
     * Overview metrics for Guard / Resident dashboards.
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isResident()) {
            $pendingResident = VisitorRequest::where('resident_id', $user->user_id)
                ->where('status', 'PENDING')
                ->where('requested_by', 'resident')
                ->count();

            $pendingWalkins = VisitorRequest::where('resident_id', $user->user_id)
                ->where('status', 'PENDING')
                ->where('requested_by', 'guard')
                ->count();

            $approvedOrConfirmed = VisitorRequest::where('resident_id', $user->user_id)
                ->whereIn('status', ['APPROVED', 'CONFIRMED'])
                ->count();

            $completed = VisitorRequest::where('resident_id', $user->user_id)
                ->where('status', 'COMPLETED')
                ->count();

            return response()->json([
                'pending_resident' => $pendingResident,
                'pending_walkins' => $pendingWalkins,
                'active_passes' => $approvedOrConfirmed,
                'completed' => $completed,
            ]);
        }

        // For Guards & Admins:
        $pendingReviews = VisitorRequest::where('status', 'PENDING')
            ->where('requested_by', 'resident')
            ->count();

        $pendingConfirmations = VisitorRequest::where('status', 'PENDING')
            ->where('requested_by', 'guard')
            ->count();

        $todayApproved = VisitorRequest::whereIn('status', ['APPROVED', 'CONFIRMED'])
            ->whereDate('visit_date', now()->toDateString())
            ->count();

        $todayCompleted = VisitorRequest::where('status', 'COMPLETED')
            ->whereDate('updated_at', now()->toDateString())
            ->count();

        $totalToday = VisitorRequest::whereDate('visit_date', now()->toDateString())->count();

        return response()->json([
            'pending_reviews' => $pendingReviews,
            'pending_confirmations' => $pendingConfirmations,
            'today_approved' => $todayApproved,
            'today_completed' => $todayCompleted,
            'today_total' => $totalToday,
        ]);
    }
}
