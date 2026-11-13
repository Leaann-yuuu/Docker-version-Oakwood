import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../core/constants/app_colors.dart';

/// A real-time live clock badge showing current time with seconds and date,
/// matching the Oakwood Subdivision resident portal.
class LiveClockBadge extends StatefulWidget {
  /// When true, renders with translucent frosted glass styling for dark/green banners.
  /// When false, adapts automatically to the current theme (light/dark surface).
  final bool isGlassOnDark;

  const LiveClockBadge({
    super.key,
    this.isGlassOnDark = true,
  });

  @override
  State<LiveClockBadge> createState() => _LiveClockBadgeState();
}

class _LiveClockBadgeState extends State<LiveClockBadge> {
  late Timer _timer;
  late DateTime _now;

  static const _weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    // Update every second on time
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _now = DateTime.now();
        });
      }
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final useGlass = widget.isGlassOnDark;

    // Format 12-hour time with seconds: 06:52:15 PM
    final hour24 = _now.hour;
    final period = hour24 >= 12 ? 'PM' : 'AM';
    final hour12 = hour24 == 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
    final hourStr = hour12.toString().padLeft(2, '0');
    final minStr = _now.minute.toString().padLeft(2, '0');
    final secStr = _now.second.toString().padLeft(2, '0');
    final timeFormatted = '$hourStr:$minStr:$secStr $period';

    // Format date: Sun, Oct 4, 2026
    final weekday = _weekdays[_now.weekday % 7];
    final month = _months[_now.month - 1];
    final dateFormatted = '$weekday, $month ${_now.day}, ${_now.year}';

    final Color bgColor;
    final Color borderColor;
    final Color textColor;
    final Color subtextColor;

    if (useGlass) {
      bgColor = Colors.black.withValues(alpha: 0.28);
      borderColor = Colors.white.withValues(alpha: 0.22);
      textColor = Colors.white;
      subtextColor = Colors.white.withValues(alpha: 0.85);
    } else {
      bgColor = isDark
          ? const Color(0xFF13171F).withValues(alpha: 0.90)
          : AppColors.surfaceMuted;
      borderColor = isDark
          ? AppColors.primary.withValues(alpha: 0.40)
          : Theme.of(context).dividerColor.withValues(alpha: 0.70);
      textColor = Theme.of(context).colorScheme.onSurface;
      subtextColor = isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary;
    }

    return Container(
      height: 36.r,
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 3.h),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: borderColor, width: 1.1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Animated pulsating green live dot
          const _PulsingLiveDot(),
          SizedBox(width: 7.w),

          // Date & Time Column
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Time with seconds
              Text(
                timeFormatted,
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 11.5.sp,
                  fontWeight: FontWeight.w700,
                  color: textColor,
                  letterSpacing: -0.2,
                  height: 1.1,
                ),
              ),
              SizedBox(height: 1.5.h),
              // Date
              Text(
                dateFormatted,
                style: TextStyle(
                  fontSize: 9.sp,
                  fontWeight: FontWeight.w500,
                  color: subtextColor,
                  letterSpacing: -0.1,
                  height: 1.1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A subtle pulsating emerald dot indicating live real-time clock
class _PulsingLiveDot extends StatefulWidget {
  const _PulsingLiveDot();

  @override
  State<_PulsingLiveDot> createState() => _PulsingLiveDotState();
}

class _PulsingLiveDotState extends State<_PulsingLiveDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _anim;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, child) {
        return Container(
          width: 7.r,
          height: 7.r,
          decoration: BoxDecoration(
            color: const Color(0xFF10B981),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF10B981)
                    .withValues(alpha: 0.35 + (_anim.value * 0.45)),
                blurRadius: 3 + (_anim.value * 3.5),
                spreadRadius: _anim.value * 1.2,
              ),
            ],
          ),
        );
      },
    );
  }
}
