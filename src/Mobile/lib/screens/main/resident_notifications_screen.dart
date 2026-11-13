import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/notification_model.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/animated_list_item.dart';
import '../../widgets/modals/notification_detail_dialog.dart';
import '../../widgets/skeleton_loader.dart';

class ResidentNotificationsScreen extends ConsumerStatefulWidget {
  const ResidentNotificationsScreen({super.key});

  @override
  ConsumerState<ResidentNotificationsScreen> createState() =>
      _ResidentNotificationsScreenState();
}

class _ResidentNotificationsScreenState
    extends ConsumerState<ResidentNotificationsScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _confirmClearAll(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          width: 320.w,
          padding: EdgeInsets.all(22.r),
          decoration: BoxDecoration(
            color: Theme.of(ctx).cardColor,
            borderRadius: BorderRadius.circular(24.r),
            border: Border.all(
              color: Theme.of(ctx).dividerColor.withValues(alpha: 0.5),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 28,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52.r,
                height: 52.r,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFFCA5A5).withValues(alpha: 0.5),
                  ),
                ),
                child: Icon(
                  Icons.delete_sweep_rounded,
                  color: const Color(0xFFDC2626),
                  size: 26.r,
                ),
              ),
              SizedBox(height: 16.h),
              Text(
                'Clear All Notifications?',
                style: TextStyle(
                  color: Theme.of(ctx).colorScheme.onSurface,
                  fontSize: 17.sp,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.3,
                ),
              ),
              SizedBox(height: 8.h),
              Text(
                'This will permanently delete all notifications from your account.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSecondary,
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
                          color: Theme.of(ctx).dividerColor,
                        ),
                        padding: EdgeInsets.symmetric(vertical: 12.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24.r),
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

    if (confirmed == true && context.mounted) {
      final success =
          await ref.read(residentServiceProvider).clearAllNotifications();
      if (context.mounted) {
        if (success) {
          ToastHelper.showSuccess(context, 'All notifications cleared');
          // ignore: unused_result
          ref.refresh(notificationsProvider);
        } else {
          ToastHelper.showError(context, 'Failed to clear notifications');
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          backgroundColor: Theme.of(context).cardColor,
          onRefresh: () async => ref.refresh(notificationsProvider),
          child: RawScrollbar(
            controller: _scrollController,
            thumbVisibility: true,
            interactive: true,
            thickness: 4.5.w,
            radius: const Radius.circular(4),
            thumbColor: Theme.of(context).dividerColor.withValues(alpha: 0.6),
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // ── Header Title & Subtitle Section ──────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 16.h),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Notifications',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface,
                                fontSize: 24.sp,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.5,
                              ),
                            ),
                            SizedBox(height: 4.h),
                            Text(
                              'View recent system and security notifications.',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13.sp,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                      ),
                      notifsAsync.maybeWhen(
                        data: (notifications) {
                          if (notifications.isEmpty) return const SizedBox.shrink();
                          return Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              TextButton(
                                    onPressed: () async {
                                      await ref
                                          .read(residentServiceProvider)
                                          .markAllNotificationsRead();
                                      // ignore: unused_result
                                      ref.refresh(notificationsProvider);
                                    },
                                    style: TextButton.styleFrom(
                                      backgroundColor: Theme.of(context).brightness == Brightness.dark
                                          ? AppColors.primary.withValues(alpha: 0.20)
                                          : AppColors.primarySubtle,
                                      padding: EdgeInsets.symmetric(
                                        horizontal: 10.w,
                                        vertical: 5.h,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(20.r),
                                        side: BorderSide(
                                          color: AppColors.primary.withValues(alpha: 0.25),
                                        ),
                                      ),
                                      minimumSize: Size.zero,
                                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    ),
                                    child: Text(
                                      'Mark Read',
                                      style: TextStyle(
                                        color: Theme.of(context).brightness == Brightness.dark
                                            ? const Color(0xFF86EFAC)
                                            : AppColors.primary,
                                        fontSize: 12.sp,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  SizedBox(width: 8.w),
                                  // Trash / Clear all icon button
                                  Tooltip(
                                    message: 'Clear all notifications',
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(20.r),
                                        onTap: () => _confirmClearAll(context),
                                        child: Container(
                                          padding: EdgeInsets.all(7.r),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFEE2E2),
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: const Color(0xFFFCA5A5)
                                                  .withValues(alpha: 0.5),
                                            ),
                                          ),
                                          child: Icon(
                                            Icons.delete_sweep_outlined,
                                            color: const Color(0xFFDC2626),
                                            size: 18.r,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                            orElse: () => const SizedBox.shrink(),
                          ),
                        ],
                      ),
                ),
              ),

              // ── Body / Content Section ──────────────────────────────
              SliverPadding(
                padding: EdgeInsets.fromLTRB(20.w, 0, 20.w, 120.h),
                sliver: notifsAsync.when(
                  loading: () => const SliverToBoxAdapter(
                    child: SkeletonListLoader(count: 3),
                  ),
                  error: (e, _) => SliverToBoxAdapter(
                    child: Container(
                      padding: EdgeInsets.all(24.r),
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(20.r),
                        border: Border.all(
                          color: Theme.of(context)
                              .dividerColor
                              .withValues(alpha: 0.5),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          'Failed to load notifications.',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13.sp,
                          ),
                        ),
                      ),
                    ),
                  ),
                  data: (notifications) {
                    if (notifications.isEmpty) {
                      // ── Clean empty state ───────────────────────────
                      return SliverToBoxAdapter(
                        child: Container(
                          width: double.infinity,
                          padding: EdgeInsets.symmetric(
                            vertical: 48.h,
                            horizontal: 20.w,
                          ),
                          decoration: BoxDecoration(
                            color: Theme.of(context).cardColor,
                            borderRadius: BorderRadius.circular(20.r),
                            border: Border.all(
                              color: Theme.of(context)
                                  .dividerColor
                                  .withValues(alpha: 0.5),
                              width: 1,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 14,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 52.r,
                                height: 52.r,
                                decoration: const BoxDecoration(
                                  color: AppColors.primaryLight,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.notifications_off_outlined,
                                  color: AppColors.primary,
                                  size: 24.r,
                                ),
                              ),
                              SizedBox(height: 14.h),
                              Text(
                                "You're all caught up",
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color:
                                      Theme.of(context).colorScheme.onSurface,
                                  fontSize: 15.sp,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              SizedBox(height: 4.h),
                              Text(
                                "No new notifications at the moment.",
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 13.sp,
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }

                    return SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final notif = notifications[index];
                          return AnimatedListItem(
                            index: index,
                            staggerDelay: const Duration(milliseconds: 55),
                            child: _NotificationTile(notif: notif),
                          );
                        },
                        childCount: notifications.length,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  final NotificationModel notif;
  const _NotificationTile({required this.notif});

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          width: 320.w,
          padding: EdgeInsets.all(22.r),
          decoration: BoxDecoration(
            color: Theme.of(ctx).cardColor,
            borderRadius: BorderRadius.circular(24.r),
            border: Border.all(
              color: Theme.of(ctx).dividerColor.withValues(alpha: 0.5),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
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
                  color: const Color(0xFFFEE2E2),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFFCA5A5).withValues(alpha: 0.5),
                  ),
                ),
                child: Icon(
                  Icons.delete_outline_rounded,
                  color: const Color(0xFFDC2626),
                  size: 24.r,
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
                'Are you sure you want to delete this notification?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSecondary,
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
                          color: Theme.of(ctx).dividerColor,
                        ),
                        padding: EdgeInsets.symmetric(vertical: 12.h),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24.r),
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
      ),
    );

    if (confirmed == true && context.mounted) {
      final success =
          await ref.read(residentServiceProvider).deleteNotification(notif.id);
      if (context.mounted) {
        if (success) {
          ToastHelper.showSuccess(context, 'Notification deleted');
          // ignore: unused_result
          ref.refresh(notificationsProvider);
        } else {
          ToastHelper.showError(context, 'Failed to delete notification');
        }
      }
    }
  }

  void _openDetails(BuildContext context, WidgetRef ref) {
    NotificationDetailDialog.show(
      context,
      notification: notif,
      onMarkedRead: () {
        // ignore: unused_result
        ref.refresh(notificationsProvider);
      },
      onDeleted: () {
        // ignore: unused_result
        ref.refresh(notificationsProvider);
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Dismissible(
      key: Key('notification_${notif.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (direction) async {
        return await showDialog<bool>(
          context: context,
          barrierColor: Colors.black.withValues(alpha: 0.5),
          builder: (ctx) => Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            child: Container(
              width: 320.w,
              padding: EdgeInsets.all(22.r),
              decoration: BoxDecoration(
                color: Theme.of(ctx).cardColor,
                borderRadius: BorderRadius.circular(24.r),
                border: Border.all(
                  color: Theme.of(ctx).dividerColor.withValues(alpha: 0.5),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
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
                      color: const Color(0xFFFEE2E2),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFFCA5A5).withValues(alpha: 0.5),
                      ),
                    ),
                    child: Icon(
                      Icons.delete_outline_rounded,
                      color: const Color(0xFFDC2626),
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
                    'Are you sure you want to remove this notification?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary,
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
                              color: Theme.of(ctx).dividerColor,
                            ),
                            padding: EdgeInsets.symmetric(vertical: 12.h),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24.r),
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
          ),
        );
      },
      onDismissed: (_) async {
        await ref.read(residentServiceProvider).deleteNotification(notif.id);
        if (context.mounted) {
          ToastHelper.showSuccess(context, 'Notification deleted');
          // ignore: unused_result
          ref.refresh(notificationsProvider);
        }
      },
      background: Container(
        margin: EdgeInsets.only(bottom: 12.h),
        padding: EdgeInsets.symmetric(horizontal: 20.w),
        alignment: Alignment.centerRight,
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(18.r),
          border: Border.all(
            color: const Color(0xFFFCA5A5).withValues(alpha: 0.6),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Delete',
              style: TextStyle(
                color: const Color(0xFFDC2626),
                fontWeight: FontWeight.bold,
                fontSize: 13.sp,
              ),
            ),
            SizedBox(width: 6.w),
            Icon(
              Icons.delete_outline_rounded,
              color: const Color(0xFFDC2626),
              size: 20.r,
            ),
          ],
        ),
      ),
      child: Container(
        margin: EdgeInsets.only(bottom: 12.h),
        decoration: BoxDecoration(
          color: notif.isRead
              ? Theme.of(context).cardColor
              : (Theme.of(context).brightness == Brightness.dark
                  ? AppColors.primary.withValues(alpha: 0.12)
                  : AppColors.primarySubtle),
          borderRadius: BorderRadius.circular(18.r),
          border: Border.all(
            color: notif.isRead
                ? Theme.of(context).dividerColor.withValues(alpha: 0.6)
                : (Theme.of(context).brightness == Brightness.dark
                    ? AppColors.primary.withValues(alpha: 0.40)
                    : AppColors.primary.withValues(alpha: 0.35)),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18.r),
            onTap: () => _openDetails(context, ref),
            child: Padding(
              padding: EdgeInsets.all(15.r),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40.r,
                    height: 40.r,
                    decoration: BoxDecoration(
                      color: notif.isRead
                          ? (Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF262626)
                              : AppColors.surfaceMuted)
                          : (Theme.of(context).brightness == Brightness.dark
                              ? AppColors.primary.withValues(alpha: 0.22)
                              : AppColors.primaryLight),
                      borderRadius: BorderRadius.circular(12.r),
                    ),
                    child: Icon(
                      Icons.notifications_rounded,
                      color: notif.isRead
                          ? (Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF94A3B8)
                              : AppColors.textSecondary)
                          : (Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF4ADE80)
                              : AppColors.primary),
                      size: 20.r,
                    ),
                  ),
                  SizedBox(width: 14.w),
                  Expanded(
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
                                  fontSize: 14.sp,
                                  fontWeight: notif.isRead
                                      ? FontWeight.w600
                                      : FontWeight.w700,
                                  color: Theme.of(context).colorScheme.onSurface,
                                ),
                              ),
                            ),
                            if (!notif.isRead)
                              Container(
                                width: 8.r,
                                height: 8.r,
                                margin: EdgeInsets.only(right: 6.w),
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: AppColors.textMuted,
                              size: 18.r,
                            ),
                          ],
                        ),
                        SizedBox(height: 4.h),
                        Text(
                          notif.message,
                          style: TextStyle(
                            fontSize: 12.5.sp,
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        SizedBox(height: 10.h),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // Date & time or relative time
                            Text(
                              notif.timeAgo.isNotEmpty
                                  ? notif.timeAgo
                                  : notif.createdAt,
                              style: TextStyle(
                                fontSize: 11.sp,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Trash icon button on tile
                                Tooltip(
                                  message: 'Delete notification',
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(6.r),
                                      onTap: () => _confirmDelete(context, ref),
                                      child: Padding(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 6.w,
                                          vertical: 3.h,
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              Icons.delete_outline_rounded,
                                              size: 14.r,
                                              color: const Color(0xFFDC2626)
                                                  .withValues(alpha: 0.85),
                                            ),
                                            SizedBox(width: 3.w),
                                            Text(
                                              'Delete',
                                              style: TextStyle(
                                                fontSize: 11.sp,
                                                color: const Color(0xFFDC2626)
                                                  .withValues(alpha: 0.85),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 10.w),
                                // View details action
                                InkWell(
                                  borderRadius: BorderRadius.circular(6.r),
                                  onTap: () => _openDetails(context, ref),
                                  child: Padding(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 4.w,
                                      vertical: 3.h,
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'Details',
                                          style: TextStyle(
                                            fontSize: 11.sp,
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        Icon(
                                          Icons.chevron_right_rounded,
                                          color: AppColors.primary,
                                          size: 15.r,
                                        ),
                                      ],
                                    ),
                                  ),
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
      ),
    );
  }
}
