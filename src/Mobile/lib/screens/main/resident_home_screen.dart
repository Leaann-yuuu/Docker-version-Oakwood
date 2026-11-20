import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/plate_input_formatter.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/gate_log_model.dart';
import '../../models/notification_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/modals/notification_detail_dialog.dart';
import '../../widgets/live_clock_badge.dart';

enum ResidentModalType { notifications, logs, guest, profile, none }

class ResidentHomeScreen extends ConsumerStatefulWidget {
  final Function(int)? onNavigateTab;
  final bool isActive;

  const ResidentHomeScreen({
    super.key,
    this.onNavigateTab,
    this.isActive = true,
  });

  @override
  ConsumerState<ResidentHomeScreen> createState() => _ResidentHomeScreenState();
}

class _ResidentHomeScreenState extends ConsumerState<ResidentHomeScreen> {
  ResidentModalType _activeModal = ResidentModalType.none;

  // Guest Access Form controllers
  final _guestFormKey = GlobalKey<FormState>();
  final List<_GuestEntry> _guestEntries = [_GuestEntry()];
  final _guestDateCtrl = TextEditingController();
  final _guestTimeCtrl = TextEditingController(text: '08:00 AM');
  final _guestEndDateCtrl = TextEditingController();
  final _guestEndTimeCtrl = TextEditingController(text: '11:59 PM');
  String _selectedDuration = '1_day';
  final _guestReasonCtrl = TextEditingController();
  bool _isSubmittingGuest = false;
  final _recentNotifScrollCtrl = ScrollController();
  final _modalNotifScrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _guestDateCtrl.text =
        "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
    _guestEndDateCtrl.text = _guestDateCtrl.text;
  }

  @override
  void dispose() {
    for (final entry in _guestEntries) {
      entry.dispose();
    }
    _guestDateCtrl.dispose();
    _guestTimeCtrl.dispose();
    _guestEndDateCtrl.dispose();
    _guestEndTimeCtrl.dispose();
    _guestReasonCtrl.dispose();
    _recentNotifScrollCtrl.dispose();
    _modalNotifScrollCtrl.dispose();
    super.dispose();
  }

  void _openModal(ResidentModalType type) {
    setState(() => _activeModal = type);
  }

  void _closeModal() {
    setState(() => _activeModal = ResidentModalType.none);
  }

  void _openNotificationDetails(NotificationModel notif) {
    NotificationDetailDialog.show(
      context,
      notification: notif,
      onMarkedRead: () {
        ref.invalidate(notificationsProvider);
      },
      onDeleted: () {
        ref.invalidate(notificationsProvider);
      },
    );
  }

  Future<void> _confirmDeleteNotification(NotificationModel notif) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.65),
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          width: 320.w,
          padding: EdgeInsets.all(20.r),
          decoration: BoxDecoration(
            color: Theme.of(ctx).cardColor,
            borderRadius: BorderRadius.circular(18.r),
            border: Border.all(color: Theme.of(ctx).dividerColor),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 46.r,
                height: 46.r,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(
                  Icons.delete_outline_rounded,
                  color: const Color(0xFFEF4444),
                  size: 22.r,
                ),
              ),
              SizedBox(height: 14.h),
              Text(
                'Delete Notification?',
                style: TextStyle(
                  color: Theme.of(ctx).colorScheme.onSurface,
                  fontSize: 16.sp,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.2,
                ),
              ),
              SizedBox(height: 8.h),
              Text(
                'Are you sure you want to remove this notification?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12.5.sp,
                  height: 1.4,
                ),
              ),
              SizedBox(height: 20.h),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Theme.of(ctx).dividerColor),
                        padding: EdgeInsets.symmetric(vertical: 11.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13.sp,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(ctx).pop(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: EdgeInsets.symmetric(vertical: 11.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                      ),
                      child: Text(
                        'Delete',
                        style: TextStyle(
                          fontSize: 13.sp,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      final success =
          await ref.read(residentServiceProvider).deleteNotification(notif.id);
      if (mounted) {
        if (success) {
          ToastHelper.showSuccess(context, 'Notification deleted');
          ref.invalidate(notificationsProvider);
        } else {
          ToastHelper.showError(context, 'Failed to delete notification');
        }
      }
    }
  }

  Future<void> _confirmClearAllNotifications() async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.65),
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          width: 320.w,
          padding: EdgeInsets.all(20.r),
          decoration: BoxDecoration(
            color: Theme.of(ctx).cardColor,
            borderRadius: BorderRadius.circular(18.r),
            border: Border.all(color: Theme.of(ctx).dividerColor),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48.r,
                height: 48.r,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(
                  Icons.delete_sweep_rounded,
                  color: const Color(0xFFEF4444),
                  size: 24.r,
                ),
              ),
              SizedBox(height: 14.h),
              Text(
                'Clear All Notifications?',
                style: TextStyle(
                  color: Theme.of(ctx).colorScheme.onSurface,
                  fontSize: 16.sp,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.2,
                ),
              ),
              SizedBox(height: 8.h),
              Text(
                'This will permanently delete all notifications from your account.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12.5.sp,
                  height: 1.4,
                ),
              ),
              SizedBox(height: 20.h),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Theme.of(ctx).dividerColor),
                        padding: EdgeInsets.symmetric(vertical: 11.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13.sp,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(ctx).pop(true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: EdgeInsets.symmetric(vertical: 11.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                      ),
                      child: Text(
                        'Clear All',
                        style: TextStyle(
                          fontSize: 13.sp,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      final success =
          await ref.read(residentServiceProvider).clearAllNotifications();
      if (mounted) {
        if (success) {
          ToastHelper.showSuccess(context, 'All notifications cleared');
          ref.invalidate(notificationsProvider);
        } else {
          ToastHelper.showError(context, 'Failed to clear notifications');
        }
      }
    }
  }

  @override
  void didUpdateWidget(ResidentHomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive && !widget.isActive) {
      if (_activeModal != ResidentModalType.none) {
        setState(() => _activeModal = ResidentModalType.none);
      }
    }
  }

  DateTime _parseStartDate() {
    if (_guestDateCtrl.text.isNotEmpty) {
      try {
        return DateTime.parse(_guestDateCtrl.text);
      } catch (_) {}
    }
    return DateTime.now();
  }

  void _applyDuration(String duration) {
    final start = _parseStartDate();
    DateTime end = start;

    switch (duration) {
      case '1_day':
        end = start;
        break;
      case '1_week':
        end = start.add(const Duration(days: 7));
        break;
      case '1_month':
        end = DateTime(start.year, start.month + 1, start.day);
        break;
      case '6_months':
        end = DateTime(start.year, start.month + 6, start.day);
        break;
      case '1_year':
        end = DateTime(start.year + 1, start.month, start.day);
        break;
      case 'custom':
        break;
    }

    setState(() {
      _selectedDuration = duration;
      if (duration != 'custom') {
        _guestEndDateCtrl.text =
            "${end.year.toString().padLeft(4, '0')}-${end.month.toString().padLeft(2, '0')}-${end.day.toString().padLeft(2, '0')}";
      }
    });

    if (duration == 'custom') {
      _pickGuestEndDate();
    }
  }

  String _formatTimeOfDay(TimeOfDay tod) {
    final hour = tod.hourOfPeriod == 0 ? 12 : tod.hourOfPeriod;
    final minute = tod.minute.toString().padLeft(2, '0');
    final period = tod.period == DayPeriod.am ? 'AM' : 'PM';
    return '${hour.toString().padLeft(2, '0')}:$minute $period';
  }

  Future<void> _pickGuestDate() async {
    final now = DateTime.now();
    DateTime initial = now;
    if (_guestDateCtrl.text.isNotEmpty) {
      try {
        final parsed = DateTime.parse(_guestDateCtrl.text);
        if (!parsed.isBefore(DateTime(now.year, now.month, now.day))) {
          initial = parsed;
        }
      } catch (_) {}
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 5),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF3B82F6),
              onPrimary: Colors.white,
              surface: Color(0xFF1E2330),
              onSurface: Colors.white,
            ),
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFF1E2330),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final formatted =
          "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      setState(() {
        _guestDateCtrl.text = formatted;
        if (_selectedDuration != 'custom') {
          _applyDuration(_selectedDuration);
        } else {
          if (_guestEndDateCtrl.text.isNotEmpty) {
            try {
              final end = DateTime.parse(_guestEndDateCtrl.text);
              if (end.isBefore(picked)) {
                _guestEndDateCtrl.text = formatted;
              }
            } catch (_) {
              _guestEndDateCtrl.text = formatted;
            }
          }
        }
      });
    }
  }

  Future<void> _pickGuestTime() async {
    TimeOfDay initial = const TimeOfDay(hour: 8, minute: 0);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF3B82F6),
              onPrimary: Colors.white,
              surface: Color(0xFF1E2330),
              onSurface: Colors.white,
            ),
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFF1E2330),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _guestTimeCtrl.text = _formatTimeOfDay(picked);
      });
    }
  }

  Future<void> _pickGuestEndDate() async {
    final start = _parseStartDate();
    DateTime initial = start;
    if (_guestEndDateCtrl.text.isNotEmpty) {
      try {
        final parsed = DateTime.parse(_guestEndDateCtrl.text);
        if (!parsed.isBefore(start)) {
          initial = parsed;
        }
      } catch (_) {}
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: start,
      lastDate: DateTime(start.year + 5),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF3B82F6),
              onPrimary: Colors.white,
              surface: Color(0xFF1E2330),
              onSurface: Colors.white,
            ),
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFF1E2330),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final formatted =
          "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      setState(() {
        _guestEndDateCtrl.text = formatted;
        _selectedDuration = 'custom';
      });
    }
  }

  Future<void> _pickGuestEndTime() async {
    TimeOfDay initial = const TimeOfDay(hour: 23, minute: 59);
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF3B82F6),
              onPrimary: Colors.white,
              surface: Color(0xFF1E2330),
              onSurface: Colors.white,
            ),
            dialogTheme: const DialogThemeData(
              backgroundColor: Color(0xFF1E2330),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _guestEndTimeCtrl.text = _formatTimeOfDay(picked);
      });
    }
  }

  Widget _buildDurationChip(String label, String key, IconData icon) {
    final isSelected = _selectedDuration == key;
    return InkWell(
      onTap: () => _applyDuration(key),
      borderRadius: BorderRadius.circular(8.r),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF2563EB)
              : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(8.r),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF60A5FA)
                : const Color(0xFF334155),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13.r,
              color: isSelected ? Colors.white : const Color(0xFF94A3B8),
            ),
            SizedBox(width: 4.w),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.sp,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submitGuestAccess() async {
    if (!(_guestFormKey.currentState?.validate() ?? false)) return;

    setState(() => _isSubmittingGuest = true);
    try {
      final service = ref.read(residentServiceProvider);

      final guestsData = <Map<String, dynamic>>[];
      for (int i = 0; i < _guestEntries.length; i++) {
        final entry = _guestEntries[i];
        final name = entry.nameCtrl.text.trim();
        if (name.isEmpty) continue;

        final contact = entry.contactCtrl.text.trim();
        final plate = entry.plateCtrl.text.trim().toUpperCase();
        final model = entry.modelCtrl.text.trim();

        final effectiveContact = contact.isNotEmpty
            ? contact
            : _guestEntries[0].contactCtrl.text.trim();
        final effectivePlate = plate.isNotEmpty
            ? plate
            : _guestEntries[0].plateCtrl.text.trim().toUpperCase();
        final effectiveModel = model.isNotEmpty
            ? model
            : _guestEntries[0].modelCtrl.text.trim();

        guestsData.add({
          'name': name,
          'guest_name': name,
          'contact_number': effectiveContact,
          'guest_contact_number': effectiveContact,
          'plate_number': effectivePlate,
          'guest_plate_number': effectivePlate,
          'car_model': effectiveModel,
          'guest_car_model': effectiveModel,
        });
      }

      if (guestsData.isEmpty) {
        ToastHelper.showError(context, 'Please add at least one guest.');
        return;
      }

      final primary = guestsData.first;
      await service.submitUpdateRequest({
        'request_type': 'guest_access',
        'guest_name': primary['name'],
        'guest_contact_number': primary['contact_number'],
        'guest_plate_number': primary['plate_number'],
        'guest_car_model': primary['car_model'],
        'access_date': _guestDateCtrl.text.trim(),
        'access_time': _guestTimeCtrl.text.trim(),
        'access_end_date': _guestEndDateCtrl.text.trim().isNotEmpty
            ? _guestEndDateCtrl.text.trim()
            : _guestDateCtrl.text.trim(),
        'access_end_time': _guestEndTimeCtrl.text.trim(),
        'valid_until': _guestEndDateCtrl.text.trim().isNotEmpty
            ? _guestEndDateCtrl.text.trim()
            : _guestDateCtrl.text.trim(),
        'pass_duration': _selectedDuration,
        'access_reason': _guestReasonCtrl.text.trim(),
        'guests': guestsData,
      });

      for (final entry in _guestEntries) {
        entry.dispose();
      }
      _guestEntries.clear();
      _guestEntries.add(_GuestEntry());

      final now = DateTime.now();
      _guestDateCtrl.text =
          "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
      _guestTimeCtrl.text = '08:00 AM';
      _guestEndDateCtrl.text = _guestDateCtrl.text;
      _guestEndTimeCtrl.text = '11:59 PM';
      _selectedDuration = '1_day';
      _guestReasonCtrl.clear();

      ref.invalidate(myUpdateRequestsProvider);

      if (mounted) {
        final count = guestsData.length;
        ToastHelper.showSuccess(
          context,
          count > 1
              ? 'Guest access request for $count guests submitted for admin review.'
              : 'Guest access request submitted for admin review.',
        );
        _closeModal();
      }
    } catch (e) {
      if (mounted) {
        ToastHelper.showError(
          context,
          'Failed to submit guest access request.',
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmittingGuest = false);
    }
  }

  DateTime _parseToPhilippineTime(String iso) {
    final parsed = DateTime.parse(iso.trim());
    if (parsed.isUtc) {
      // Convert UTC to Philippine Standard Time (UTC+8)
      return parsed.add(const Duration(hours: 8));
    }
    return parsed;
  }

  String _formatDate(String iso) {
    try {
      final dt = _parseToPhilippineTime(iso);
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final monthStr = months[dt.month - 1];
      final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final minStr = dt.minute.toString().padLeft(2, '0');
      return '$monthStr ${dt.day}, ${dt.year} at $hour:$minStr $ampm';
    } catch (_) {
      return iso;
    }
  }

  String _formatPhilippineTime(String iso) {
    if (iso.trim().isEmpty) return 'No time';
    try {
      final dt = _parseToPhilippineTime(iso);
      final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final minStr = dt.minute.toString().padLeft(2, '0');
      return '$hour:$minStr $ampm';
    } catch (_) {
      return iso;
    }
  }

  String _formatPhilippineDate(String iso) {
    if (iso.trim().isEmpty) return 'No date';
    try {
      final dt = _parseToPhilippineTime(iso);
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final monthStr = months[dt.month - 1];
      return '$monthStr ${dt.day}, ${dt.year}';
    } catch (_) {
      return iso;
    }
  }

  String _formatPhilippineDateTime(String iso) {
    if (iso.trim().isEmpty) return 'N/A';
    try {
      final dt = _parseToPhilippineTime(iso);
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final monthStr = months[dt.month - 1];
      final hour = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final minStr = dt.minute.toString().padLeft(2, '0');
      return '$monthStr ${dt.day}, ${dt.year} • $hour:$minStr $ampm';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authProvider);
    final logsAsync = ref.watch(myGateLogsProvider);
    final notifsAsync = ref.watch(notificationsProvider);
    final requestsAsync = ref.watch(myUpdateRequestsProvider);

    return Scaffold(
      body: authAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (user) {
          final p = AppColors.palette;
          final isDark = p.isDark;
          final logs = logsAsync.value ?? [];
          final notifs = notifsAsync.value ?? [];
          final requests = requestsAsync.value ?? [];

          final lastEntry = logs.firstWhere(
            (l) => l.direction == 'IN',
            orElse: () => GateLogModel(
              id: 0,
              loggedAt: '',
              status: '',
              direction: '',
            ),
          );
          final lastExit = logs.firstWhere(
            (l) => l.direction == 'OUT',
            orElse: () => GateLogModel(
              id: 0,
              loggedAt: '',
              status: '',
              direction: '',
            ),
          );
          final unauthorizedCount =
              logs.where((l) => l.status.toLowerCase() == 'unauthorized').length;

          return Stack(
            children: [
              RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(myGateLogsProvider);
                  ref.invalidate(notificationsProvider);
                  ref.invalidate(myUpdateRequestsProvider);
                },
                child: CustomScrollView(
                  slivers: [
                    // ── Header Banner with Clock ─────────────────────────────
                    SliverAppBar(
                      automaticallyImplyLeading: false,
                      expandedHeight: 180.h,
                      pinned: true,
                      elevation: 0,
                      backgroundColor: AppColors.primaryDark,
                      flexibleSpace: FlexibleSpaceBar(
                        background: Container(
                          decoration: const BoxDecoration(
                            image: DecorationImage(
                              image: AssetImage('assets/images/subdivision-gate-background.png'),
                              fit: BoxFit.cover,
                            ),
                          ),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  p.heroFrom.withValues(alpha: 0.94),
                                  p.heroTo.withValues(alpha: 0.88),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                          child: SafeArea(
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(20.w, 12.h, 20.w, 0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        // ── Welcome Text ───────────────────────────
                                        Text(
                                          'Welcome back!',
                                          style: TextStyle(
                                            fontSize: 13.5.sp,
                                            color: Colors.white.withValues(alpha: 0.85),
                                            fontWeight: FontWeight.w500,
                                            letterSpacing: 0.2,
                                          ),
                                        ),
                                        SizedBox(height: 4.h),
                                        // ── User Name ──────────────────────────────
                                        Text(
                                          user?.name ?? 'Resident',
                                          style: TextStyle(
                                            fontSize: 26.sp,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                            letterSpacing: -0.3,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        SizedBox(height: 8.h),
                                        // ── Plate Badge ────────────────────────────
                                        if (user?.plateNumber != null)
                                          Container(
                                            padding: EdgeInsets.symmetric(
                                              horizontal: 12.w,
                                              vertical: 5.h,
                                            ),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withValues(alpha: 0.20),
                                              borderRadius: BorderRadius.circular(24.r),
                                              border: Border.all(
                                                color: Colors.white.withValues(alpha: 0.40),
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(
                                                  Icons.directions_car_rounded,
                                                  size: 13.r,
                                                  color: Colors.white,
                                                ),
                                                SizedBox(width: 5.w),
                                                Text(
                                                  'Plate: ${user!.plateNumber!}',
                                                  style: TextStyle(
                                                    fontSize: 12.sp,
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  SizedBox(width: 8.w),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const LiveClockBadge(),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          ),
                        ),
                      ),
                    ),

                    // ── Main Content ─────────────────────────────────────────
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 120.h),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          // ── 3 Summary Cards ──────────────────────────────
                          Row(
                            children: [
                              Expanded(
                                child: _SummaryCardTile(
                                  title: 'Last Entry',
                                  value: lastEntry.loggedAt.isNotEmpty
                                      ? _formatPhilippineTime(lastEntry.loggedAt)
                                      : 'No entries',
                                  subText: lastEntry.loggedAt.isNotEmpty
                                      ? _formatPhilippineDate(lastEntry.loggedAt)
                                      : 'No recent activity',
                                  badge: lastEntry.loggedAt.isNotEmpty ? 'AUTHORIZED' : null,
                                  badgeColor: p.authorizedPillText,
                                  badgeBgColor: p.authorizedPillBg,
                                  icon: Icons.arrow_downward_rounded,
                                  iconColor: p.authorizedPillText,
                                  iconBgColor: p.authorizedPillBg,
                                ),
                              ),
                              SizedBox(width: 10.w),
                              Expanded(
                                child: _SummaryCardTile(
                                  title: 'Last Exit',
                                  value: lastExit.loggedAt.isNotEmpty
                                      ? _formatPhilippineTime(lastExit.loggedAt)
                                      : 'No exits',
                                  subText: lastExit.loggedAt.isNotEmpty
                                      ? _formatPhilippineDate(lastExit.loggedAt)
                                      : 'No recent activity',
                                  badge: lastExit.loggedAt.isNotEmpty ? 'AUTHORIZED' : null,
                                  badgeColor: p.exitPillText,
                                  badgeBgColor: p.exitPillBg,
                                  icon: Icons.arrow_upward_rounded,
                                  iconColor: p.exitPillText,
                                  iconBgColor: p.exitPillBg,
                                ),
                              ),
                              SizedBox(width: 10.w),
                              Expanded(
                                child: _SummaryCardTile(
                                  title: 'Access Status',
                                  value: 'Authorized',
                                  subText: '${logs.length} accesses',
                                  badge: unauthorizedCount > 0
                                      ? '$unauthorizedCount alert'
                                      : null,
                                  badgeColor: const Color(0xFFEF4444),
                                  icon: Icons.lock_outline_rounded,
                                  iconColor: p.accentText,
                                  iconBgColor: p.accentSoft,
                                ),
                              ),
                            ],
                          ),

                          SizedBox(height: 20.h),

                          // ── Quick Links Box ──────────────────────────────
                          Container(
                            padding: EdgeInsets.all(16.r),
                            decoration: BoxDecoration(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(16.r),
                              border: Border.all(
                                color: Theme.of(context).dividerColor.withAlpha(40),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Quick Links',
                                  style: TextStyle(
                                    fontSize: 15.sp,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(height: 12.h),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _QuickLinkAction(
                                        icon: Icons.assignment_outlined,
                                        title: 'Gate Logs',
                                        sub: 'History',
                                        color: AppColors.primary,
                                        onTap: () => _openModal(ResidentModalType.logs),
                                      ),
                                    ),
                                    SizedBox(width: 12.w),
                                    Expanded(
                                      child: _QuickLinkAction(
                                        icon: Icons.directions_car_outlined,
                                        title: 'Guest Pass',
                                        sub: 'Visitor pass',
                                        color: const Color(0xFF0284C7),
                                        onTap: () => _openModal(ResidentModalType.guest),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          SizedBox(height: 20.h),

                          // ── Recent Notifications Box ──────────────────────
                          Container(
                            padding: EdgeInsets.all(16.r),
                            decoration: BoxDecoration(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(16.r),
                              border: Border.all(
                                color: Theme.of(context).dividerColor.withAlpha(40),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Recent Notifications',
                                      style: TextStyle(
                                        fontSize: 15.sp,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () => _openModal(ResidentModalType.notifications),
                                      child: Text(
                                        'View All',
                                        style: TextStyle(
                                          fontSize: 13.sp,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                SizedBox(height: 12.h),

                                if (notifs.isEmpty)
                                  Padding(
                                    padding: EdgeInsets.symmetric(vertical: 20.h),
                                    child: Center(
                                      child: Text(
                                        'No notifications yet',
                                        style: TextStyle(
                                          fontSize: 13.sp,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                  )
                                else
                                  ConstrainedBox(
                                    constraints: BoxConstraints(
                                      maxHeight: notifs.length > 3 ? 360.h : (notifs.length * 115.h),
                                    ),
                                    child: RawScrollbar(
                                      controller: _recentNotifScrollCtrl,
                                      thumbVisibility: true,
                                      interactive: true,
                                      thickness: 4.w,
                                      radius: const Radius.circular(4),
                                      thumbColor: Colors.white.withValues(alpha: 0.28),
                                      child: ListView.builder(
                                        controller: _recentNotifScrollCtrl,
                                        shrinkWrap: true,
                                        padding: EdgeInsets.only(right: 6.w),
                                        itemCount: notifs.length,
                                        itemBuilder: (context, index) {
                                          final notif = notifs[index];
                                          return Container(
                                        margin: EdgeInsets.only(
                                          bottom: index == notifs.length - 1 ? 0 : 8.h,
                                        ),
                                        decoration: BoxDecoration(
                                          color: notif.isRead
                                              ? Theme.of(context).cardColor
                                              : p.notifUnreadBg,
                                          borderRadius: BorderRadius.circular(16.r),
                                          border: Border.all(
                                            color: notif.isRead
                                                ? Theme.of(context).dividerColor.withValues(alpha: 0.45)
                                                : p.notifUnreadBorder,
                                            width: 1,
                                          ),
                                        ),
                                        child: Material(
                                          color: Colors.transparent,
                                          child: InkWell(
                                            borderRadius: BorderRadius.circular(10.r),
                                            onTap: () => _openNotificationDetails(notif),
                                            child: Padding(
                                              padding: EdgeInsets.all(12.r),
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Row(
                                                    children: [
                                                      Expanded(
                                                        child: Text(
                                                          notif.title.isNotEmpty
                                                              ? notif.title
                                                              : 'System Notification',
                                                          style: TextStyle(
                                                            fontSize: 13.sp,
                                                            fontWeight: FontWeight.bold,
                                                          ),
                                                        ),
                                                      ),
                                                      if (!notif.isRead)
                                                        Container(
                                                          width: 8.r,
                                                          height: 8.r,
                                                          margin: EdgeInsets.only(right: 6.w),
                                                          decoration: BoxDecoration(
                                                            color: p.unreadDot,
                                                            shape: BoxShape.circle,
                                                          ),
                                                        ),
                                                      Icon(
                                                        Icons.chevron_right_rounded,
                                                        color: Colors.grey.shade500,
                                                        size: 16.r,
                                                      ),
                                                    ],
                                                  ),
                                                  SizedBox(height: 4.h),
                                                  Text(
                                                    notif.message,
                                                    style: TextStyle(
                                                      fontSize: 12.sp,
                                                      color: AppColors.textSecondary,
                                                      height: 1.3,
                                                    ),
                                                    maxLines: 2,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                  SizedBox(height: 6.h),
                                                  Row(
                                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                    children: [
                                                      Text(
                                                        notif.timeAgo.isNotEmpty ? notif.timeAgo : notif.createdAt,
                                                        style: TextStyle(
                                                          fontSize: 10.5.sp,
                                                          color: Colors.grey.shade500,
                                                        ),
                                                      ),
                                                      Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          GestureDetector(
                                                            onTap: () => _confirmDeleteNotification(notif),
                                                            child: Padding(
                                                              padding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 2.h),
                                                              child: Row(
                                                                mainAxisSize: MainAxisSize.min,
                                                                children: [
                                                                  Icon(
                                                                    Icons.delete_outline_rounded,
                                                                    size: 13.r,
                                                                    color: const Color(0xFFEF4444).withValues(alpha: 0.8),
                                                                  ),
                                                                  SizedBox(width: 2.w),
                                                                  Text(
                                                                    'Delete',
                                                                    style: TextStyle(
                                                                      fontSize: 10.5.sp,
                                                                      color: const Color(0xFFEF4444).withValues(alpha: 0.8),
                                                                      fontWeight: FontWeight.w500,
                                                                    ),
                                                                  ),
                                                                ],
                                                              ),
                                                            ),
                                                          ),
                                                          SizedBox(width: 8.w),
                                                          Row(
                                                            mainAxisSize: MainAxisSize.min,
                                                            children: [
                                                              Text(
                                                                'Details',
                                                                style: TextStyle(
                                                                  fontSize: 10.5.sp,
                                                                  color: p.accentText,
                                                                  fontWeight: FontWeight.w700,
                                                                ),
                                                              ),
                                                              Icon(
                                                                Icons.chevron_right_rounded,
                                                                color: p.accentText,
                                                                size: 14.r,
                                                              ),
                                                            ],
                                                          ),
                                                        ],
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                                      );
                                        },
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Interactive Dashboard Modals ───────────────────────────────

              // 1. Notifications Modal
              if (_activeModal == ResidentModalType.notifications)
                _DashboardModalShell(
                  title: 'Notifications',
                  onClose: _closeModal,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Subtitle + Mark All Read Row ──────────────
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: EdgeInsets.all(6.r),
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? AppColors.primary.withValues(alpha: 0.2)
                                      : AppColors.primaryLight,
                                  borderRadius: BorderRadius.circular(8.r),
                                ),
                                child: Icon(
                                  Icons.notifications_active_rounded,
                                  color: isDark
                                      ? const Color(0xFF86EFAC)
                                      : AppColors.primary,
                                  size: 14.r,
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Text(
                                'Security alerts & messages',
                                style: TextStyle(
                                  fontSize: 12.sp,
                                  color: isDark
                                      ? const Color(0xFF94A3B8)
                                      : AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                          if (notifs.isNotEmpty)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                GestureDetector(
                                  onTap: () async {
                                    await ref
                                        .read(residentServiceProvider)
                                        .markAllNotificationsRead();
                                    ref.invalidate(notificationsProvider);
                                  },
                                  child: Container(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 10.w,
                                      vertical: 5.h,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? AppColors.primary.withValues(alpha: 0.18)
                                          : AppColors.primaryLight,
                                      borderRadius: BorderRadius.circular(8.r),
                                      border: Border.all(
                                        color: isDark
                                            ? AppColors.primary.withValues(alpha: 0.4)
                                            : AppColors.primary.withValues(alpha: 0.25),
                                      ),
                                    ),
                                    child: Text(
                                      'Mark all read',
                                      style: TextStyle(
                                        fontSize: 11.sp,
                                        color: isDark
                                            ? const Color(0xFF86EFAC)
                                            : AppColors.primary,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 6.w),
                                GestureDetector(
                                  onTap: _confirmClearAllNotifications,
                                  child: Container(
                                    padding: EdgeInsets.all(5.r),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? const Color(0xFFEF4444).withValues(alpha: 0.18)
                                          : const Color(0xFFFEE2E2),
                                      borderRadius: BorderRadius.circular(8.r),
                                      border: Border.all(
                                        color: isDark
                                            ? const Color(0xFFEF4444).withValues(alpha: 0.35)
                                            : const Color(0xFFFCA5A5).withValues(alpha: 0.6),
                                      ),
                                    ),
                                    child: Icon(
                                      Icons.delete_sweep_outlined,
                                      color: isDark
                                          ? const Color(0xFFF87171)
                                          : const Color(0xFFDC2626),
                                      size: 15.r,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                      SizedBox(height: 14.h),
                      // ── Notification List or Empty State ──────────
                      ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: 400.h),
                        child: notifs.isEmpty
                            ? Container(
                                width: double.infinity,
                                padding: EdgeInsets.symmetric(
                                  vertical: 40.h,
                                  horizontal: 20.w,
                                ),
                                decoration: BoxDecoration(
                                  color: isDark
                                      ? const Color(0xFF1E1E1E)
                                      : AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(14.r),
                                  border: Border.all(
                                    color: isDark
                                        ? const Color(0xFF2E2E2E)
                                        : AppColors.divider,
                                  ),
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      padding: EdgeInsets.all(14.r),
                                      decoration: BoxDecoration(
                                        color: isDark
                                            ? Colors.white.withValues(alpha: 0.08)
                                            : Colors.black.withValues(alpha: 0.05),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        Icons.notifications_off_rounded,
                                        color: isDark
                                            ? const Color(0xFF6E7681)
                                            : AppColors.textMuted,
                                        size: 28.r,
                                      ),
                                    ),
                                    SizedBox(height: 12.h),
                                    Text(
                                      "You're all caught up!",
                                      style: TextStyle(
                                        fontSize: 14.sp,
                                        fontWeight: FontWeight.w600,
                                        color: isDark
                                            ? Colors.white
                                            : AppColors.textPrimary,
                                      ),
                                    ),
                                    SizedBox(height: 4.h),
                                    Text(
                                      'No new notifications at this time.',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        color: isDark
                                            ? const Color(0xFF8B949E)
                                            : AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            : RawScrollbar(
                                controller: _modalNotifScrollCtrl,
                                thumbVisibility: true,
                                interactive: true,
                                thickness: 4.w,
                                radius: const Radius.circular(4),
                                thumbColor: isDark
                                    ? Colors.white.withValues(alpha: 0.28)
                                    : AppColors.textMuted.withValues(alpha: 0.4),
                                child: ListView.builder(
                                  controller: _modalNotifScrollCtrl,
                                  shrinkWrap: true,
                                  padding: EdgeInsets.only(right: 6.w),
                                  itemCount: notifs.length,
                                  itemBuilder: (ctx, i) {
                                  final item = notifs[i];
                                  return Container(
                                    margin: EdgeInsets.only(bottom: 8.h),
                                    decoration: BoxDecoration(
                                      color: item.isRead
                                          ? (isDark
                                              ? const Color(0xFF1F1F1F)
                                              : AppColors.surfaceMuted)
                                          : (isDark
                                              ? const Color(0xFF132219)
                                              : AppColors.primarySubtle),
                                      borderRadius: BorderRadius.circular(12.r),
                                      border: Border.all(
                                        color: item.isRead
                                            ? (isDark
                                                ? Colors.white.withValues(alpha: 0.08)
                                                : AppColors.divider)
                                            : (isDark
                                                ? AppColors.primary.withValues(alpha: 0.45)
                                                : AppColors.primary.withValues(alpha: 0.3)),
                                      ),
                                    ),
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(12.r),
                                        onTap: () => _openNotificationDetails(item),
                                        child: Padding(
                                          padding: EdgeInsets.all(14.r),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Container(
                                                width: 34.r,
                                                height: 34.r,
                                                decoration: BoxDecoration(
                                                  color: item.isRead
                                                      ? (isDark
                                                          ? Colors.white.withValues(alpha: 0.08)
                                                          : Colors.black.withValues(alpha: 0.04))
                                                      : (isDark
                                                          ? AppColors.primary.withValues(alpha: 0.25)
                                                          : AppColors.primaryLight),
                                                  borderRadius: BorderRadius.circular(10.r),
                                                ),
                                                child: Icon(
                                                  Icons.notifications_rounded,
                                                  color: item.isRead
                                                      ? (isDark
                                                          ? const Color(0xFF8B949E)
                                                          : AppColors.textMuted)
                                                      : (isDark
                                                          ? const Color(0xFF86EFAC)
                                                          : AppColors.primary),
                                                  size: 16.r,
                                                ),
                                              ),
                                              SizedBox(width: 12.w),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Expanded(
                                                          child: Text(
                                                            item.title,
                                                            style: TextStyle(
                                                              fontSize: 13.sp,
                                                              fontWeight: item.isRead
                                                                  ? FontWeight.w500
                                                                  : FontWeight.w700,
                                                              color: isDark
                                                                  ? Colors.white
                                                                  : AppColors.textPrimary,
                                                            ),
                                                          ),
                                                        ),
                                                        if (!item.isRead)
                                                          Container(
                                                            width: 7.r,
                                                            height: 7.r,
                                                            margin: EdgeInsets.only(left: 8.w),
                                                            decoration: BoxDecoration(
                                                              color: isDark
                                                                  ? const Color(0xFF4ADE80)
                                                                  : AppColors.primary,
                                                              shape: BoxShape.circle,
                                                            ),
                                                          ),
                                                      ],
                                                    ),
                                                    SizedBox(height: 4.h),
                                                    Text(
                                                      item.message,
                                                      style: TextStyle(
                                                        fontSize: 12.sp,
                                                        color: isDark
                                                            ? const Color(0xFF94A3B8)
                                                            : AppColors.textSecondary,
                                                        height: 1.35,
                                                      ),
                                                      maxLines: 2,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                    SizedBox(height: 6.h),
                                                    Row(
                                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                      children: [
                                                        Text(
                                                          item.timeAgo.isNotEmpty ? item.timeAgo : item.createdAt,
                                                          style: TextStyle(
                                                            fontSize: 10.5.sp,
                                                            color: isDark
                                                                ? const Color(0xFF64748B)
                                                                : AppColors.textMuted,
                                                          ),
                                                        ),
                                                        Row(
                                                          mainAxisSize: MainAxisSize.min,
                                                          children: [
                                                            GestureDetector(
                                                              onTap: () => _confirmDeleteNotification(item),
                                                              child: Padding(
                                                                padding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 2.h),
                                                                child: Row(
                                                                  mainAxisSize: MainAxisSize.min,
                                                                  children: [
                                                                    Icon(
                                                                      Icons.delete_outline_rounded,
                                                                      size: 13.r,
                                                                      color: isDark
                                                                          ? const Color(0xFFEF4444).withValues(alpha: 0.85)
                                                                          : const Color(0xFFDC2626),
                                                                    ),
                                                                    SizedBox(width: 2.w),
                                                                    Text(
                                                                      'Delete',
                                                                      style: TextStyle(
                                                                        fontSize: 10.5.sp,
                                                                        color: isDark
                                                                            ? const Color(0xFFEF4444).withValues(alpha: 0.85)
                                                                            : const Color(0xFFDC2626),
                                                                        fontWeight: FontWeight.w500,
                                                                      ),
                                                                    ),
                                                                  ],
                                                                ),
                                                              ),
                                                            ),
                                                            SizedBox(width: 8.w),
                                                            Row(
                                                              mainAxisSize: MainAxisSize.min,
                                                              children: [
                                                                Text(
                                                                  'View details',
                                                                  style: TextStyle(
                                                                    fontSize: 10.5.sp,
                                                                    color: isDark
                                                                        ? const Color(0xFF86EFAC)
                                                                        : AppColors.primary,
                                                                    fontWeight: FontWeight.w600,
                                                                  ),
                                                                ),
                                                                Icon(
                                                                  Icons.chevron_right_rounded,
                                                                  color: isDark
                                                                      ? const Color(0xFF86EFAC)
                                                                      : AppColors.primary,
                                                                  size: 14.r,
                                                                ),
                                                              ],
                                                            ),
                                                          ],
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                      ),
                    ],
                  ),
                ),

              // 2. Gate Logs Modal
              if (_activeModal == ResidentModalType.logs)
                _DashboardModalShell(
                  title: 'Gate Access Logs',
                  onClose: _closeModal,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _MiniStatPill(
                              label: 'Entries Today',
                              value: '${logs.where((l) => l.direction == 'IN').length}',
                              color: const Color(0xFF10B981),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: _MiniStatPill(
                              label: 'Exits Today',
                              value: '${logs.where((l) => l.direction == 'OUT').length}',
                              color: const Color(0xFF3B82F6),
                            ),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: _MiniStatPill(
                              label: 'Unauthorized',
                              value: '$unauthorizedCount',
                              color: const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 14.h),
                      ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: 380.h),
                        child: logs.isEmpty
                            ? Center(
                                child: Padding(
                                  padding: EdgeInsets.all(24.r),
                                  child: const Text('No gate logs found.'),
                                ),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                itemCount: logs.length,
                                itemBuilder: (ctx, i) {
                                  final item = logs[i];
                                  final isEntry = item.direction == 'IN';
                                  return Container(
                                    margin: EdgeInsets.only(bottom: 8.h),
                                    padding: EdgeInsets.all(12.r),
                                    decoration: BoxDecoration(
                                      color: const Color(0x1F27272A),
                                      borderRadius: BorderRadius.circular(10.r),
                                      border: Border.all(
                                        color: Colors.white.withAlpha(15),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: EdgeInsets.all(8.r),
                                          decoration: BoxDecoration(
                                            color: (isEntry
                                                    ? const Color(0xFF10B981)
                                                    : const Color(0xFF3B82F6))
                                                .withAlpha(30),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            isEntry
                                                ? Icons.arrow_downward_rounded
                                                : Icons.arrow_upward_rounded,
                                            color: isEntry
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFF3B82F6),
                                            size: 16.r,
                                          ),
                                        ),
                                        SizedBox(width: 12.w),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                isEntry ? 'Entry Log' : 'Exit Log',
                                                style: TextStyle(
                                                  fontSize: 13.sp,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                              SizedBox(height: 2.h),
                                              Text(
                                                _formatPhilippineDateTime(item.loggedAt),
                                                style: TextStyle(
                                                  fontSize: 11.sp,
                                                  color: const Color(0xFFA1A1AA),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (item.plateNumber != null)
                                          Text(
                                            item.plateNumber!,
                                            style: TextStyle(
                                              fontSize: 12.sp,
                                              fontFamily: 'monospace',
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),

              // 3. Guest Access Modal
              if (_activeModal == ResidentModalType.guest)
                _DashboardModalShell(
                  title: 'Guest Access Request',
                  onClose: _closeModal,
                  child: SingleChildScrollView(
                    child: Form(
                      key: _guestFormKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Host Info Box
                          Container(
                            padding: EdgeInsets.all(12.r),
                            decoration: BoxDecoration(
                              color: const Color(0x263B82F6),
                              borderRadius: BorderRadius.circular(10.r),
                              border: Border.all(
                                color: const Color(0xFF3B82F6).withAlpha(60),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.person_pin_rounded,
                                  color: const Color(0xFF60A5FA),
                                  size: 20.r,
                                ),
                                SizedBox(width: 10.w),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Host: ${user?.name ?? ""}',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    if (user?.plateNumber != null)
                                      Text(
                                        'Plate: ${user!.plateNumber!}',
                                        style: TextStyle(
                                          fontSize: 11.sp,
                                          color: const Color(0xFF93C5FD),
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          SizedBox(height: 14.h),

                          // Section: Guest List (Multiple Guests in One Ticket)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _ModalSectionHeading(
                                title: _guestEntries.length > 1
                                    ? 'Guests in Ticket (${_guestEntries.length})'
                                    : 'Guest Vehicle Owner',
                              ),
                              if (_guestEntries.length > 1)
                                Container(
                                  padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF7C3AED).withAlpha(40),
                                    borderRadius: BorderRadius.circular(12.r),
                                    border: Border.all(color: const Color(0xFF7C3AED).withAlpha(100)),
                                  ),
                                  child: Text(
                                    'Multi-Guest Ticket',
                                    style: TextStyle(
                                      fontSize: 10.sp,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFFC084FC),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          SizedBox(height: 8.h),

                          // Render Guest Cards
                          ..._guestEntries.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final guest = entry.value;
                            final isPrimary = idx == 0;

                            return Container(
                              margin: EdgeInsets.only(bottom: 12.h),
                              padding: EdgeInsets.all(12.r),
                              decoration: BoxDecoration(
                                color: isPrimary
                                    ? const Color(0x1A3B82F6)
                                    : const Color(0x1F27272A),
                                borderRadius: BorderRadius.circular(12.r),
                                border: Border.all(
                                  color: isPrimary
                                      ? const Color(0xFF3B82F6).withAlpha(60)
                                      : const Color(0x33A1A1AA),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Guest card header
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: EdgeInsets.all(5.r),
                                            decoration: BoxDecoration(
                                              color: (isPrimary
                                                      ? const Color(0xFF3B82F6)
                                                      : const Color(0xFF7C3AED))
                                                  .withAlpha(40),
                                              shape: BoxShape.circle,
                                            ),
                                            child: Icon(
                                              isPrimary
                                                  ? Icons.person_rounded
                                                  : Icons.person_add_rounded,
                                              size: 14.r,
                                              color: isPrimary
                                                  ? const Color(0xFF60A5FA)
                                                  : const Color(0xFFC084FC),
                                            ),
                                          ),
                                          SizedBox(width: 8.w),
                                          Text(
                                            isPrimary
                                                ? 'Guest #1 (Primary / Driver)'
                                                : 'Guest #${idx + 1}',
                                            style: TextStyle(
                                              fontSize: 12.5.sp,
                                              fontWeight: FontWeight.bold,
                                              color: isPrimary
                                                  ? const Color(0xFF93C5FD)
                                                  : Colors.white,
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (!isPrimary)
                                        InkWell(
                                          borderRadius: BorderRadius.circular(6.r),
                                          onTap: () {
                                            setState(() {
                                              guest.dispose();
                                              _guestEntries.removeAt(idx);
                                            });
                                          },
                                          child: Padding(
                                            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 3.h),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(
                                                  Icons.delete_outline_rounded,
                                                  size: 14.r,
                                                  color: const Color(0xFFEF4444),
                                                ),
                                                SizedBox(width: 3.w),
                                                Text(
                                                  'Remove',
                                                  style: TextStyle(
                                                    fontSize: 11.sp,
                                                    color: const Color(0xFFEF4444),
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  SizedBox(height: 10.h),

                                  _DarkModalInput(
                                    label: isPrimary ? 'Guest Name *' : 'Guest #${idx + 1} Name *',
                                    controller: guest.nameCtrl,
                                    hint: isPrimary ? 'Full name of visitor' : 'Full name of additional guest',
                                    required: true,
                                  ),
                                  SizedBox(height: 8.h),
                                  _DarkModalInput(
                                    label: isPrimary
                                        ? 'Guest Contact Number *'
                                        : 'Contact Number (Optional)',
                                    controller: guest.contactCtrl,
                                    hint: '09123456789',
                                    required: isPrimary,
                                    maxLength: 11,
                                    keyboardType: TextInputType.phone,
                                    inputFormatters: [
                                      FilteringTextInputFormatter.digitsOnly,
                                      LengthLimitingTextInputFormatter(11),
                                    ],
                                    validator: (v) {
                                      if (isPrimary && (v == null || v.trim().isEmpty)) {
                                        return 'Required';
                                      }
                                      if (v != null && v.trim().isNotEmpty && v.trim().length != 11) {
                                        return 'Contact number must be 11 digits';
                                      }
                                      return null;
                                    },
                                  ),
                                  SizedBox(height: 8.h),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _DarkModalInput(
                                          label: isPrimary
                                              ? 'Plate Number *'
                                              : 'Plate (Optional)',
                                          controller: guest.plateCtrl,
                                          hint: isPrimary ? 'e.g. ABC 1234' : 'Leave empty if same car',
                                          required: isPrimary,
                                          inputFormatters: [PlateInputFormatter()],
                                        ),
                                      ),
                                      SizedBox(width: 8.w),
                                      Expanded(
                                        child: _DarkModalInput(
                                          label: isPrimary
                                              ? 'Car Model *'
                                              : 'Car Model (Optional)',
                                          controller: guest.modelCtrl,
                                          hint: isPrimary ? 'Toyota Vios' : 'e.g. Vios / Same',
                                          required: isPrimary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          }),

                          // Button to add another guest to the same ticket
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                setState(() {
                                  _guestEntries.add(_GuestEntry());
                                });
                              },
                              icon: const Icon(
                                Icons.person_add_alt_1_rounded,
                                size: 17,
                                color: Color(0xFF60A5FA),
                              ),
                              label: Text(
                                '+ Add Another Guest to Ticket',
                                style: TextStyle(
                                  fontSize: 12.5.sp,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF93C5FD),
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(
                                  color: const Color(0xFF3B82F6).withAlpha(120),
                                  width: 1.2,
                                ),
                                padding: EdgeInsets.symmetric(vertical: 11.h),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10.r),
                                ),
                                backgroundColor: const Color(0xFF3B82F6).withAlpha(20),
                              ),
                            ),
                          ),
                          SizedBox(height: 14.h),

                          _ModalSectionHeading(title: 'Access Details & Pass Validity'),
                          SizedBox(height: 4.h),
                          Text(
                            'Guards issue 1-day passes by default. As a resident, you can authorize and extend visits for 1 day, 1 month, or up to 1 year.',
                            style: TextStyle(
                              fontSize: 11.sp,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                          SizedBox(height: 10.h),

                          // Quick Duration Presets (1 Day, 1 Week, 1 Month, 6 Months, 1 Year, Custom)
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _buildDurationChip('1 Day', '1_day', Icons.today_rounded),
                                SizedBox(width: 6.w),
                                _buildDurationChip('1 Week', '1_week', Icons.date_range_rounded),
                                SizedBox(width: 6.w),
                                _buildDurationChip('1 Month', '1_month', Icons.calendar_month_rounded),
                                SizedBox(width: 6.w),
                                _buildDurationChip('6 Months', '6_months', Icons.event_repeat_rounded),
                                SizedBox(width: 6.w),
                                _buildDurationChip('1 Year', '1_year', Icons.verified_user_rounded),
                                SizedBox(width: 6.w),
                                _buildDurationChip('Custom', 'custom', Icons.edit_calendar_rounded),
                              ],
                            ),
                          ),
                          SizedBox(height: 10.h),

                          // Validity Summary Card
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 9.h),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withAlpha(18),
                              borderRadius: BorderRadius.circular(10.r),
                              border: Border.all(color: const Color(0xFF10B981).withAlpha(70)),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.verified_rounded,
                                  size: 16.r,
                                  color: const Color(0xFF34D399),
                                ),
                                SizedBox(width: 8.w),
                                Expanded(
                                  child: Text(
                                    'Gate Pass Active: ${_guestDateCtrl.text.isNotEmpty ? _guestDateCtrl.text : "Today"} ${_guestTimeCtrl.text} → ${_guestEndDateCtrl.text.isNotEmpty ? _guestEndDateCtrl.text : (_guestDateCtrl.text.isNotEmpty ? _guestDateCtrl.text : "Today")} ${_guestEndTimeCtrl.text}',
                                    style: TextStyle(
                                      fontSize: 11.sp,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF6EE7B7),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(height: 12.h),

                          // Start Date & Time
                          Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: _DarkModalInput(
                                  label: 'Visit Start Date *',
                                  controller: _guestDateCtrl,
                                  hint: 'Start date',
                                  required: true,
                                  readOnly: true,
                                  onTap: _pickGuestDate,
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.calendar_month_rounded,
                                      size: 18.r,
                                      color: const Color(0xFF93C5FD),
                                    ),
                                    onPressed: _pickGuestDate,
                                  ),
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Expanded(
                                flex: 2,
                                child: _DarkModalInput(
                                  label: 'Start Time *',
                                  controller: _guestTimeCtrl,
                                  hint: '08:00 AM',
                                  required: true,
                                  readOnly: true,
                                  onTap: _pickGuestTime,
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.access_time_rounded,
                                      size: 18.r,
                                      color: const Color(0xFF93C5FD),
                                    ),
                                    onPressed: _pickGuestTime,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 8.h),

                          // Valid Until Date & Time
                          Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: _DarkModalInput(
                                  label: 'Valid Until Date *',
                                  controller: _guestEndDateCtrl,
                                  hint: 'End date',
                                  required: true,
                                  readOnly: true,
                                  onTap: _pickGuestEndDate,
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.event_available_rounded,
                                      size: 18.r,
                                      color: const Color(0xFF34D399),
                                    ),
                                    onPressed: _pickGuestEndDate,
                                  ),
                                ),
                              ),
                              SizedBox(width: 8.w),
                              Expanded(
                                flex: 2,
                                child: _DarkModalInput(
                                  label: 'End Time *',
                                  controller: _guestEndTimeCtrl,
                                  hint: '11:59 PM',
                                  required: true,
                                  readOnly: true,
                                  onTap: _pickGuestEndTime,
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      Icons.access_time_filled_rounded,
                                      size: 18.r,
                                      color: const Color(0xFF34D399),
                                    ),
                                    onPressed: _pickGuestEndTime,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 8.h),

                          _DarkModalInput(
                            label: 'Reason for Access *',
                            controller: _guestReasonCtrl,
                            hint: 'Family visit, staying for 1 month, contractor, delivery, etc.',
                            required: true,
                          ),
                          SizedBox(height: 18.h),

                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: _isSubmittingGuest ? null : _submitGuestAccess,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF7C3AED),
                                foregroundColor: Colors.white,
                                padding: EdgeInsets.symmetric(vertical: 13.h),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24.r),
                                ),
                              ),
                              child: _isSubmittingGuest
                                  ? SizedBox(
                                      height: 18.r,
                                      width: 18.r,
                                      child: const CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : Text(
                                      _guestEntries.length > 1
                                          ? 'Submit Ticket for ${_guestEntries.length} Guests'
                                          : 'Submit Guest Access Request',
                                      style: TextStyle(
                                        fontSize: 13.sp,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),

                          if (requests.isNotEmpty) ...[
                            SizedBox(height: 20.h),
                            _ModalSectionHeading(title: 'Past Guest Requests'),
                            SizedBox(height: 8.h),
                            ...requests.take(3).map((req) {
                              final isApproved = req.isApproved;
                              final isRejected = req.isRejected;
                              return Container(
                                margin: EdgeInsets.only(bottom: 6.h),
                                padding: EdgeInsets.all(10.r),
                                decoration: BoxDecoration(
                                  color: const Color(0x1F27272A),
                                  borderRadius: BorderRadius.circular(8.r),
                                ),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Request #${req.id}',
                                      style: TextStyle(
                                        fontSize: 12.sp,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Container(
                                      padding: EdgeInsets.symmetric(
                                        horizontal: 8.w,
                                        vertical: 2.h,
                                      ),
                                      decoration: BoxDecoration(
                                        color: (isApproved
                                                ? const Color(0xFF10B981)
                                                : isRejected
                                                    ? const Color(0xFFEF4444)
                                                    : const Color(0xFFF59E0B))
                                            .withAlpha(40),
                                        borderRadius:
                                            BorderRadius.circular(12.r),
                                      ),
                                      child: Text(
                                        req.status.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 10.sp,
                                          fontWeight: FontWeight.bold,
                                          color: isApproved
                                              ? const Color(0xFF10B981)
                                              : isRejected
                                                  ? const Color(0xFFEF4444)
                                                  : const Color(0xFFF59E0B),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),

              // 4. User Profile Modal
              if (_activeModal == ResidentModalType.profile)
                _DashboardModalShell(
                  title: 'My Profile',
                  onClose: _closeModal,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        user?.name ?? '',
                        style: TextStyle(
                          fontSize: 18.sp,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 4.h),
                      Text(
                        user?.email ?? '',
                        style: TextStyle(
                          fontSize: 12.sp,
                          color: const Color(0xFFA1A1AA),
                        ),
                      ),
                      SizedBox(height: 16.h),
                      Container(
                        padding: EdgeInsets.all(12.r),
                        decoration: BoxDecoration(
                          color: const Color(0x1F27272A),
                          borderRadius: BorderRadius.circular(12.r),
                          border: Border.all(
                            color: Colors.white.withAlpha(20),
                          ),
                        ),
                        child: Column(
                          children: [
                            _ProfileModalRow(
                              label: 'Account ID',
                              value: '#${user?.id ?? 0}',
                            ),
                            if (user?.plateNumber != null)
                              _ProfileModalRow(
                                label: 'Vehicle Plate',
                                value: user!.plateNumber!,
                              ),
                            if (user?.contactNumber != null)
                              _ProfileModalRow(
                                label: 'Contact Number',
                                value: user!.contactNumber!,
                              ),
                            if (user?.createdAt != null)
                              _ProfileModalRow(
                                label: 'Registered Date & Time',
                                value: _formatDate(user!.createdAt!),
                              ),
                            _ProfileModalRow(
                              label: 'Role',
                              value: 'Resident Member',
                            ),
                            _ProfileModalRow(
                              label: 'Access Status',
                              value: 'Active',
                              valueColor: const Color(0xFF10B981),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components matching Client Resident Dashboard design
// ─────────────────────────────────────────────────────────────────────────────

class _SummaryCardTile extends StatelessWidget {
  final String title;
  final String value;
  final String? subText;
  final String? badge;
  final Color badgeColor;
  final Color? badgeBgColor;
  final IconData icon;
  final Color iconColor;
  final Color? iconBgColor;

  const _SummaryCardTile({
    required this.title,
    required this.value,
    this.subText,
    this.badge,
    required this.badgeColor,
    this.badgeBgColor,
    required this.icon,
    required this.iconColor,
    this.iconBgColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 14.h),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18.r),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: isDark ? 0.25 : 0.6),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 11.5.sp,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: EdgeInsets.all(5.r),
                decoration: BoxDecoration(
                  color: iconBgColor ?? iconColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 15.r),
              ),
            ],
          ),
          SizedBox(height: 8.h),
          Text(
            value,
            style: TextStyle(
              fontSize: 13.5.sp,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.2,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          if (subText != null) ...[
            SizedBox(height: 2.h),
            Text(
              subText!,
              style: TextStyle(
                fontSize: 10.5.sp,
                color: AppColors.textSecondary,
              ),
            ),
          ],
          if (badge != null) ...[
            SizedBox(height: 6.h),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
              decoration: BoxDecoration(
                color: badgeBgColor ?? badgeColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Text(
                badge!,
                style: TextStyle(
                  fontSize: 9.5.sp,
                  fontWeight: FontWeight.bold,
                  color: badgeColor,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuickLinkAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String sub;
  final Color color;
  final VoidCallback onTap;

  const _QuickLinkAction({
    required this.icon,
    required this.title,
    required this.sub,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(14.r),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(18.r),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
          border: Border.all(
            color: Theme.of(context).dividerColor.withValues(alpha: isDark ? 0.25 : 0.6),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(10.r),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14.r),
              ),
              child: Icon(icon, color: color, size: 22.r),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13.sp,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 2.h),
                  Text(
                    sub,
                    style: TextStyle(
                      fontSize: 11.sp,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardModalShell extends StatefulWidget {
  final String title;
  final VoidCallback onClose;
  final Widget child;

  const _DashboardModalShell({
    required this.title,
    required this.onClose,
    required this.child,
  });

  @override
  State<_DashboardModalShell> createState() => _DashboardModalShellState();
}

class _DashboardModalShellState extends State<_DashboardModalShell>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _scaleAnim = Tween<double>(begin: 0.92, end: 1.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Cubic(0.34, 1.56, 0.64, 1),
      ),
    );
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  void _handleClose() async {
    await _animCtrl.reverse();
    if (mounted) widget.onClose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Positioned.fill(
      child: Stack(
        children: [
          // Dark backdrop filter
          Positioned.fill(
            child: GestureDetector(
              onTap: _handleClose,
              child: FadeTransition(
                opacity: _fadeAnim,
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                  child: Container(
                    color: Colors.black.withValues(alpha: isDark ? 0.7 : 0.45),
                  ),
                ),
              ),
            ),
          ),
          // Modal Dialog Card
          SafeArea(
            child: Center(
              child: Padding(
                padding: EdgeInsets.all(20.r),
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: ScaleTransition(
                    scale: _scaleAnim,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24.r),
                      child: Container(
                        padding: EdgeInsets.all(20.r),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF171717) : Colors.white,
                          borderRadius: BorderRadius.circular(24.r),
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFF262626)
                                : AppColors.divider,
                            width: 1,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: isDark
                                  ? Colors.black.withValues(alpha: 0.8)
                                  : Colors.black.withValues(alpha: 0.12),
                              blurRadius: 32,
                              offset: const Offset(0, 16),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  widget.title,
                                  style: TextStyle(
                                    fontSize: 18.sp,
                                    fontWeight: FontWeight.bold,
                                    color: isDark
                                        ? Colors.white
                                        : AppColors.textPrimary,
                                  ),
                                ),
                                GestureDetector(
                                  onTap: _handleClose,
                                  child: Container(
                                    padding: EdgeInsets.all(5.r),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? Colors.white.withValues(alpha: 0.1)
                                          : AppColors.surfaceMuted,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      Icons.close_rounded,
                                      color: isDark
                                          ? Colors.white70
                                          : AppColors.textSecondary,
                                      size: 18.r,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            Divider(
                              color: isDark
                                  ? const Color(0xFF262626)
                                  : AppColors.divider,
                              height: 24.h,
                            ),
                            Flexible(child: widget.child),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStatPill extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStatPill({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: EdgeInsets.symmetric(vertical: 8.h, horizontal: 8.w),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(color: color.withValues(alpha: isDark ? 0.35 : 0.2)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16.sp,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 9.5.sp,
              color: isDark ? Colors.white70 : AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ModalSectionHeading extends StatelessWidget {
  final String title;
  const _ModalSectionHeading({required this.title});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      title,
      style: TextStyle(
        fontSize: 12.sp,
        fontWeight: FontWeight.bold,
        color: isDark ? const Color(0xFF86EFAC) : AppColors.primary,
        letterSpacing: 0.3,
      ),
    );
  }
}

class _DarkModalInput extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String hint;
  final bool required;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final bool readOnly;
  final VoidCallback? onTap;
  final Widget? suffixIcon;

  const _DarkModalInput({
    required this.label,
    required this.controller,
    required this.hint,
    this.required = false,
    this.maxLength,
    this.inputFormatters,
    this.keyboardType,
    this.validator,
    this.readOnly = false,
    this.onTap,
    this.suffixIcon,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 11.5.sp,
            color: isDark ? const Color(0xFFA1A1AA) : AppColors.textSecondary,
          ),
        ),
        SizedBox(height: 4.h),
        TextFormField(
          controller: controller,
          readOnly: readOnly,
          onTap: onTap,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          maxLength: maxLength,
          buildCounter: maxLength != null
              ? (context, {required currentLength, required isFocused, required maxLength}) => null
              : null,
          validator: validator ?? (required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null),
          style: TextStyle(
            fontSize: 13.sp,
            color: isDark ? Colors.white : AppColors.textPrimary,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              fontSize: 12.sp,
              color: isDark ? Colors.white30 : AppColors.textMuted,
            ),
            filled: true,
            fillColor: isDark ? const Color(0xFF222222) : AppColors.surfaceMuted,
            suffixIcon: suffixIcon,
            contentPadding: EdgeInsets.symmetric(
              horizontal: 12.w,
              vertical: 10.h,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: BorderSide(
                color: isDark ? Colors.white.withValues(alpha: 0.1) : AppColors.divider,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: BorderSide(
                color: isDark ? Colors.white.withValues(alpha: 0.1) : AppColors.divider,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r),
              borderSide: BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileModalRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _ProfileModalRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 6.h),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12.sp,
              color: isDark ? const Color(0xFFA1A1AA) : AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12.5.sp,
              fontWeight: FontWeight.bold,
              color: valueColor ?? (isDark ? Colors.white : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _GuestEntry {
  final TextEditingController nameCtrl;
  final TextEditingController contactCtrl;
  final TextEditingController plateCtrl;
  final TextEditingController modelCtrl;

  _GuestEntry({
    TextEditingController? nameCtrl,
    TextEditingController? contactCtrl,
    TextEditingController? plateCtrl,
    TextEditingController? modelCtrl,
  })  : nameCtrl = nameCtrl ?? TextEditingController(),
        contactCtrl = contactCtrl ?? TextEditingController(),
        plateCtrl = plateCtrl ?? TextEditingController(),
        modelCtrl = modelCtrl ?? TextEditingController();

  void dispose() {
    nameCtrl.dispose();
    contactCtrl.dispose();
    plateCtrl.dispose();
    modelCtrl.dispose();
  }
}

