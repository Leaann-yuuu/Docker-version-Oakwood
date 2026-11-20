class VisitorModel {
  final int visitorId;
  final String fullName;
  final String contactNumber;
  final String? vehiclePlate;
  final String? vehicleType;

  const VisitorModel({
    required this.visitorId,
    required this.fullName,
    required this.contactNumber,
    this.vehiclePlate,
    this.vehicleType,
  });

  factory VisitorModel.fromJson(Map<String, dynamic> json) {
    return VisitorModel(
      visitorId: json['visitor_id'] as int? ?? 0,
      fullName: json['full_name'] as String? ?? '',
      contactNumber: json['contact_number'] as String? ?? '',
      vehiclePlate: json['vehicle_plate'] as String?,
      vehicleType: json['vehicle_type'] as String?,
    );
  }
}

class VisitorRequestModel {
  final int requestId;
  final int residentId;
  final int? guardId;
  final String requestedBy; // 'resident' | 'guard'
  final String status; // PENDING | APPROVED | DENIED | CONFIRMED | REJECTED | COMPLETED | CANCELLED
  final String visitDate;
  final String? visitEndDate;
  final String visitTime;
  final String purpose;
  final String? notes;
  final String? guardRemarks;
  final String createdAt;
  final VisitorModel? visitor;
  final Map<String, dynamic>? guard;

  const VisitorRequestModel({
    required this.requestId,
    required this.residentId,
    this.guardId,
    required this.requestedBy,
    required this.status,
    required this.visitDate,
    this.visitEndDate,
    required this.visitTime,
    required this.purpose,
    this.notes,
    this.guardRemarks,
    required this.createdAt,
    this.visitor,
    this.guard,
  });

  factory VisitorRequestModel.fromJson(Map<String, dynamic> json) {
    return VisitorRequestModel(
      requestId: json['request_id'] as int? ?? 0,
      residentId: json['resident_id'] as int? ?? 0,
      guardId: json['guard_id'] as int?,
      requestedBy: json['requested_by'] as String? ?? 'resident',
      status: json['status'] as String? ?? 'PENDING',
      visitDate: json['visit_date'] as String? ?? '',
      visitEndDate: json['visit_end_date'] as String?,
      visitTime: json['visit_time'] as String? ?? '',
      purpose: json['purpose'] as String? ?? '',
      notes: json['notes'] as String?,
      guardRemarks: json['guard_remarks'] as String?,
      createdAt: json['created_at'] as String? ?? '',
      visitor: json['visitor'] != null
          ? VisitorModel.fromJson(json['visitor'] as Map<String, dynamic>)
          : null,
      guard: json['security_guard'] as Map<String, dynamic>?,
    );
  }

  /// Is this a walk-in from a guard waiting for resident CONFIRM / REJECT?
  bool get isPendingWalkin =>
      requestedBy == 'guard' && status == 'PENDING';

  String get effectiveEndDate =>
      (visitEndDate != null && visitEndDate!.isNotEmpty) ? visitEndDate! : visitDate;

  String get stayRangeLabel =>
      (visitEndDate != null && visitEndDate!.isNotEmpty && visitEndDate != visitDate)
          ? '$visitDate → $visitEndDate'
          : visitDate;

  bool get isActivePass {
    final s = status.toUpperCase();
    if (s == 'DENIED' || s == 'REJECTED' || s == 'CANCELLED') {
      return false;
    }
    return true;
  }

  /// Copy with new status after respond
  VisitorRequestModel copyWithStatus(String newStatus) {
    return VisitorRequestModel(
      requestId: requestId,
      residentId: residentId,
      guardId: guardId,
      requestedBy: requestedBy,
      status: newStatus,
      visitDate: visitDate,
      visitEndDate: visitEndDate,
      visitTime: visitTime,
      purpose: purpose,
      notes: notes,
      guardRemarks: guardRemarks,
      createdAt: createdAt,
      visitor: visitor,
      guard: guard,
    );
  }
}
