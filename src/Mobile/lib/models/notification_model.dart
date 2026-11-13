import 'dart:convert';

/// Representation of an individual metadata or detail item in a notification
class NotificationDetailField {
  final String label;
  final String value;
  final String icon;

  const NotificationDetailField({
    required this.label,
    required this.value,
    this.icon = 'info',
  });
}

class NotificationModel {
  final int id;
  final int? userId;
  final int? requestId;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final String createdAt;
  final String? updatedAt;
  final Map<String, dynamic>? visitorRequest;
  final Map<String, dynamic>? rawJson;

  NotificationModel({
    required this.id,
    this.userId,
    this.requestId,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.updatedAt,
    this.visitorRequest,
    this.rawJson,
  });

  NotificationModel copyWith({
    int? id,
    int? userId,
    int? requestId,
    String? title,
    String? message,
    String? type,
    bool? isRead,
    String? createdAt,
    String? updatedAt,
    Map<String, dynamic>? visitorRequest,
    Map<String, dynamic>? rawJson,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      requestId: requestId ?? this.requestId,
      title: title ?? this.title,
      message: message ?? this.message,
      type: type ?? this.type,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      visitorRequest: visitorRequest ?? this.visitorRequest,
      rawJson: rawJson ?? this.rawJson,
    );
  }

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? visReq;
    if (json['visitor_request'] is Map<String, dynamic>) {
      visReq = json['visitor_request'] as Map<String, dynamic>;
    } else if (json['visitorRequest'] is Map<String, dynamic>) {
      visReq = json['visitorRequest'] as Map<String, dynamic>;
    }

    return NotificationModel(
      id: json['id'] as int? ?? json['notification_id'] as int? ?? 0,
      userId: json['user_id'] as int?,
      requestId: json['request_id'] as int?,
      title: json['title'] as String? ?? 'Notification',
      message: json['message'] as String? ?? '',
      type: json['type'] as String? ?? 'general',
      isRead: json['is_read'] as bool? ?? false,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String?,
      visitorRequest: visReq,
      rawJson: json,
    );
  }

  /// Parses JSON message if message payload is encoded in JSON
  Map<String, dynamic>? get parsedJsonPayload {
    final trimmed = message.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        final decoded = jsonDecode(trimmed);
        if (decoded is Map<String, dynamic>) return decoded;
      } catch (_) {}
    }
    return null;
  }

  /// Formatted date string e.g. "Sep 28, 2026 • 2:30 PM"
  String get formattedDateTime {
    if (createdAt.isEmpty) return 'Recent';
    try {
      final dt = DateTime.parse(createdAt).toLocal();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final month = months[dt.month - 1];
      final day = dt.day;
      final year = dt.year;
      final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
      final period = dt.hour >= 12 ? 'PM' : 'AM';
      final minute = dt.minute.toString().padLeft(2, '0');
      return '$month $day, $year • $hour:$minute $period';
    } catch (_) {
      return createdAt;
    }
  }

  /// Relative time e.g. "5m ago", "2h ago", "Yesterday"
  String get timeAgo {
    if (createdAt.isEmpty) return '';
    try {
      final dt = DateTime.parse(createdAt).toLocal();
      final diff = DateTime.now().difference(dt);

      if (diff.inSeconds < 45) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays == 1) return 'Yesterday';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
      return '${(diff.inDays / 30).floor()}mo ago';
    } catch (_) {
      return createdAt;
    }
  }

  /// Human friendly category label
  String get categoryDisplayName {
    final lowerType = type.toLowerCase();
    final lowerTitle = title.toLowerCase();

    if (lowerType.contains('visitor') || lowerTitle.contains('visitor') || lowerTitle.contains('guest')) {
      return 'Visitor Pass';
    }
    if (lowerType.contains('gate') || lowerTitle.contains('gate') || lowerTitle.contains('entry') || lowerTitle.contains('exit')) {
      return 'Gate Access';
    }
    if (lowerType.contains('security') || lowerType.contains('unauthorized') || lowerTitle.contains('security')) {
      return 'Security Alert';
    }
    if (lowerType.contains('emergency') || lowerTitle.contains('emergency')) {
      return 'Emergency Alert';
    }
    if (lowerType.contains('approval') || lowerTitle.contains('approval')) {
      return 'Account Approval';
    }
    if (lowerType.contains('update') || lowerTitle.contains('update')) {
      return 'Request Update';
    }
    return 'System Notice';
  }

  /// Returns structured detailed key-value fields for displaying in details modal
  List<NotificationDetailField> get extractedFields {
    final list = <NotificationDetailField>[];

    // Reference ID
    list.add(NotificationDetailField(
      label: 'Notification ID',
      value: '#$id',
      icon: 'tag',
    ));

    // Category / Type
    list.add(NotificationDetailField(
      label: 'Category',
      value: categoryDisplayName,
      icon: 'category',
    ));

    // Read status
    list.add(NotificationDetailField(
      label: 'Status',
      value: isRead ? 'Read' : 'Unread',
      icon: 'status',
    ));

    // Date & Time
    list.add(NotificationDetailField(
      label: 'Received At',
      value: formattedDateTime,
      icon: 'time',
    ));

    // Check if visitor request relationship exists
    if (visitorRequest != null) {
      final req = visitorRequest!;
      if (req['request_id'] != null) {
        list.add(NotificationDetailField(
          label: 'Request ID',
          value: '#${req['request_id']}',
          icon: 'badge',
        ));
      }

      final vis = req['visitor'] is Map ? req['visitor'] as Map : null;
      if (vis != null) {
        final name = vis['full_name'] as String? ??
            '${vis['first_name'] ?? ''} ${vis['last_name'] ?? ''}'.trim();
        if (name.isNotEmpty) {
          list.add(NotificationDetailField(
            label: 'Visitor Name',
            value: name,
            icon: 'person',
          ));
        }

        final plate = vis['vehicle_plate'] as String?;
        if (plate != null && plate.trim().isNotEmpty) {
          list.add(NotificationDetailField(
            label: 'Vehicle Plate',
            value: plate.toUpperCase(),
            icon: 'car',
          ));
        }

        final phone = vis['contact_number'] as String?;
        if (phone != null && phone.trim().isNotEmpty) {
          list.add(NotificationDetailField(
            label: 'Contact Number',
            value: phone,
            icon: 'phone',
          ));
        }

        final company = vis['company_name'] as String?;
        if (company != null && company.trim().isNotEmpty) {
          list.add(NotificationDetailField(
            label: 'Company / Organization',
            value: company,
            icon: 'business',
          ));
        }
      }

      if (req['visit_date'] != null && req['visit_date'].toString().isNotEmpty) {
        list.add(NotificationDetailField(
          label: 'Visit Date',
          value: req['visit_date'].toString(),
          icon: 'calendar',
        ));
      }

      if (req['visit_time'] != null && req['visit_time'].toString().isNotEmpty) {
        list.add(NotificationDetailField(
          label: 'Visit Time',
          value: req['visit_time'].toString(),
          icon: 'clock',
        ));
      }

      if (req['purpose'] != null && req['purpose'].toString().isNotEmpty) {
        list.add(NotificationDetailField(
          label: 'Visit Purpose',
          value: req['purpose'].toString(),
          icon: 'notes',
        ));
      }

      if (req['status'] != null && req['status'].toString().isNotEmpty) {
        list.add(NotificationDetailField(
          label: 'Request Status',
          value: req['status'].toString().toUpperCase(),
          icon: 'status',
        ));
      }

      if (req['guard_remarks'] != null &&
          req['guard_remarks'].toString().isNotEmpty) {
        list.add(NotificationDetailField(
          label: 'Guard Remarks',
          value: req['guard_remarks'].toString(),
          icon: 'notes',
        ));
      }
    } else {
      // Check JSON payload
      final jsonPayload = parsedJsonPayload;
      if (jsonPayload != null) {
        if (jsonPayload['name'] != null) {
          list.add(NotificationDetailField(
            label: 'Applicant Name',
            value: jsonPayload['name'].toString(),
            icon: 'person',
          ));
        }
        if (jsonPayload['email'] != null) {
          list.add(NotificationDetailField(
            label: 'Email Address',
            value: jsonPayload['email'].toString(),
            icon: 'email',
          ));
        }
        if (jsonPayload['role'] != null) {
          list.add(NotificationDetailField(
            label: 'Requested Role',
            value: jsonPayload['role'].toString().replaceAll('_', ' ').toUpperCase(),
            icon: 'badge',
          ));
        }
        if (jsonPayload['target_user_id'] != null) {
          list.add(NotificationDetailField(
            label: 'User ID',
            value: '#${jsonPayload['target_user_id']}',
            icon: 'tag',
          ));
        }
      } else {
        // Parse regex details from text message
        final cleanMsg = message;

        // Visitor Name
        final visitorMatch = RegExp(
          r'(?:Visitor Alert:\s*|New Visitor Request:\s*|Visitor Pass for\s*|visitor pass for\s*)([A-Za-z\s]+?)(?:\s+(?:wants to visit|is at the subdivision gate|has been approved|has been denied|on|at|Purpose:))',
          caseSensitive: false,
        ).firstMatch(cleanMsg);
        if (visitorMatch != null && visitorMatch.group(1) != null) {
          final val = visitorMatch.group(1)!.trim();
          if (val.isNotEmpty && val.length > 2) {
            list.add(NotificationDetailField(
              label: 'Visitor Name',
              value: val,
              icon: 'person',
            ));
          }
        }

        // Plate
        final plateMatch = RegExp(
          r'(?:plate\s*(?:number)?\s*[:\s(]+|\()([A-Z0-9\s-]{4,10})\)?',
          caseSensitive: false,
        ).firstMatch(cleanMsg);
        if (plateMatch != null && plateMatch.group(1) != null) {
          final val = plateMatch.group(1)!.trim();
          if (val.isNotEmpty && !val.contains('http')) {
            list.add(NotificationDetailField(
              label: 'Vehicle Plate',
              value: val.toUpperCase(),
              icon: 'car',
            ));
          }
        }

        // Purpose
        final purposeMatch = RegExp(
          r'Purpose:\s*([^|\n]+)',
          caseSensitive: false,
        ).firstMatch(cleanMsg);
        if (purposeMatch != null && purposeMatch.group(1) != null) {
          list.add(NotificationDetailField(
            label: 'Purpose',
            value: purposeMatch.group(1)!.trim(),
            icon: 'notes',
          ));
        }

        // Time
        final timeMatch = RegExp(
          r'(?:Time:\s*|at\s+)(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)',
          caseSensitive: false,
        ).firstMatch(cleanMsg);
        if (timeMatch != null && timeMatch.group(1) != null) {
          list.add(NotificationDetailField(
            label: 'Time',
            value: timeMatch.group(1)!.trim(),
            icon: 'clock',
          ));
        }

        // Date
        final dateMatch = RegExp(
          r'(?:Date:\s*|on\s+)(\d{4}-\d{2}-\d{2})',
          caseSensitive: false,
        ).firstMatch(cleanMsg);
        if (dateMatch != null && dateMatch.group(1) != null) {
          list.add(NotificationDetailField(
            label: 'Date',
            value: dateMatch.group(1)!.trim(),
            icon: 'calendar',
          ));
        }

        // Reason / Note
        final noteMatch = RegExp(
          r'(?:Note|Reason):\s*([^|\n]+)',
          caseSensitive: false,
        ).firstMatch(cleanMsg);
        if (noteMatch != null && noteMatch.group(1) != null) {
          list.add(NotificationDetailField(
            label: 'Note / Remarks',
            value: noteMatch.group(1)!.trim(),
            icon: 'notes',
          ));
        }
      }
    }

    if (requestId != null && !list.any((f) => f.label == 'Request ID')) {
      list.add(NotificationDetailField(
        label: 'Request ID',
        value: '#$requestId',
        icon: 'badge',
      ));
    }

    return list;
  }
}
