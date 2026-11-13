import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../models/gate_log_model.dart';
import '../models/notification_model.dart';
import '../models/update_request_model.dart';
import '../models/visitor_request_model.dart';

class ResidentService {
  final Dio _dio;

  ResidentService(this._dio);

  /// Get current gate status (OPEN / CLOSED)
  Future<Map<String, dynamic>> getGateStatus() async {
    final response = await _dio.get(ApiConstants.gateStatus);
    return response.data as Map<String, dynamic>;
  }

  /// Get personal gate logs
  Future<List<GateLogModel>> getMyGateLogs() async {
    try {
      final response = await _dio.get(ApiConstants.myGateLogs);
      final data = response.data;
      List rawList = [];
      if (data is Map && data['logs'] != null) {
        if (data['logs']['data'] is List) {
          rawList = data['logs']['data'] as List;
        } else if (data['logs'] is List) {
          rawList = data['logs'] as List;
        }
      } else if (data is List) {
        rawList = data;
      }
      return rawList
          .map((e) => GateLogModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Get notifications
  Future<List<NotificationModel>> getNotifications() async {
    try {
      final response = await _dio.get(ApiConstants.notifications);
      final data = response.data;
      List rawList = [];
      if (data is Map && data['notifications'] != null) {
        if (data['notifications']['data'] is List) {
          rawList = data['notifications']['data'] as List;
        } else if (data['notifications'] is List) {
          rawList = data['notifications'] as List;
        }
      } else if (data is List) {
        rawList = data;
      }
      return rawList
          .map((e) => NotificationModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Mark all notifications as read
  Future<void> markAllNotificationsRead() async {
    try {
      await _dio.put(ApiConstants.markAllNotificationsRead);
    } catch (_) {}
  }

  /// Mark single notification as read
  Future<void> markNotificationRead(int id) async {
    try {
      await _dio.put(ApiConstants.markNotificationRead(id));
    } catch (_) {}
  }

  /// Delete single notification
  Future<bool> deleteNotification(int id) async {
    try {
      final response = await _dio.delete(ApiConstants.deleteNotification(id));
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (_) {
      return false;
    }
  }

  /// Delete all notifications
  Future<bool> clearAllNotifications() async {
    try {
      final response = await _dio.delete(ApiConstants.clearAllNotifications);
      return response.statusCode == 200 || response.statusCode == 204;
    } catch (_) {
      return false;
    }
  }

  /// Get update requests
  Future<List<UpdateRequestModel>> getMyUpdateRequests() async {
    try {
      final response = await _dio.get(ApiConstants.myUpdateRequests);
      final data = response.data;
      List rawList = [];
      if (data is Map && data['requests'] != null) {
        if (data['requests']['data'] is List) {
          rawList = data['requests']['data'] as List;
        } else if (data['requests'] is List) {
          rawList = data['requests'] as List;
        }
      } else if (data is List) {
        rawList = data;
      }
      return rawList
          .map((e) => UpdateRequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Submit a new guest access or profile update request
  Future<Map<String, dynamic>> submitUpdateRequest(
      Map<String, dynamic> payload) async {
    final response = await _dio.post(
      ApiConstants.submitUpdateRequest,
      data: payload,
    );
    return response.data as Map<String, dynamic>;
  }

  // ── Visitor Request Methods ──────────────────────────────────────────────

  /// Fetch all visitor requests for the authenticated resident.
  Future<List<VisitorRequestModel>> getMyVisitorRequests() async {
    try {
      final response = await _dio.get(ApiConstants.myVisitorRequests);
      final data = response.data;
      List rawList = [];
      if (data is Map && data['requests'] != null) {
        final requests = data['requests'];
        if (requests is Map && requests['data'] is List) {
          rawList = requests['data'] as List;
        } else if (requests is List) {
          rawList = requests;
        }
      } else if (data is List) {
        rawList = data;
      }
      return rawList
          .map((e) => VisitorRequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Resident confirms or rejects a walk-in visitor request.
  /// [response] must be 'CONFIRM' or 'REJECT'.
  Future<Map<String, dynamic>> residentRespond(
      int requestId, String response, {String? notes}) async {
    final res = await _dio.put(
      ApiConstants.residentRespond(requestId),
      data: {
        'response': response,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
    );
    return res.data as Map<String, dynamic>;
  }

  /// Resident cancels their own pre-registered visitor request.
  Future<Map<String, dynamic>> residentCancelRequest(int requestId) async {
    final res = await _dio.put(ApiConstants.residentCancel(requestId));
    return res.data as Map<String, dynamic>;
  }

  /// Pre-register an expected visitor.
  Future<Map<String, dynamic>> createVisitorRequest(
      Map<String, dynamic> payload) async {
    final res = await _dio.post(
      ApiConstants.createVisitorRequest,
      data: payload,
    );
    return res.data as Map<String, dynamic>;
  }

}
