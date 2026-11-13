import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/visitor_request_model.dart';
import '../../providers/resident_provider.dart';

class ResidentVisitorsScreen extends ConsumerStatefulWidget {
  const ResidentVisitorsScreen({super.key});

  @override
  ConsumerState<ResidentVisitorsScreen> createState() =>
      _ResidentVisitorsScreenState();
}

class _ResidentVisitorsScreenState
    extends ConsumerState<ResidentVisitorsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  int? _respondingId;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'APPROVED':
        return const Color(0xFF10B981);
      case 'PENDING':
        return const Color(0xFFF59E0B);
      case 'REJECTED':
      case 'DENIED':
      case 'CANCELLED':
        return const Color(0xFFEF4444);
      case 'COMPLETED':
        return const Color(0xFF3B82F6);
      default:
        return const Color(0xFF8B949E);
    }
  }

  IconData _statusIcon(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'APPROVED':
        return Icons.check_circle_rounded;
      case 'PENDING':
        return Icons.hourglass_top_rounded;
      case 'REJECTED':
      case 'DENIED':
        return Icons.cancel_rounded;
      case 'CANCELLED':
        return Icons.block_rounded;
      case 'COMPLETED':
        return Icons.task_alt_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  Future<void> _respond(VisitorRequestModel req, String decision) async {
    setState(() => _respondingId = req.requestId);
    try {
      final service = ref.read(residentServiceProvider);
      await service.residentRespond(req.requestId, decision);
      ref.invalidate(myVisitorRequestsProvider);
      ref.invalidate(notificationsProvider);
      if (mounted) {
        final label = decision == 'CONFIRM' ? 'confirmed' : 'rejected';
        ToastHelper.showSuccess(
          context,
          'Visitor ${req.visitor?.fullName ?? ''} $label successfully.',
        );
      }
    } catch (_) {
      if (mounted) {
        ToastHelper.showError(context, 'Action failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _respondingId = null);
    }
  }

  Future<void> _showRespondSheet(VisitorRequestModel req) async {
    await showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).cardColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24.r)),
      ),
      builder: (_) => _RespondSheet(
        request: req,
        onConfirm: () {
          Navigator.pop(context);
          _respond(req, 'CONFIRM');
        },
        onReject: () {
          Navigator.pop(context);
          _respond(req, 'REJECT');
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(myVisitorRequestsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        title: Text(
          'Visitor Requests',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            onPressed: () => ref.invalidate(myVisitorRequestsProvider),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          labelStyle: TextStyle(fontSize: 13.5.sp, fontWeight: FontWeight.bold),
          tabs: const [
            Tab(text: 'Pending Action'),
            Tab(text: 'All History'),
          ],
        ),
      ),
      body: requestsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded,
                  color: AppColors.error, size: 40.r),
              SizedBox(height: 12.h),
              Text('Failed to load visitor requests.',
                  style:
                      TextStyle(fontSize: 14.sp, color: AppColors.textSecondary)),
              SizedBox(height: 12.h),
              ElevatedButton(
                onPressed: () =>
                    ref.invalidate(myVisitorRequestsProvider),
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (all) {
          final pending =
              all.where((r) => r.isPendingWalkin).toList();
          return TabBarView(
            controller: _tabCtrl,
            children: [
              _PendingTab(
                requests: pending,
                respondingId: _respondingId,
                onRespond: _showRespondSheet,
              ),
              _HistoryTab(
                requests: all,
                statusColor: _statusColor,
                statusIcon: _statusIcon,
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1 - Pending Walk-ins
// ---------------------------------------------------------------------------

class _PendingTab extends StatefulWidget {
  final List<VisitorRequestModel> requests;
  final int? respondingId;
  final void Function(VisitorRequestModel) onRespond;

  const _PendingTab({
    required this.requests,
    required this.respondingId,
    required this.onRespond,
  });

  @override
  State<_PendingTab> createState() => _PendingTabState();
}

class _PendingTabState extends State<_PendingTab> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.requests.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: EdgeInsets.all(20.r),
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.how_to_reg_rounded,
                  color: AppColors.primary, size: 36.r),
            ),
            SizedBox(height: 16.h),
            Text('No pending visitors',
                style: TextStyle(
                    fontSize: 16.sp,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onSurface)),
            SizedBox(height: 6.h),
            Text(
              'Walk-in visitors waiting for your\nconfirmation will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13.sp,
                  color: AppColors.textSecondary,
                  height: 1.4),
            ),
          ],
        ),
      );
    }

    return RawScrollbar(
      controller: _scrollController,
      thumbVisibility: true,
      interactive: true,
      thickness: 4.5.w,
      radius: const Radius.circular(4),
      thumbColor: Theme.of(context).dividerColor.withValues(alpha: 0.6),
      child: ListView.builder(
        controller: _scrollController,
        padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 120.h),
        itemCount: widget.requests.length,
        itemBuilder: (ctx, i) {
          final req = widget.requests[i];
          final isResponding = widget.respondingId == req.requestId;
          return _WalkinCard(
            request: req,
            isResponding: isResponding,
            onTap: isResponding ? null : () => widget.onRespond(req),
          );
        },
      ),
    );
  }
}

class _WalkinCard extends StatelessWidget {
  final VisitorRequestModel request;
  final bool isResponding;
  final VoidCallback? onTap;

  const _WalkinCard({
    required this.request,
    required this.isResponding,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final visitor = request.visitor;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: EdgeInsets.only(bottom: 14.h),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18.r),
        border: Border.all(
          color: const Color(0xFFF59E0B).withValues(alpha: isDark ? 0.4 : 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF59E0B).withValues(alpha: isDark ? 0.2 : 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding:
                EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: isDark ? 0.18 : 0.10),
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(16.r)),
            ),
            child: Row(
              children: [
                Icon(Icons.person_pin_circle_rounded,
                    color: const Color(0xFFD97706), size: 18.r),
                SizedBox(width: 8.w),
                Expanded(
                  child: Text('Visitor at Gate',
                      style: TextStyle(
                          fontSize: 13.sp,
                          fontWeight: FontWeight.bold,
                          color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309))),
                ),
                const _StatusBadge(
                    label: 'PENDING',
                    color: Color(0xFFF59E0B)),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(16.r),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  visitor?.fullName ?? 'Unknown Visitor',
                  style: TextStyle(
                    fontSize: 17.sp,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                SizedBox(height: 10.h),
                _DetailRow(
                    icon: Icons.phone_outlined,
                    label: 'Contact',
                    value: visitor?.contactNumber ?? '---'),
                if (visitor?.vehiclePlate != null)
                  _DetailRow(
                    icon: Icons.directions_car_outlined,
                    label: 'Vehicle',
                    value:
                        '${visitor!.vehiclePlate!}${visitor.vehicleType != null ? ' - ${visitor.vehicleType}' : ''}',
                  ),
                _DetailRow(
                    icon: Icons.info_outline_rounded,
                    label: 'Purpose',
                    value: request.purpose),
                _DetailRow(
                    icon: Icons.schedule_rounded,
                    label: 'Time',
                    value: request.visitTime),
                _DetailRow(
                    icon: Icons.calendar_today_outlined,
                    label: 'Date',
                    value: request.visitDate),
                if (request.guardRemarks != null &&
                    request.guardRemarks!.isNotEmpty)
                  _DetailRow(
                    icon: Icons.security_rounded,
                    label: 'Guard Note',
                    value: request.guardRemarks!,
                    valueColor: AppColors.textSecondary,
                  ),
                SizedBox(height: 14.h),
                if (isResponding)
                  const Center(
                    child: SizedBox(
                      height: 36,
                      width: 36,
                      child: CircularProgressIndicator(
                          color: AppColors.primary, strokeWidth: 2.5),
                    ),
                  )
                else
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: onTap,
                          style: OutlinedButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: 12.h),
                            side: const BorderSide(color: Color(0xFFFCA5A5)),
                            backgroundColor: const Color(0xFFFEE2E2),
                            foregroundColor: const Color(0xFFDC2626),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.r),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.close_rounded, size: 16.r, color: const Color(0xFFDC2626)),
                              SizedBox(width: 4.w),
                              Text('Reject', style: TextStyle(fontSize: 13.5.sp, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: onTap,
                          style: ElevatedButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: 12.h),
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.r),
                            ),
                            elevation: 0,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_rounded, size: 16.r, color: Colors.white),
                              SizedBox(width: 4.w),
                              Text('Confirm', style: TextStyle(fontSize: 13.5.sp, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}


// ---------------------------------------------------------------------------
// Tab 2 - History
// ---------------------------------------------------------------------------

class _HistoryTab extends StatefulWidget {
  final List<VisitorRequestModel> requests;
  final Color Function(String) statusColor;
  final IconData Function(String) statusIcon;

  const _HistoryTab({
    required this.requests,
    required this.statusColor,
    required this.statusIcon,
  });

  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.requests.isEmpty) {
      return Center(
        child: Text('No visitor requests yet.',
            style: TextStyle(
                fontSize: 14.sp,
                color: AppColors.textSecondary)),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RawScrollbar(
      controller: _scrollController,
      thumbVisibility: true,
      interactive: true,
      thickness: 4.5.w,
      radius: const Radius.circular(4),
      thumbColor: Theme.of(context).dividerColor.withValues(alpha: 0.6),
      child: ListView.builder(
        controller: _scrollController,
        padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 120.h),
        itemCount: widget.requests.length,
        itemBuilder: (ctx, i) {
          final req = widget.requests[i];
          final sColor = widget.statusColor(req.status);
          final sIcon = widget.statusIcon(req.status);

        return Container(
          margin: EdgeInsets.only(bottom: 12.h),
          padding: EdgeInsets.all(14.r),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(18.r),
            border: Border.all(
              color: Theme.of(context).dividerColor.withValues(alpha: isDark ? 0.3 : 0.6),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.03),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42.r,
                height: 42.r,
                decoration: BoxDecoration(
                  color: sColor.withValues(alpha: isDark ? 0.20 : 0.12),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                child: Icon(sIcon, color: sColor, size: 22.r),
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
                            req.visitor?.fullName ?? 'Unknown Visitor',
                            style: TextStyle(
                              fontSize: 14.5.sp,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                        ),
                        _StatusBadge(
                            label: req.status, color: sColor),
                      ],
                    ),
                    SizedBox(height: 4.h),
                    Text(req.purpose,
                        style: TextStyle(
                            fontSize: 12.sp,
                            color: AppColors.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    SizedBox(height: 6.h),
                    Row(
                      children: [
                        Icon(Icons.calendar_today_outlined,
                            size: 12.r,
                            color: AppColors.textMuted),
                        SizedBox(width: 4.w),
                        Text('${req.visitDate}  ${req.visitTime}',
                            style: TextStyle(
                                fontSize: 11.sp,
                                color: AppColors.textSecondary)),
                        SizedBox(width: 8.w),
                        Container(
                          padding: EdgeInsets.symmetric(
                              horizontal: 7.w, vertical: 2.h),
                          decoration: BoxDecoration(
                            color: req.requestedBy == 'guard'
                                ? const Color(0xFF7C3AED).withValues(alpha: isDark ? 0.25 : 0.10)
                                : AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(6.r),
                          ),
                          child: Text(
                            req.requestedBy == 'guard'
                                ? 'Walk-in'
                                : 'Pre-reg',
                            style: TextStyle(
                              fontSize: 9.5.sp,
                              fontWeight: FontWeight.bold,
                              color: req.requestedBy == 'guard'
                                  ? (isDark ? const Color(0xFFA78BFA) : const Color(0xFF7C3AED))
                                  : AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bottom Sheet
// ---------------------------------------------------------------------------

class _RespondSheet extends StatelessWidget {
  final VisitorRequestModel request;
  final VoidCallback onConfirm;
  final VoidCallback onReject;

  const _RespondSheet({
    required this.request,
    required this.onConfirm,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    final visitor = request.visitor;

    return Padding(
      padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 32.h),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40.w,
            height: 4.h,
            decoration: BoxDecoration(
              color: Theme.of(context).dividerColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          SizedBox(height: 20.h),
          Container(
            width: 60.r,
            height: 60.r,
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppColors.primary.withValues(alpha: 0.20)
                  : AppColors.primaryLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person_rounded,
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFF4ADE80)
                  : AppColors.primary,
              size: 30,
            ),
          ),
          SizedBox(height: 12.h),
          Text(
            visitor?.fullName ?? 'Visitor',
            style: TextStyle(
              fontSize: 18.sp,
              fontWeight: FontWeight.bold,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          SizedBox(height: 4.h),
          Text('is at the gate requesting entry',
              style: TextStyle(
                  fontSize: 13.sp,
                  color: AppColors.textSecondary)),
          SizedBox(height: 10.h),
          if (visitor?.vehiclePlate != null)
            Container(
              padding:
                  EdgeInsets.symmetric(horizontal: 12.w, vertical: 5.h),
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF222222)
                    : AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Theme.of(context).dividerColor),
              ),
              child: Text(
                'Vehicle: ${visitor!.vehiclePlate}${visitor.vehicleType != null ? ' - ${visitor.vehicleType}' : ''}',
                style: TextStyle(
                    fontSize: 12.sp,
                    color: Theme.of(context).colorScheme.onSurface,
                    fontWeight: FontWeight.w600),
              ),
            ),
          SizedBox(height: 6.h),
          Text(
            'Purpose: ${request.purpose}',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 12.sp, color: AppColors.textSecondary),
          ),
          SizedBox(height: 24.h),
          Text(
            'Do you allow this visitor to enter?',
            style: TextStyle(
              fontSize: 14.sp,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          SizedBox(height: 16.h),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onReject,
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0xFFFEE2E2),
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(
                        color: Color(0xFFFCA5A5), width: 1.2),
                    padding: EdgeInsets.symmetric(vertical: 14.h),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12.r)),
                    elevation: 0,
                  ),
                  icon: Icon(Icons.close_rounded, size: 18.r),
                  label: Text('Reject',
                      style: TextStyle(
                          fontSize: 15.sp,
                          fontWeight: FontWeight.bold)),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onConfirm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.symmetric(vertical: 14.h),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12.r)),
                    elevation: 0,
                  ),
                  icon: Icon(Icons.check_rounded, size: 18.r),
                  label: Text('Confirm',
                      style: TextStyle(
                          fontSize: 15.sp,
                          fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared small helpers
// ---------------------------------------------------------------------------

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.22 : 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: isDark ? 0.6 : 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.sp,
          fontWeight: FontWeight.bold,
          color: color,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: 6.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 13.r, color: AppColors.textMuted),
          SizedBox(width: 6.w),
          SizedBox(
            width: 62.w,
            child: Text('$label:',
                style: TextStyle(
                    fontSize: 12.sp,
                    color: AppColors.textSecondary)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 12.sp,
                color: valueColor ?? Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
