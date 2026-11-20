import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/notification_model.dart';
import '../../providers/resident_provider.dart';

/// Reusable Notification Detail Modal
/// Displays comprehensive notification details, metadata fields, type badges,
/// full message text, formatted timestamps, and a delete (trash) action button.
class NotificationDetailDialog extends ConsumerStatefulWidget {
  final NotificationModel notification;
  final VoidCallback? onMarkedRead;
  final VoidCallback? onDeleted;

  const NotificationDetailDialog({
    super.key,
    required this.notification,
    this.onMarkedRead,
    this.onDeleted,
  });

  /// Open the notification detail modal
  static Future<void> show(
    BuildContext context, {
    required NotificationModel notification,
    VoidCallback? onMarkedRead,
    VoidCallback? onDeleted,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (ctx) => NotificationDetailDialog(
        notification: notification,
        onMarkedRead: onMarkedRead,
        onDeleted: onDeleted,
      ),
    );
  }

  @override
  ConsumerState<NotificationDetailDialog> createState() =>
      _NotificationDetailDialogState();
}

class _NotificationDetailDialogState
    extends ConsumerState<NotificationDetailDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  final ScrollController _scrollController = ScrollController();
  bool _isClosing = false;
  bool _isDeleting = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );

    _scaleAnim = Tween<double>(begin: 0.92, end: 1.0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Cubic(0.34, 1.56, 0.64, 1.0),
      ),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOut);

    _animController.forward();

    // If notification is unread, automatically mark as read
    if (!widget.notification.isRead) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          await ref
              .read(residentServiceProvider)
              .markNotificationRead(widget.notification.id);
          if (!mounted || _isClosing || _isDeleting) return;
          ref.invalidate(notificationsProvider);
          widget.onMarkedRead?.call();
        } catch (_) {}
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _handleClose() async {
    if (_isClosing) return;
    _isClosing = true;
    try {
      await _animController.reverse();
    } catch (_) {}
    if (mounted) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }

  Future<void> _confirmAndDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (ctx) {
        final isDarkCtx = Theme.of(ctx).brightness == Brightness.dark;
        return Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          child: Container(
            width: 320.w,
            padding: EdgeInsets.all(22.r),
            decoration: BoxDecoration(
              color: Theme.of(ctx).cardColor,
              borderRadius: BorderRadius.circular(24.r),
              border: Border.all(
                color: isDarkCtx
                    ? Colors.white.withValues(alpha: 0.1)
                    : Theme.of(ctx).dividerColor.withValues(alpha: 0.5),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 28,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 50.r,
                  height: 50.r,
                  decoration: BoxDecoration(
                    color: isDarkCtx
                        ? const Color(0xFFEF4444).withValues(alpha: 0.16)
                        : const Color(0xFFFEE2E2),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDarkCtx
                          ? const Color(0xFFEF4444).withValues(alpha: 0.4)
                          : const Color(0xFFFCA5A5).withValues(alpha: 0.5),
                    ),
                  ),
                  child: Icon(
                    Icons.delete_outline_rounded,
                    color: isDarkCtx
                        ? const Color(0xFFF87171)
                        : const Color(0xFFDC2626),
                    size: 26.r,
                  ),
                ),
                SizedBox(height: 16.h),
                Text(
                  'Delete Notification?',
                  style: TextStyle(
                    color: Theme.of(ctx).colorScheme.onSurface,
                    fontSize: 17.sp,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                ),
                SizedBox(height: 8.h),
                Text(
                  'This notification will be permanently removed from your list.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDarkCtx
                        ? const Color(0xFF94A3B8)
                        : AppColors.textSecondary,
                    fontSize: 13.sp,
                    height: 1.45,
                  ),
                ),
                SizedBox(height: 22.h),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            color: isDarkCtx
                                ? Colors.white.withValues(alpha: 0.15)
                                : Theme.of(ctx).dividerColor,
                          ),
                          padding: EdgeInsets.symmetric(vertical: 12.h),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24.r),
                          ),
                        ),
                        child: Text(
                          'Cancel',
                          style: TextStyle(
                            color: isDarkCtx
                                ? const Color(0xFF94A3B8)
                                : AppColors.textSecondary,
                            fontSize: 13.sp,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(ctx).pop(true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: EdgeInsets.symmetric(vertical: 12.h),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24.r),
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
        );
      },
    );

    if (confirmed == true && mounted) {
      setState(() => _isDeleting = true);
      final rootNav = Navigator.of(context, rootNavigator: true);
      try {
        final success = await ref
            .read(residentServiceProvider)
            .deleteNotification(widget.notification.id);

        if (mounted) {
          if (success) {
            ref.invalidate(notificationsProvider);
            widget.onDeleted?.call();
            await _handleClose();
            if (rootNav.context.mounted) {
              ToastHelper.showSuccess(rootNav.context, 'Notification deleted');
            }
          } else {
            ToastHelper.showError(context, 'Failed to delete notification');
            setState(() => _isDeleting = false);
          }
        }
      } catch (_) {
        if (mounted) {
          ToastHelper.showError(context, 'Error deleting notification');
          setState(() => _isDeleting = false);
        }
      }
    }
  }

  _NotificationTypeMeta _getTypeMeta(String type, String title, String message) {
    final lowerType = type.toLowerCase();
    final lowerTitle = title.toLowerCase();
    final lowerMsg = message.toLowerCase();

    if (lowerType.contains('visitor') ||
        lowerTitle.contains('visitor') ||
        lowerMsg.contains('visitor') ||
        lowerTitle.contains('guest')) {
      return _NotificationTypeMeta(
        label: 'VISITOR PASS',
        icon: Icons.badge_rounded,
        color: const Color(0xFF3B82F6),
        bgColor: const Color(0xFF3B82F6).withValues(alpha: 0.15),
      );
    }

    if (lowerType.contains('gate') ||
        lowerTitle.contains('gate') ||
        lowerTitle.contains('entry') ||
        lowerTitle.contains('exit')) {
      return _NotificationTypeMeta(
        label: 'GATE ACCESS',
        icon: Icons.sensor_door_rounded,
        color: const Color(0xFF10B981),
        bgColor: const Color(0xFF10B981).withValues(alpha: 0.15),
      );
    }

    if (lowerType.contains('security') ||
        lowerTitle.contains('security') ||
        lowerTitle.contains('unauthorized') ||
        lowerTitle.contains('guard')) {
      return _NotificationTypeMeta(
        label: 'SECURITY ALERT',
        icon: Icons.shield_rounded,
        color: const Color(0xFF8B5CF6),
        bgColor: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
      );
    }

    if (lowerType.contains('emergency') ||
        lowerTitle.contains('emergency') ||
        lowerTitle.contains('urgent') ||
        lowerTitle.contains('danger')) {
      return _NotificationTypeMeta(
        label: 'EMERGENCY',
        icon: Icons.warning_amber_rounded,
        color: const Color(0xFFEF4444),
        bgColor: const Color(0xFFEF4444).withValues(alpha: 0.15),
      );
    }

    if (lowerTitle.contains('approved') || lowerMsg.contains('approved')) {
      return _NotificationTypeMeta(
        label: 'APPROVAL',
        icon: Icons.check_circle_outline_rounded,
        color: const Color(0xFF22C55E),
        bgColor: const Color(0xFF22C55E).withValues(alpha: 0.15),
      );
    }

    if (lowerTitle.contains('rejected') ||
        lowerTitle.contains('denied') ||
        lowerMsg.contains('rejected')) {
      return _NotificationTypeMeta(
        label: 'REJECTED',
        icon: Icons.cancel_outlined,
        color: const Color(0xFFF87171),
        bgColor: const Color(0xFFF87171).withValues(alpha: 0.15),
      );
    }

    return _NotificationTypeMeta(
      label: 'SYSTEM NOTICE',
      icon: Icons.notifications_active_rounded,
      color: const Color(0xFF38BDF8),
      bgColor: const Color(0xFF38BDF8).withValues(alpha: 0.15),
    );
  }

  IconData _getFieldIcon(String iconKey) {
    switch (iconKey) {
      case 'tag':
        return Icons.tag_rounded;
      case 'category':
        return Icons.category_rounded;
      case 'status':
        return Icons.info_outline_rounded;
      case 'time':
        return Icons.access_time_rounded;
      case 'clock':
        return Icons.schedule_rounded;
      case 'calendar':
        return Icons.calendar_today_rounded;
      case 'person':
        return Icons.person_rounded;
      case 'car':
        return Icons.directions_car_rounded;
      case 'phone':
        return Icons.phone_rounded;
      case 'business':
        return Icons.business_rounded;
      case 'notes':
        return Icons.notes_rounded;
      case 'email':
        return Icons.email_rounded;
      case 'badge':
        return Icons.badge_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final notif = widget.notification;
    final meta = _getTypeMeta(notif.type, notif.title, notif.message);
    final fields = notif.extractedFields;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleClose();
      },
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Center(
          child: AnimatedBuilder(
            animation: _animController,
            builder: (context, child) {
              return FadeTransition(
                opacity: _fadeAnim,
                child: ScaleTransition(
                  scale: _scaleAnim,
                  child: child,
                ),
              );
            },
            child: Dialog(
              backgroundColor: Colors.transparent,
              elevation: 0,
              insetPadding: EdgeInsets.symmetric(horizontal: 18.w, vertical: 20.h),
              child: Container(
                constraints: BoxConstraints(
                  maxWidth: 440.w,
                  maxHeight: 680.h,
                ),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(24.r),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.1)
                        : Theme.of(context).dividerColor.withValues(alpha: 0.5),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.08),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Header Bar ─────────────────────────────────────────
                    Padding(
                      padding: EdgeInsets.fromLTRB(18.w, 16.h, 18.w, 14.h),
                      child: Row(
                        children: [
                          Container(
                            width: 40.r,
                            height: 40.r,
                            decoration: BoxDecoration(
                              color: meta.bgColor,
                              borderRadius: BorderRadius.circular(12.r),
                              border: Border.all(
                                color: meta.color.withValues(alpha: 0.4),
                              ),
                            ),
                            child: Icon(
                              meta.icon,
                              color: meta.color,
                              size: 22.r,
                            ),
                          ),
                          SizedBox(width: 12.w),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Notification Details',
                                  style: TextStyle(
                                    fontSize: 16.sp,
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(context).colorScheme.onSurface,
                                    letterSpacing: -0.3,
                                  ),
                                ),
                                SizedBox(height: 2.h),
                                Text(
                                  '${notif.categoryDisplayName} • Gate System',
                                  style: TextStyle(
                                    fontSize: 11.5.sp,
                                    color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    Divider(
                      height: 1,
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Theme.of(context).dividerColor.withValues(alpha: 0.6),
                    ),

                    // ── Scrollable Body ────────────────────────────────────
                    Flexible(
                      child: RawScrollbar(
                        controller: _scrollController,
                        thumbVisibility: true,
                        interactive: true,
                        thickness: 4.w,
                        radius: const Radius.circular(4),
                        thumbColor: isDark
                            ? Colors.white.withValues(alpha: 0.2)
                            : Theme.of(context).dividerColor.withValues(alpha: 0.6),
                        child: SingleChildScrollView(
                          controller: _scrollController,
                          padding: EdgeInsets.symmetric(horizontal: 18.w, vertical: 16.h),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ── Meta Tags Row (Type, Read Status, Relative Time) ──
                            Wrap(
                              spacing: 8.w,
                              runSpacing: 6.h,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                // Category Pill
                                Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: 10.w,
                                    vertical: 4.5.h,
                                  ),
                                  decoration: BoxDecoration(
                                    color: meta.bgColor,
                                    borderRadius: BorderRadius.circular(8.r),
                                    border: Border.all(
                                      color: meta.color.withValues(alpha: 0.35),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 6.r,
                                        height: 6.r,
                                        decoration: BoxDecoration(
                                          color: meta.color,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      SizedBox(width: 5.w),
                                      Text(
                                        meta.label,
                                        style: TextStyle(
                                          fontSize: 10.5.sp,
                                          fontWeight: FontWeight.w700,
                                          color: meta.color,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Status Pill
                                Container(
                                  padding: EdgeInsets.symmetric(
                                    horizontal: 9.w,
                                    vertical: 4.5.h,
                                  ),
                                  decoration: BoxDecoration(
                                    color: notif.isRead
                                        ? const Color(0xFF10B981).withValues(alpha: 0.12)
                                        : const Color(0xFF3B82F6).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8.r),
                                    border: Border.all(
                                      color: notif.isRead
                                          ? const Color(0xFF10B981).withValues(alpha: 0.3)
                                          : const Color(0xFF3B82F6).withValues(alpha: 0.35),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        notif.isRead
                                            ? Icons.check_circle_outline_rounded
                                            : Icons.fiber_manual_record_rounded,
                                        color: notif.isRead
                                            ? const Color(0xFF10B981)
                                            : const Color(0xFF3B82F6),
                                        size: 11.r,
                                      ),
                                      SizedBox(width: 4.w),
                                      Text(
                                        notif.isRead ? 'READ' : 'NEW / UNREAD',
                                        style: TextStyle(
                                          fontSize: 10.5.sp,
                                          color: notif.isRead
                                              ? (isDark ? const Color(0xFF34D399) : const Color(0xFF10B981))
                                              : const Color(0xFF60A5FA),
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Relative Time Pill
                                if (notif.timeAgo.isNotEmpty)
                                  Container(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 9.w,
                                      vertical: 4.5.h,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isDark
                                          ? Colors.white.withValues(alpha: 0.08)
                                          : AppColors.surfaceMuted,
                                      borderRadius: BorderRadius.circular(8.r),
                                      border: Border.all(
                                        color: isDark
                                            ? Colors.white.withValues(alpha: 0.12)
                                            : Theme.of(context).dividerColor.withValues(alpha: 0.5),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.schedule_rounded,
                                          color: isDark
                                              ? const Color(0xFFCBD5E1)
                                              : AppColors.textSecondary,
                                          size: 11.r,
                                        ),
                                        SizedBox(width: 4.w),
                                        Text(
                                          notif.timeAgo,
                                          style: TextStyle(
                                            fontSize: 10.5.sp,
                                            color: isDark
                                                ? const Color(0xFFCBD5E1)
                                                : AppColors.textSecondary,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),

                            SizedBox(height: 16.h),

                            // ── Subject Section ────────────────────────────
                            Text(
                              'SUBJECT / TITLE',
                              style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.w700,
                                color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
                                letterSpacing: 0.6,
                              ),
                            ),
                            SizedBox(height: 5.h),
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF222222) : AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(12.r),
                                border: Border.all(
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.1)
                                      : Theme.of(context).dividerColor.withValues(alpha: 0.5),
                                ),
                              ),
                              child: Text(
                                notif.title.isNotEmpty ? notif.title : 'System Notification',
                                style: TextStyle(
                                  fontSize: 14.5.sp,
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).colorScheme.onSurface,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),

                            SizedBox(height: 16.h),

                            // ── Extracted All Details Section ──────────────
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'NOTIFICATION BREAKDOWN & DETAILS',
                                  style: TextStyle(
                                    fontSize: 10.sp,
                                    fontWeight: FontWeight.w700,
                                    color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                Text(
                                  '${fields.length} details',
                                  style: TextStyle(
                                    fontSize: 10.sp,
                                    color: isDark ? const Color(0xFF64748B) : AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 6.h),
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.all(12.r),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF222222) : AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(12.r),
                                border: Border.all(
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.1)
                                      : Theme.of(context).dividerColor.withValues(alpha: 0.5),
                                ),
                              ),
                              child: Column(
                                children: [
                                  for (int i = 0; i < fields.length; i++) ...[
                                    _buildDetailRow(fields[i]),
                                    if (i < fields.length - 1)
                                      Padding(
                                        padding: EdgeInsets.symmetric(vertical: 8.h),
                                        child: Divider(
                                          height: 1,
                                          color: isDark
                                              ? Colors.white.withValues(alpha: 0.08)
                                              : Theme.of(context).dividerColor.withValues(alpha: 0.5),
                                        ),
                                      ),
                                  ],
                                ],
                              ),
                            ),

                            SizedBox(height: 16.h),

                            // ── Message Content Section ────────────────────
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'FULL NOTIFICATION MESSAGE',
                                  style: TextStyle(
                                    fontSize: 10.sp,
                                    fontWeight: FontWeight.w700,
                                    color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () {
                                    Clipboard.setData(ClipboardData(text: notif.message));
                                    ToastHelper.showSuccess(
                                      context,
                                      'Message copied to clipboard',
                                    );
                                  },
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.copy_rounded,
                                        size: 13.r,
                                        color: isDark ? const Color(0xFF4ADE80) : AppColors.primary,
                                      ),
                                      SizedBox(width: 4.w),
                                      Text(
                                        'Copy',
                                        style: TextStyle(
                                          fontSize: 11.sp,
                                          color: isDark ? const Color(0xFF4ADE80) : AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 6.h),
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.all(14.r),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF222222) : AppColors.surfaceMuted,
                                borderRadius: BorderRadius.circular(12.r),
                                border: Border.all(
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.1)
                                      : Theme.of(context).dividerColor.withValues(alpha: 0.5),
                                ),
                              ),
                              child: SelectableText(
                                notif.message.isNotEmpty
                                    ? notif.message
                                    : 'No additional message text provided.',
                                style: TextStyle(
                                  fontSize: 13.5.sp,
                                  color: isDark ? const Color(0xFFE2E8F0) : Theme.of(context).colorScheme.onSurface,
                                  height: 1.5,
                                  letterSpacing: 0.1,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    ),

                    Divider(
                      height: 1,
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.08)
                          : Theme.of(context).dividerColor.withValues(alpha: 0.6),
                    ),

                    // ── Bottom Action Footer (Trash Delete Button & Close) ──
                    Padding(
                      padding: EdgeInsets.fromLTRB(18.w, 14.h, 18.w, 16.h),
                      child: Row(
                        children: [
                          // Red Trash / Delete Button
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isDeleting ? null : _confirmAndDelete,
                              icon: _isDeleting
                                  ? SizedBox(
                                      width: 14.r,
                                      height: 14.r,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: isDark
                                            ? const Color(0xFFF87171)
                                            : const Color(0xFFDC2626),
                                      ),
                                    )
                                  : Icon(
                                      Icons.delete_outline_rounded,
                                      size: 17.r,
                                      color: isDark
                                          ? const Color(0xFFF87171)
                                          : const Color(0xFFDC2626),
                                    ),
                              label: Text(
                                _isDeleting ? 'Deleting...' : 'Delete',
                                style: TextStyle(
                                  fontSize: 13.sp,
                                  fontWeight: FontWeight.w600,
                                  color: isDark
                                      ? const Color(0xFFF87171)
                                      : const Color(0xFFDC2626),
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(
                                  color: isDark
                                      ? const Color(0xFFEF4444).withValues(alpha: 0.4)
                                      : const Color(0xFFFCA5A5).withValues(alpha: 0.8),
                                ),
                                backgroundColor: isDark
                                    ? const Color(0xFFEF4444).withValues(alpha: 0.16)
                                    : const Color(0xFFFEE2E2),
                                padding: EdgeInsets.symmetric(vertical: 12.h),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24.r),
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: 12.w),
                          // Close button
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _handleClose,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isDark ? const Color(0xFF16A34A) : AppColors.primary,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: EdgeInsets.symmetric(vertical: 12.h),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(24.r),
                                ),
                              ),
                              child: Text(
                                'Close',
                                style: TextStyle(
                                  fontSize: 13.5.sp,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(NotificationDetailField field) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isPlate = field.label.toLowerCase().contains('plate');
    final isStatus = field.label.toLowerCase().contains('status');

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 26.r,
          height: 26.r,
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(7.r),
          ),
          child: Icon(
            _getFieldIcon(field.icon),
            size: 14.r,
            color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
          ),
        ),
        SizedBox(width: 10.w),
        Expanded(
          flex: 4,
          child: Text(
            field.label,
            style: TextStyle(
              fontSize: 12.sp,
              color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        SizedBox(width: 6.w),
        Expanded(
          flex: 6,
          child: isPlate
              ? Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF15803D).withValues(alpha: 0.25)
                          : AppColors.primarySubtle,
                      borderRadius: BorderRadius.circular(6.r),
                      border: Border.all(
                        color: isDark
                            ? const Color(0xFF4ADE80).withValues(alpha: 0.35)
                            : AppColors.primary.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      field.value,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        fontSize: 12.sp,
                        color: isDark ? const Color(0xFF4ADE80) : AppColors.primary,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                )
              : isStatus
                  ? Align(
                      alignment: Alignment.centerRight,
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                        decoration: BoxDecoration(
                          color: _getStatusBg(field.value),
                          borderRadius: BorderRadius.circular(6.r),
                          border: Border.all(color: _getStatusBorder(field.value)),
                        ),
                        child: Text(
                          field.value,
                          style: TextStyle(
                            fontSize: 11.sp,
                            fontWeight: FontWeight.bold,
                            color: _getStatusColor(field.value, isDark: isDark),
                          ),
                        ),
                      ),
                    )
                  : SelectableText(
                      field.value,
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontSize: 12.5.sp,
                        color: Theme.of(context).colorScheme.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
        ),
      ],
    );
  }

  Color _getStatusBg(String status) {
    final s = status.toUpperCase();
    if (s.contains('APPROV') || s.contains('ACCEPT') || s == 'READ') {
      return const Color(0xFF10B981).withValues(alpha: 0.15);
    }
    if (s.contains('DENI') || s.contains('REJECT') || s.contains('UNAUTH')) {
      return const Color(0xFFEF4444).withValues(alpha: 0.15);
    }
    return const Color(0xFFF59E0B).withValues(alpha: 0.15);
  }

  Color _getStatusBorder(String status) {
    final s = status.toUpperCase();
    if (s.contains('APPROV') || s.contains('ACCEPT') || s == 'READ') {
      return const Color(0xFF10B981).withValues(alpha: 0.4);
    }
    if (s.contains('DENI') || s.contains('REJECT') || s.contains('UNAUTH')) {
      return const Color(0xFFEF4444).withValues(alpha: 0.4);
    }
    return const Color(0xFFF59E0B).withValues(alpha: 0.4);
  }

  Color _getStatusColor(String status, {bool isDark = false}) {
    final s = status.toUpperCase();
    if (s.contains('APPROV') || s.contains('ACCEPT') || s == 'READ') {
      return isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
    }
    if (s.contains('DENI') || s.contains('REJECT') || s.contains('UNAUTH')) {
      return isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626);
    }
    return isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706);
  }
}

class _NotificationTypeMeta {
  final String label;
  final IconData icon;
  final Color color;
  final Color bgColor;

  const _NotificationTypeMeta({
    required this.label,
    required this.icon,
    required this.color,
    required this.bgColor,
  });
}
