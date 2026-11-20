import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../core/constants/app_colors.dart';
import '../core/utils/toast_helper.dart';
import '../providers/theme_provider.dart';

enum ThemeToggleVariant {
  /// Compact circular/squircle palette button for headers & app bars
  compact,

  /// Pill button with palette icon and active palette name
  pill,

  /// Full-width settings row with title, icon, and palette selector
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

  void _showPaletteSheet(BuildContext context, WidgetRef ref) {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetCtx) => _PalettePickerSheet(
        onSelected: (palette) async {
          HapticFeedback.mediumImpact();
          await ref.read(paletteProvider.notifier).setPalette(palette);
          onToggled?.call();
          if (context.mounted) {
            ToastHelper.showInfo(context, 'Switched to ${palette.displayName}');
          }
        },
      ),
    );
  }

  Future<void> _cycleNextPalette(BuildContext context, WidgetRef ref) async {
    HapticFeedback.lightImpact();
    final next = await ref.read(paletteProvider.notifier).cyclePalette();
    onToggled?.call();
    if (context.mounted) {
      ToastHelper.showInfo(context, 'Switched to ${next.displayName}');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activePalette = ref.watch(paletteProvider);
    final p = AppPaletteColors.of(activePalette);

    switch (variant) {
      case ThemeToggleVariant.compact:
        return _buildCompact(context, ref, p);
      case ThemeToggleVariant.pill:
        return _buildPill(context, ref, p);
      case ThemeToggleVariant.expanded:
        return _buildExpanded(context, ref, p);
    }
  }

  /// Compact frosted circular palette button matching the Oakwood UI Showcase
  Widget _buildCompact(
    BuildContext context,
    WidgetRef ref,
    AppPaletteColors p,
  ) {
    return Tooltip(
      message: 'Switch Theme Palette (${p.palette.displayName})',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showPaletteSheet(context, ref),
          onLongPress: () => _cycleNextPalette(context, ref),
          borderRadius: BorderRadius.circular(18.r),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            width: 34.r,
            height: 34.r,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.20),
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.35),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  Icons.palette_outlined,
                  size: 17.r,
                  color: Colors.white,
                ),
                Positioned(
                  right: 5.r,
                  bottom: 5.r,
                  child: Container(
                    width: 7.r,
                    height: 7.r,
                    decoration: BoxDecoration(
                      color: p.swatchDotColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.2),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Pill button with palette dot + active palette name
  Widget _buildPill(
    BuildContext context,
    WidgetRef ref,
    AppPaletteColors p,
  ) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _showPaletteSheet(context, ref),
        onLongPress: () => _cycleNextPalette(context, ref),
        borderRadius: BorderRadius.circular(20.r),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
          decoration: BoxDecoration(
            color: p.isDark
                ? const Color(0xFF131B2E).withValues(alpha: 0.92)
                : p.bgSubtle,
            borderRadius: BorderRadius.circular(20.r),
            border: Border.all(
              color: p.isDark
                  ? p.accent.withValues(alpha: 0.45)
                  : p.borderSubtle,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 9.r,
                height: 9.r,
                decoration: BoxDecoration(
                  color: p.swatchDotColor,
                  shape: BoxShape.circle,
                ),
              ),
              SizedBox(width: 6.w),
              Text(
                p.palette.displayName,
                style: TextStyle(
                  fontSize: 11.5.sp,
                  fontWeight: FontWeight.w700,
                  color: p.textMain,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Full-width settings tile
  Widget _buildExpanded(
    BuildContext context,
    WidgetRef ref,
    AppPaletteColors p,
  ) {
    return InkWell(
      onTap: () => _showPaletteSheet(context, ref),
      borderRadius: BorderRadius.circular(16.r),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
        decoration: BoxDecoration(
          color: p.bgSubtle,
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(
            color: p.borderSubtle,
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 38.r,
              height: 38.r,
              decoration: BoxDecoration(
                color: p.accentSoft,
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Center(
                child: Icon(
                  Icons.palette_outlined,
                  size: 19.r,
                  color: p.accentText,
                ),
              ),
            ),
            SizedBox(width: 12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Color Palette',
                    style: TextStyle(
                      fontSize: 14.sp,
                      fontWeight: FontWeight.bold,
                      color: p.textMain,
                    ),
                  ),
                  SizedBox(height: 2.h),
                  Text(
                    '${p.palette.displayName} · ${p.palette.subtitle}',
                    style: TextStyle(
                      fontSize: 11.5.sp,
                      color: p.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: p.textMuted,
              size: 20.r,
            ),
          ],
        ),
      ),
    );
  }
}

class _PalettePickerSheet extends ConsumerWidget {
  final ValueChanged<AppPalette> onSelected;

  const _PalettePickerSheet({required this.onSelected});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activePalette = ref.watch(paletteProvider);
    final activeColors = AppPaletteColors.of(activePalette);

    return Container(
      padding: EdgeInsets.fromLTRB(20.w, 12.h, 20.w, 28.h),
      decoration: BoxDecoration(
        color: activeColors.bgCard,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28.r)),
        border: Border.all(color: activeColors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 30,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40.w,
                height: 4.h,
                decoration: BoxDecoration(
                  color: activeColors.textMuted.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(4.r),
                ),
              ),
            ),
            SizedBox(height: 16.h),
            Row(
              children: [
                Container(
                  width: 38.r,
                  height: 38.r,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [activeColors.heroFrom, activeColors.heroTo],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                  child: Icon(
                    Icons.shield_rounded,
                    color: activeColors.isDark
                        ? activeColors.accent
                        : Colors.white,
                    size: 19.r,
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Oakwood Gate Access',
                        style: TextStyle(
                          fontSize: 16.sp,
                          fontWeight: FontWeight.w800,
                          color: activeColors.textMain,
                          letterSpacing: -0.3,
                        ),
                      ),
                      Text(
                        'UI Redesign · 4 Curated Color Palettes',
                        style: TextStyle(
                          fontSize: 11.5.sp,
                          fontWeight: FontWeight.w500,
                          color: activeColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(
                    Icons.close_rounded,
                    color: activeColors.textMuted,
                    size: 20.r,
                  ),
                ),
              ],
            ),
            SizedBox(height: 16.h),
            ...AppPalette.values.asMap().entries.map((entry) {
              final idx = entry.key + 1;
              final palette = entry.value;
              final p = AppPaletteColors.of(palette);
              final isSelected = palette == activePalette;

              return Padding(
                padding: EdgeInsets.only(bottom: 10.h),
                child: InkWell(
                  borderRadius: BorderRadius.circular(18.r),
                  onTap: () {
                    Navigator.of(context).pop();
                    onSelected(palette);
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    padding:
                        EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? activeColors.notifUnreadBg
                          : activeColors.bgSubtle,
                      borderRadius: BorderRadius.circular(18.r),
                      border: Border.all(
                        color: isSelected
                            ? activeColors.accent
                            : activeColors.borderSubtle,
                        width: isSelected ? 1.6 : 1.0,
                      ),
                    ),
                    child: Row(
                      children: [
                        // Palette preview swatch
                        Container(
                          width: 44.r,
                          height: 44.r,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [p.heroFrom, p.heroTo],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(13.r),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Center(
                            child: Container(
                              width: 14.r,
                              height: 14.r,
                              decoration: BoxDecoration(
                                color: p.swatchDotColor,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 2),
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: 13.w),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '$idx. ${palette.displayName}',
                                    style: TextStyle(
                                      fontSize: 13.5.sp,
                                      fontWeight: FontWeight.w800,
                                      color: activeColors.textMain,
                                    ),
                                  ),
                                  if (palette.isDark) ...[
                                    SizedBox(width: 6.w),
                                    Container(
                                      padding: EdgeInsets.symmetric(
                                        horizontal: 6.w,
                                        vertical: 1.5.h,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF0F172A),
                                        borderRadius:
                                            BorderRadius.circular(6.r),
                                        border: Border.all(
                                          color: const Color(0xFFF59E0B)
                                              .withValues(alpha: 0.5),
                                        ),
                                      ),
                                      child: Text(
                                        'DARK',
                                        style: TextStyle(
                                          fontSize: 8.5.sp,
                                          fontWeight: FontWeight.w800,
                                          color: const Color(0xFFFBBF24),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              SizedBox(height: 2.5.h),
                              Text(
                                palette.subtitle,
                                style: TextStyle(
                                  fontSize: 11.sp,
                                  color: activeColors.textMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          Container(
                            padding: EdgeInsets.all(5.r),
                            decoration: BoxDecoration(
                              color: activeColors.accent,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.check_rounded,
                              size: 14.r,
                              color: activeColors.isDark
                                  ? const Color(0xFF0F172A)
                                  : Colors.white,
                            ),
                          )
                        else
                          Icon(
                            Icons.chevron_right_rounded,
                            color: activeColors.textMuted,
                            size: 18.r,
                          ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
