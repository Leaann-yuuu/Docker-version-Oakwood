import 'dart:convert';

class GuestItemModel {
  final String name;
  final String? contactNumber;
  final String? plateNumber;
  final String? carModel;
  final String? carColor;

  GuestItemModel({
    required this.name,
    this.contactNumber,
    this.plateNumber,
    this.carModel,
    this.carColor,
  });

  factory GuestItemModel.fromJson(Map<String, dynamic> json) {
    return GuestItemModel(
      name: (json['name'] ?? json['guest_name'] ?? '').toString(),
      contactNumber: (json['contact_number'] ?? json['guest_contact_number'])?.toString(),
      plateNumber: (json['plate_number'] ?? json['guest_plate_number'])?.toString(),
      carModel: (json['car_model'] ?? json['guest_car_model'])?.toString(),
      carColor: (json['car_color'] ?? json['guest_car_color'])?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'contact_number': contactNumber,
    'plate_number': plateNumber,
    'car_model': carModel,
    'car_color': carColor,
  };
}

class UpdateRequestModel {
  final int id;
  final String requestType; // 'guest_access', 'profile_update', etc.
  final String status; // 'pending', 'approved', 'rejected'
  final String? notes;
  final String createdAt;
  final String? guestName;
  final String? guestPlateNumber;
  final String? accessReason;
  final String? accessDate;
  final List<GuestItemModel> guests;
  final Map<String, dynamic> requestedChanges;

  UpdateRequestModel({
    required this.id,
    required this.requestType,
    required this.status,
    this.notes,
    required this.createdAt,
    this.guestName,
    this.guestPlateNumber,
    this.accessReason,
    this.accessDate,
    this.guests = const [],
    required this.requestedChanges,
  });

  bool get isGuestAccess =>
      requestType == 'guest_access' ||
      guestName != null ||
      guestPlateNumber != null ||
      guests.isNotEmpty;

  bool get isApproved => status.toLowerCase() == 'approved';
  bool get isRejected => status.toLowerCase() == 'rejected';
  bool get isPending => status.toLowerCase() == 'pending';
  bool get hasMultipleGuests => guests.length > 1;
  int get guestCount => guests.isNotEmpty ? guests.length : (guestName != null ? 1 : 0);

  factory UpdateRequestModel.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> changes = {};
    final rawChanges = json['requested_changes'];
    if (rawChanges is Map<String, dynamic>) {
      changes = rawChanges;
    } else if (rawChanges is String && rawChanges.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawChanges);
        if (decoded is Map<String, dynamic>) {
          changes = decoded;
        }
      } catch (_) {}
    }

    final rType = (changes['request_type'] as String?) ??
        (json['request_type'] as String?) ??
        'guest_access';

    final List<GuestItemModel> parsedGuests = [];
    if (changes['guests'] is List) {
      for (final item in changes['guests'] as List) {
        if (item is Map<String, dynamic>) {
          parsedGuests.add(GuestItemModel.fromJson(item));
        } else if (item is Map) {
          parsedGuests.add(GuestItemModel.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }

    final topName = (changes['guest_name'] as String?) ??
        (json['guest_name'] as String?);
    final topPlate = (changes['guest_plate_number'] as String?) ??
        (json['guest_plate_number'] as String?);
    final topContact = (changes['guest_contact_number'] as String?) ??
        (json['guest_contact_number'] as String?);
    final topModel = (changes['guest_car_model'] as String?) ??
        (json['guest_car_model'] as String?);

    if (parsedGuests.isEmpty && topName != null && topName.isNotEmpty) {
      parsedGuests.add(GuestItemModel(
        name: topName,
        contactNumber: topContact,
        plateNumber: topPlate,
        carModel: topModel,
      ));
    }

    return UpdateRequestModel(
      id: json['update_request_id'] as int? ??
          json['request_id'] as int? ??
          json['id'] as int? ??
          0,
      requestType: rType,
      status: json['status'] as String? ?? 'pending',
      notes: json['admin_notes'] as String? ?? json['message'] as String?,
      createdAt: json['created_at'] as String? ?? '',
      guestName: topName,
      guestPlateNumber: topPlate,
      accessReason: (changes['access_reason'] as String?) ??
          (json['access_reason'] as String?),
      accessDate: (changes['access_date'] as String?) ??
          (json['access_date'] as String?),
      guests: parsedGuests,
      requestedChanges: changes,
    );
  }
}
