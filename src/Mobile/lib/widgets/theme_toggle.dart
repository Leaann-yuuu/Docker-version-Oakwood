import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../core/constants/app_colors.dart';
import '../providers/theme_provider.dart';

enum ThemeToggleVariant {
  /// Compact circular/squircle icon button for headers & app bars
  compact,

  /// Pill button with icon and text ("Light" / "Dark")
  pill,

  /// Full-width settings row with title, icon, and animated switch
  expanded,
}

class ThemeToggle extends ConsumerWidget {
  final ThemeToggleVariant variant;
  final VoidCallback? onToggled;

  const ThemeToggle({
    super.key,
    this.variant = ThemeToggleVariant.compact,
    this.onToggled,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark ||
        (themeMode == ThemeMode.system &&
            Theme.of(context).brightness == Brightness.dark);

    void handleToggle() {
      HapticFeedback.lightImpact();
      ref.read(themeModeProvider.notifier).toggleTheme();
      onToggled?.call();
    }

    switch (variant) {
      case ThemeToggleVariant.compact:
        return _buildCompact(context, isDark, handleToggle);
      case ThemeToggleVariant.pill:
        return _buildPill(context, isDark, handleToggle);
      case ThemeToggleVariant.expanded:
        return _buildExpanded(context, isDark, handleToggle);
    }
  }

  /// Compact icon button matching the client portal's compact ThemeToggle
  Widget _buildCompact(
    BuildContext context,
    bool isDark,
    VoidCallback onToggle,
  ) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onToggle,
        borderRadius: BorderRadius.circular(14.r),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: 36.r,
          height: 36.r,
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF13171F).withValues(alpha: 0.90)
                : Colors.white.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(14.r),
            border: Border.all(
              color: isDark
                  ? AppColors.primary.withValues(alpha: 0.50)
                  : AppColors.primary.withValues(alpha: 0.30),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: isDark
                    ? AppColors.primary.withValues(alpha: 0.25)
                    : Colors.black.withValues(alpha: 0.05),
                blurRadius: isDark ? 10 : 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) {
                return RotationTransition(
                  turns: child.key == const ValueKey('moon')
                      ? Tween<double>(begin: -0.2, end: 0.0).animate(anim)
                      : Tween<double>(begin: 0.2, end: 0.0).animate(anim),
                  child: ScaleTransition(scale: anim, child: child),
                );
              },
              child: isDark
                  ? Icon(
                      Icons.nightlight_round,
                      key: const ValueKey('moon'),
                      size: 18.r,
                      color: const Color(0xFF34D399),
                    )
                  : Icon(
                      Icons.wb_sunny_rounded,
                      key: const ValueKey('sun'),
                      size: 18.r,
                      color: const Color(0xFFF59E0B),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  /// Pill button with icon + mode label (fits nicely next to Sign Out button)
  Widget _buildPill(
    BuildContext context,
    bool isDark,
    VoidCallback onToggle,
  ) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onToggle,
        borderRadius: BorderRadius.circular(20.r),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF13171F).withValues(alpha: 0.90)
                : AppColors.surfaceMuted,
            borderRadius: BorderRadius.circular(20.r),
            border: Border.all(
              color: isDark
                  ? AppColors.primary.withValues(alpha: 0.45)
                  : Theme.of(context).dividerColor.withValues(alpha: 0.7),
              width: 1,
            ),
            boxShadow: [
              if (isDark)
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.18),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: isDark
                    ? Icon(
                        Icons.nightlight_round,
                        key: const ValueKey('pill_moon'),
                        size: 14.r,
                        color: const Color(0xFF34D399),
                      )
                    : Icon(
                        Icons.wb_sunny_rounded,
                        key: const ValueKey('pill_sun'),
                        size: 14.r,
                        color: const Color(0xFFF59E0B),
                      ),
              ),
              SizedBox(width: 6.w),
              Text(
                isDark ? 'Dark' : 'Light',
                style: TextStyle(
                  fontSize: 12.sp,
                  fontWeight: FontWeight.w700,
                  color: isDark
                      ? const Color(0xFF34D399)
                      : Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Full-width settings tile matching the web client's expanded ThemeToggle
  Widget _buildExpanded(
    BuildContext context,
    bool isDark,
    VoidCallback onToggle,
  ) {
    return InkWell(
      onTap: onToggle,
      borderRadius: BorderRadius.circular(16.r),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: isDark
              ? const Color(0xFF13171F)
              : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(
            color: isDark
                ? AppColors.primary.withValues(alpha: 0.35)
                : Theme.of(context).dividerColor.withValues(alpha: 0.6),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            // Icon squircle
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 38.r,
              height: 38.r,
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF064E3B).withValues(alpha: 0.6)
                    : AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12.r),
                border: Border.all(
                  color: isDark
                      ? AppColors.primary.withValues(alpha: 0.4)
                      : AppColors.primary.withValues(alpha: 0.25),
                ),
              ),
              child: Center(
                child: isDark
                    ? Icon(
                        Icons.nightlight_round,
                        size: 19.r,
                        color: const Color(0xFF34D399),
                      )
                    : Icon(
                        Icons.wb_sunny_rounded,
                        size: 19.r,
                        color: const Color(0xFFF59E0B),
                      ),
              ),
            ),
            SizedBox(width: 12.w),

            // Labels
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Appearance',
                    style: TextStyle(
                      fontSize: 14.sp,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  SizedBox(height: 2.h),
                  Text(
                    isDark ? 'Dark Mode Active' : 'Light Mode Active',
                    style: TextStyle(
                      fontSize: 11.5.sp,
                      color: isDark
                          ? const Color(0xFF94A3B8)
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            // Custom sliding toggle track
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 52.w,
              height: 28.h,
              padding: EdgeInsets.symmetric(horizontal: 3.w),
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.primary
                    : const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(20.r),
                boxShadow: isDark
                    ? [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: AnimatedAlign(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                alignment: isDark ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 22.r,
                  height: 22.r,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      isDark ? '🌙' : '☀️',
                      style: TextStyle(fontSize: 11.sp),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
