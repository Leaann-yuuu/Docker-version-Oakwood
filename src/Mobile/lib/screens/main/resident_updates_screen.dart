import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../core/constants/app_colors.dart';
import '../../core/utils/plate_input_formatter.dart';
import '../../core/utils/toast_helper.dart';
import '../../models/update_request_model.dart';
import '../../providers/resident_provider.dart';
import '../../widgets/animated_list_item.dart';

class ResidentUpdatesScreen extends ConsumerStatefulWidget {
  const ResidentUpdatesScreen({super.key});

  @override
  ConsumerState<ResidentUpdatesScreen> createState() =>
      _ResidentUpdatesScreenState();
}

class _ResidentUpdatesScreenState
    extends ConsumerState<ResidentUpdatesScreen> {
  final List<_UpdatesGuestEntry> _guestEntries = [_UpdatesGuestEntry()];
  final _reasonCtrl = TextEditingController();

  bool _isSubmitting = false;

  @override
  void dispose() {
    for (final e in _guestEntries) {
      e.dispose();
    }
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitGuestAccess() async {
    final guestsData = <Map<String, dynamic>>[];
    for (int i = 0; i < _guestEntries.length; i++) {
      final entry = _guestEntries[i];
      final name = entry.nameCtrl.text.trim();
      if (name.isEmpty) continue;

      final plate = entry.plateCtrl.text.trim().toUpperCase();
      final effectivePlate = plate.isNotEmpty
          ? plate
          : _guestEntries[0].plateCtrl.text.trim().toUpperCase();

      guestsData.add({
        'name': name,
        'guest_name': name,
        'plate_number': effectivePlate,
        'guest_plate_number': effectivePlate,
      });
    }

    if (guestsData.isEmpty) {
      ToastHelper.showError(context, 'Please enter at least one guest name');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final service = ref.read(residentServiceProvider);
      final primary = guestsData.first;
      await service.submitUpdateRequest({
        'request_type': 'guest_access',
        'guest_name': primary['name'],
        'guest_plate_number': primary['plate_number'],
        'access_reason': _reasonCtrl.text.trim().isEmpty
            ? 'Visitor Access'
            : _reasonCtrl.text.trim(),
        'guests': guestsData,
      });

      for (final e in _guestEntries) {
        e.dispose();
      }
      _guestEntries.clear();
      _guestEntries.add(_UpdatesGuestEntry());
      _reasonCtrl.clear();

      if (mounted) {
        final count = guestsData.length;
        ToastHelper.showSuccess(
          context,
          count > 1
              ? 'Guest access request for $count guests submitted!'
              : 'Guest access request submitted!',
        );
      }
      // ignore: unused_result
      ref.refresh(myUpdateRequestsProvider);
    } on DioException catch (e) {
      String msg = 'Failed to submit request';
      dynamic data = e.response?.data;
      if (data is Map) {
        if (data['errors'] != null && data['errors'] is Map) {
          final errors = data['errors'] as Map;
          final messages = <String>[];
          errors.forEach((key, val) {
            if (val is List && val.isNotEmpty) {
              messages.add(val.first.toString());
            } else if (val != null) {
              messages.add(val.toString());
            }
          });
          if (messages.isNotEmpty) {
            msg = messages.join('\n');
          }
        } else if (data['message'] != null) {
          msg = data['message'].toString();
        }
      }
      if (mounted) ToastHelper.showError(context, msg);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(myUpdateRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Requests & Guest Passes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.refresh(myUpdateRequestsProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(myUpdateRequestsProvider),
        child: ListView(
          padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
          children: [
          // ── Guest Access Pass Form Card ─────────────────────────────
          Container(
            padding: EdgeInsets.all(16.r),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(
                color: AppColors.primary.withAlpha(50),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(10),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.directions_car_rounded,
                            color: AppColors.primary, size: 22.r),
                        SizedBox(width: 8.w),
                        Text(
                          'Request Guest Access Pass',
                          style: TextStyle(
                            fontSize: 16.sp,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    if (_guestEntries.length > 1)
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlpha(30),
                          borderRadius: BorderRadius.circular(10.r),
                        ),
                        child: Text(
                          '${_guestEntries.length} Guests',
                          style: TextStyle(
                            fontSize: 10.sp,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                  ],
                ),
                SizedBox(height: 14.h),

                ..._guestEntries.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final guest = entry.value;
                  final isPrimary = idx == 0;

                  return Container(
                    margin: EdgeInsets.only(bottom: 10.h),
                    padding: EdgeInsets.all(10.r),
                    decoration: BoxDecoration(
                      color: isPrimary
                          ? AppColors.primary.withAlpha(12)
                          : Colors.white.withAlpha(6),
                      borderRadius: BorderRadius.circular(12.r),
                      border: Border.all(
                        color: isPrimary
                            ? AppColors.primary.withAlpha(50)
                            : Colors.white.withAlpha(15),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isPrimary ? 'Guest #1 (Primary)' : 'Guest #${idx + 1}',
                              style: TextStyle(
                                fontSize: 12.sp,
                                fontWeight: FontWeight.bold,
                                color: isPrimary ? AppColors.primary : Colors.white70,
                              ),
                            ),
                            if (!isPrimary)
                              InkWell(
                                onTap: () {
                                  setState(() {
                                    guest.dispose();
                                    _guestEntries.removeAt(idx);
                                  });
                                },
                                child: Padding(
                                  padding: EdgeInsets.all(2.r),
                                  child: Row(
                                    children: [
                                      Icon(Icons.delete_outline, size: 14.r, color: Colors.redAccent),
                                      SizedBox(width: 2.w),
                                      Text('Remove', style: TextStyle(fontSize: 10.sp, color: Colors.redAccent)),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                        SizedBox(height: 8.h),
                        TextField(
                          controller: guest.nameCtrl,
                          decoration: InputDecoration(
                            labelText: isPrimary ? 'Guest Name *' : 'Guest #${idx + 1} Name *',
                            hintText: isPrimary ? 'John Visitor' : 'Visitor Name',
                            prefixIcon: const Icon(Icons.person_outline, size: 18),
                          ),
                        ),
                        SizedBox(height: 8.h),
                        TextField(
                          controller: guest.plateCtrl,
                          inputFormatters: [PlateInputFormatter()],
                          decoration: InputDecoration(
                            labelText: isPrimary ? 'Guest Plate Number' : 'Plate Number (Optional)',
                            hintText: isPrimary ? 'ABC9999' : 'Leave empty if same car',
                            prefixIcon: const Icon(Icons.badge_outlined, size: 18),
                          ),
                        ),
                      ],
                    ),
                  );
                }),

                // Add Guest Button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _guestEntries.add(_UpdatesGuestEntry());
                      });
                    },
                    icon: const Icon(Icons.person_add_rounded, size: 16),
                    label: Text(
                      '+ Add Another Guest to Ticket',
                      style: TextStyle(fontSize: 12.sp),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 8.h),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10.r),
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 12.h),

                TextField(
                  controller: _reasonCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Reason for Visit (All Guests)',
                    hintText: 'Family gathering / Delivery',
                    prefixIcon: Icon(Icons.notes_rounded, size: 18),
                  ),
                ),
                SizedBox(height: 16.h),
                SizedBox(
                  width: double.infinity,
                  height: 46.h,
                  child: ElevatedButton.icon(
                    onPressed: _isSubmitting ? null : _submitGuestAccess,
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 18),
                    label: Text(_isSubmitting
                        ? 'Submitting...'
                        : (_guestEntries.length > 1
                            ? 'Submit Pass for ${_guestEntries.length} Guests'
                            : 'Submit Pass')),
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: 24.h),

          Text(
            'My Request History',
            style: TextStyle(
              fontSize: 16.sp,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 10.h),

          // ── Requests History List ─────────────────────────────────────
          requestsAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (e, _) => Center(child: Text('Failed to load history: $e')),
            data: (requests) {
              if (requests.isEmpty) {
                return Padding(
                  padding: EdgeInsets.only(top: 24.h),
                  child: Center(
                    child: Text(
                      'No past requests found',
                      style: TextStyle(
                        fontSize: 13.sp,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                );
              }

              return Column(
                children: List.generate(requests.length, (i) {
                  final req = requests[i];
                  return AnimatedListItem(
                    index: i,
                    staggerDelay: const Duration(milliseconds: 55),
                    child: _RequestTile(
                      req: req,
                      onTap: () => _showTicketDialog(context, req),
                    ),
                  );
                }),
              );
            },
          ),
        ],
      ),
    ),
    );
  }

  void _showTicketDialog(BuildContext context, UpdateRequestModel req) {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Ticket',
      barrierColor: Colors.black.withAlpha(180),
      transitionDuration: const Duration(milliseconds: 280),
      transitionBuilder: (ctx, animation, _, child) {
        final curve = CurvedAnimation(
          parent: animation,
          curve: const Cubic(0.34, 1.56, 0.64, 1.0),
          reverseCurve: Curves.easeIn,
        );
        return FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.92, end: 1.0).animate(curve),
            child: child,
          ),
        );
      },
      pageBuilder: (ctx, animation, secondaryAnimation) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 24.h),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(24.r),
            border: Border.all(
              color: req.isApproved
                  ? AppColors.success
                  : req.isRejected
                      ? AppColors.error
                      : AppColors.warning,
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: (req.isApproved
                        ? AppColors.success
                        : req.isRejected
                            ? AppColors.error
                            : AppColors.warning)
                    .withAlpha(60),
                blurRadius: 24,
                spreadRadius: 2,
              ),
            ],
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Ticket Header
                Container(
                  padding:
                      EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
                  decoration: BoxDecoration(
                    color: (req.isApproved
                            ? AppColors.success
                            : req.isRejected
                                ? AppColors.error
                                : AppColors.warning)
                        .withAlpha(25),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(22.r),
                      topRight: Radius.circular(22.r),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        req.isApproved
                            ? Icons.verified_rounded
                            : req.isRejected
                                ? Icons.cancel_rounded
                                : Icons.access_time_filled_rounded,
                        color: req.isApproved
                            ? AppColors.success
                            : req.isRejected
                                ? AppColors.error
                                : AppColors.warning,
                        size: 24.r,
                      ),
                      SizedBox(width: 10.w),
                      Expanded(
                        child: Text(
                          req.isGuestAccess
                              ? 'GUEST GATE ENTRY TICKET'
                              : 'GUEST GATE ACCESS PASS',
                          style: TextStyle(
                            fontSize: 14.sp,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),

                Padding(
                  padding: EdgeInsets.all(20.r),
                  child: Column(
                    children: [
                      // Status Badge
                      Container(
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 6.h),
                        decoration: BoxDecoration(
                          color: (req.isApproved
                                  ? AppColors.success
                                  : req.isRejected
                                      ? AppColors.error
                                      : AppColors.warning)
                              .withAlpha(40),
                          borderRadius: BorderRadius.circular(20.r),
                          border: Border.all(
                            color: (req.isApproved
                                ? AppColors.success
                                : req.isRejected
                                    ? AppColors.error
                                    : AppColors.warning),
                          ),
                        ),
                        child: Text(
                          req.isApproved
                              ? '✓ PASS APPROVED - VALID FOR ENTRY'
                              : req.isRejected
                                  ? '✕ ACCESS REQUEST REJECTED'
                                  : '⏳ PENDING GUARD REVIEW',
                          style: TextStyle(
                            fontSize: 12.sp,
                            fontWeight: FontWeight.bold,
                            color: req.isApproved
                                ? AppColors.success
                                : req.isRejected
                                    ? AppColors.error
                                    : AppColors.warning,
                          ),
                        ),
                      ),

                      SizedBox(height: 20.h),

                      // Ticket Pass Details Box
                      Container(
                        padding: EdgeInsets.all(16.r),
                        decoration: BoxDecoration(
                          color: Colors.white.withAlpha(8),
                          borderRadius: BorderRadius.circular(16.r),
                          border: Border.all(color: Colors.white.withAlpha(20)),
                        ),
                        child: Column(
                          children: [
                            if (req.hasMultipleGuests) ...[
                              Container(
                                padding: EdgeInsets.all(12.r),
                                decoration: BoxDecoration(
                                  color: Colors.white.withAlpha(10),
                                  borderRadius: BorderRadius.circular(12.r),
                                  border: Border.all(color: Colors.white.withAlpha(20)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(Icons.group_rounded, color: const Color(0xFF60A5FA), size: 16.r),
                                        SizedBox(width: 6.w),
                                        Text(
                                          'GUESTS INCLUDED (${req.guests.length})',
                                          style: TextStyle(
                                            fontSize: 11.sp,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF93C5FD),
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 8.h),
                                    ...req.guests.asMap().entries.map((entry) {
                                      final idx = entry.key;
                                      final g = entry.value;
                                      return Padding(
                                        padding: EdgeInsets.symmetric(vertical: 4.h),
                                        child: Row(
                                          children: [
                                            CircleAvatar(
                                              radius: 10.r,
                                              backgroundColor: const Color(0xFF7C3AED).withAlpha(120),
                                              child: Text(
                                                '${idx + 1}',
                                                style: TextStyle(fontSize: 9.sp, color: Colors.white, fontWeight: FontWeight.bold),
                                              ),
                                            ),
                                            SizedBox(width: 8.w),
                                            Expanded(
                                              child: Text(
                                                g.name,
                                                style: TextStyle(fontSize: 12.sp, color: Colors.white, fontWeight: FontWeight.w600),
                                              ),
                                            ),
                                            if (g.plateNumber != null && g.plateNumber!.isNotEmpty)
                                              Container(
                                                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 1.h),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF3B82F6).withAlpha(40),
                                                  borderRadius: BorderRadius.circular(4.r),
                                                ),
                                                child: Text(
                                                  g.plateNumber!,
                                                  style: TextStyle(
                                                    fontSize: 10.sp,
                                                    fontWeight: FontWeight.bold,
                                                    color: const Color(0xFF93C5FD),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              ),
                              Divider(color: Colors.white12, height: 16.h),
                            ] else ...[
                              _TicketRow(
                                label: 'Guest Name',
                                value: req.guestName ?? 'Resident Request',
                                bold: true,
                              ),
                              Divider(color: Colors.white12, height: 16.h),
                              _TicketRow(
                                label: 'Vehicle Plate',
                                value: req.guestPlateNumber ?? 'N/A',
                                badge: true,
                              ),
                              Divider(color: Colors.white12, height: 16.h),
                            ],
                            _TicketRow(
                              label: 'Reason for Visit',
                              value: req.accessReason ?? 'Visitor Access',
                            ),
                            Divider(color: Colors.white12, height: 16.h),
                            _TicketRow(
                              label: 'Pass Reference',
                              value: '#GP-${req.id}',
                            ),
                            Divider(color: Colors.white12, height: 16.h),
                            _TicketRow(
                              label: 'Requested On',
                              value: req.createdAt.split('.').first,
                            ),
                          ],
                        ),
                      ),

                      SizedBox(height: 20.h),

                      // Simulated Barcode / QR section for Guard Verification
                      Container(
                        width: double.infinity,
                        padding: EdgeInsets.symmetric(
                            horizontal: 16.w, vertical: 12.h),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12.r),
                        ),
                        child: Column(
                          children: [
                            Icon(Icons.qr_code_2_rounded,
                                size: 72.r, color: Colors.black),
                            SizedBox(height: 4.h),
                            Text(
                              'SHOW THIS PASS TO GATE SECURITY',
                              style: TextStyle(
                                fontSize: 10.sp,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                      ),

                      SizedBox(height: 16.h),

                      SizedBox(
                        width: double.infinity,
                        height: 44.h,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.r),
                            ),
                          ),
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Close Ticket',
                              style: TextStyle(color: Colors.white)),
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
    );
  }
}

class _TicketRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final bool badge;

  const _TicketRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.badge = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.sp,
            color: Colors.white60,
          ),
        ),
        badge
            ? Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(40),
                  borderRadius: BorderRadius.circular(6.r),
                  border: Border.all(color: AppColors.primary.withAlpha(80)),
                ),
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 12.sp,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
              )
            : Text(
                value,
                style: TextStyle(
                  fontSize: 12.sp,
                  fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                  color: Colors.white,
                ),
              ),
      ],
    );
  }
}

class _RequestTile extends StatelessWidget {
  final UpdateRequestModel req;
  final VoidCallback onTap;

  const _RequestTile({required this.req, required this.onTap});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;
    switch (req.status.toLowerCase()) {
      case 'approved':
        statusColor = AppColors.success;
        statusText = 'APPROVED';
        break;
      case 'rejected':
        statusColor = AppColors.error;
        statusText = 'REJECTED';
        break;
      default:
        statusColor = AppColors.warning;
        statusText = 'PENDING';
    }

    final gName = req.guestName;
    final gPlate = req.guestPlateNumber;
    final String displayName;
    if (req.hasMultipleGuests) {
      displayName = 'Guest Pass: ${req.guests.first.name} (+${req.guests.length - 1} guests)';
    } else if (gName != null && gName.isNotEmpty) {
      displayName = 'Guest Pass: $gName';
    } else if (gPlate != null && gPlate.isNotEmpty) {
      displayName = 'Guest Pass ($gPlate)';
    } else {
      displayName = 'Guest Access Ticket Pass';
    }

    return Container(
      margin: EdgeInsets.only(bottom: 10.h),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(
          color: statusColor.withAlpha(60),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(15),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16.r),
        child: InkWell(
          borderRadius: BorderRadius.circular(16.r),
          onTap: onTap,
          child: Padding(
            padding: EdgeInsets.all(14.r),
            child: Row(
              children: [
                // Pass Icon Badge
                Container(
                  width: 42.r,
                  height: 42.r,
                  decoration: BoxDecoration(
                    color: statusColor.withAlpha(25),
                    borderRadius: BorderRadius.circular(12.r),
                    border: Border.all(color: statusColor.withAlpha(60)),
                  ),
                  child: Icon(
                    req.isGuestAccess
                        ? Icons.confirmation_number_outlined
                        : Icons.person_outline,
                    color: statusColor,
                    size: 22.r,
                  ),
                ),
                SizedBox(width: 12.w),

                // Pass Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              displayName,
                              style: TextStyle(
                                fontSize: 14.sp,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 4.h),
                      Row(
                        children: [
                          if (req.guestPlateNumber != null &&
                              req.guestPlateNumber!.isNotEmpty) ...[
                            Container(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 6.w, vertical: 1.h),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withAlpha(30),
                                borderRadius: BorderRadius.circular(4.r),
                              ),
                              child: Text(
                                req.guestPlateNumber!,
                                style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            SizedBox(width: 8.w),
                          ],
                          Text(
                            req.createdAt.split('.').first,
                            style: TextStyle(
                              fontSize: 11.sp,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                SizedBox(width: 8.w),

                // Status Badge & View Ticket Icon
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: 10.w, vertical: 4.h),
                      decoration: BoxDecoration(
                        color: statusColor.withAlpha(25),
                        borderRadius: BorderRadius.circular(20.r),
                        border: Border.all(color: statusColor.withAlpha(80)),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(
                          fontSize: 10.sp,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                    SizedBox(height: 4.h),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'View Pass',
                          style: TextStyle(
                            fontSize: 10.sp,
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 14.r,
                          color: AppColors.primary,
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
  }
}

class _UpdatesGuestEntry {
  final TextEditingController nameCtrl;
  final TextEditingController plateCtrl;

  _UpdatesGuestEntry({
    TextEditingController? nameCtrl,
    TextEditingController? plateCtrl,
  })  : nameCtrl = nameCtrl ?? TextEditingController(),
        plateCtrl = plateCtrl ?? TextEditingController();

  void dispose() {
    nameCtrl.dispose();
    plateCtrl.dispose();
  }
}

