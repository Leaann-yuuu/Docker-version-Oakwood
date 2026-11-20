import 'package:flutter/material.dart';

/// The 4 Oakwood Gate Access UI Palettes from the showcase.
enum AppPalette {
  cobalt,
  terracotta,
  obsidian,
  teal;

  String get key => name;

  String get displayName {
    switch (this) {
      case AppPalette.cobalt:
        return 'Royal Cobalt';
      case AppPalette.terracotta:
        return 'Terracotta & Sand';
      case AppPalette.obsidian:
        return 'Obsidian & Gold';
      case AppPalette.teal:
        return 'Ocean Teal';
    }
  }

  String get subtitle {
    switch (this) {
      case AppPalette.cobalt:
        return 'Trustworthy · Crisp · Executive';
      case AppPalette.terracotta:
        return 'Architectural · Warm · Welcoming';
      case AppPalette.obsidian:
        return 'Luxury · High-Contrast · Night Guard';
      case AppPalette.teal:
        return 'Modern · Coastal · Energetic';
    }
  }

  bool get isDark => this == AppPalette.obsidian;

  AppPalette get next {
    final values = AppPalette.values;
    return values[(index + 1) % values.length];
  }

  static AppPalette fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'terracotta':
        return AppPalette.terracotta;
      case 'obsidian':
      case 'dark':
        return AppPalette.obsidian;
      case 'teal':
        return AppPalette.teal;
      case 'cobalt':
      case 'light':
      default:
        return AppPalette.cobalt;
    }
  }
}

/// Complete semantic color tokens for each of the 4 Oakwood palettes.
class AppPaletteColors {
  final AppPalette palette;
  final bool isDark;

  // Core Surfaces
  final Color bgApp;
  final Color bgCard;
  final Color bgSubtle;

  // Hero Gradient
  final Color heroFrom;
  final Color heroTo;

  // Accents
  final Color accent;
  final Color accentSoft;
  final Color accentText;

  // Typography & Borders
  final Color textMain;
  final Color textMuted;
  final Color borderSubtle;

  // Bottom Navigation
  final Color navBg;
  final Color navBadgeDot;

  // Notifications
  final Color notifUnreadBg;
  final Color notifUnreadBorder;
  final Color notifIconBg;
  final Color notifIconColor;
  final Color unreadDot;

  // Status Pills
  final Color authorizedPillBg;
  final Color authorizedPillText;
  final Color exitPillBg;
  final Color exitPillText;

  // Profile & Auth
  final Color avatarBg;
  final List<Color> loginBgColors;
  final Color loginCardBg;
  final Color loginCardBorder;
  final Color loginBtnBg;
  final Color loginBtnText;
  final Color swatchDotColor;

  const AppPaletteColors({
    required this.palette,
    required this.isDark,
    required this.bgApp,
    required this.bgCard,
    required this.bgSubtle,
    required this.heroFrom,
    required this.heroTo,
    required this.accent,
    required this.accentSoft,
    required this.accentText,
    required this.textMain,
    required this.textMuted,
    required this.borderSubtle,
    required this.navBg,
    required this.navBadgeDot,
    required this.notifUnreadBg,
    required this.notifUnreadBorder,
    required this.notifIconBg,
    required this.notifIconColor,
    required this.unreadDot,
    required this.authorizedPillBg,
    required this.authorizedPillText,
    required this.exitPillBg,
    required this.exitPillText,
    required this.avatarBg,
    required this.loginBgColors,
    required this.loginCardBg,
    required this.loginCardBorder,
    required this.loginBtnBg,
    required this.loginBtnText,
    required this.swatchDotColor,
  });

  /// 1. Royal Cobalt (Executive Navy & Ice Blue — Light)
  static const cobalt = AppPaletteColors(
    palette: AppPalette.cobalt,
    isDark: false,
    bgApp: Color(0xFFF4F7FB),
    bgCard: Color(0xFFFFFFFF),
    bgSubtle: Color(0xFFEEF3FA),
    heroFrom: Color(0xFF1E3A8A),
    heroTo: Color(0xFF1D4ED8),
    accent: Color(0xFF1D4ED8),
    accentSoft: Color(0xFFDBEAFE),
    accentText: Color(0xFF1E40AF),
    textMain: Color(0xFF0F172A),
    textMuted: Color(0xFF64748B),
    borderSubtle: Color(0xFFE2E8F0),
    navBg: Color(0xF2FFFFFF),
    navBadgeDot: Color(0xFFF43F5E),
    notifUnreadBg: Color(0xFFEFF6FF),
    notifUnreadBorder: Color(0xFFBFDBFE),
    notifIconBg: Color(0xFFDBEAFE),
    notifIconColor: Color(0xFF1D4ED8),
    unreadDot: Color(0xFF1D4ED8),
    authorizedPillBg: Color(0xFFDCFCE7),
    authorizedPillText: Color(0xFF15803D),
    exitPillBg: Color(0xFFDBEAFE),
    exitPillText: Color(0xFF1E40AF),
    avatarBg: Color(0xFF1E3A8A),
    loginBgColors: [
      Color(0xFF0F172A),
      Color(0xFF1E3A8A),
      Color(0xFF172554),
    ],
    loginCardBg: Color(0x521E3A8A),
    loginCardBorder: Color(0x4093C5FD),
    loginBtnBg: Color(0xFFFFFFFF),
    loginBtnText: Color(0xFF1E3A8A),
    swatchDotColor: Color(0xFF2563EB),
  );

  /// 2. Terracotta & Sand (Warm Architectural — Light)
  static const terracotta = AppPaletteColors(
    palette: AppPalette.terracotta,
    isDark: false,
    bgApp: Color(0xFFFAF7F2),
    bgCard: Color(0xFFFFFFFF),
    bgSubtle: Color(0xFFF5EFE6),
    heroFrom: Color(0xFF9A3412),
    heroTo: Color(0xFFB45309),
    accent: Color(0xFFB45309),
    accentSoft: Color(0xFFFEF3C7),
    accentText: Color(0xFF92400E),
    textMain: Color(0xFF1C1917),
    textMuted: Color(0xFF78716C),
    borderSubtle: Color(0xFFE7E0D5),
    navBg: Color(0xF2FFFFFF),
    navBadgeDot: Color(0xFFDC2626),
    notifUnreadBg: Color(0xFFFFFBEB),
    notifUnreadBorder: Color(0xFFFDE68A),
    notifIconBg: Color(0xFFFEF3C7),
    notifIconColor: Color(0xFFB45309),
    unreadDot: Color(0xFFB45309),
    authorizedPillBg: Color(0xFFECFDF5),
    authorizedPillText: Color(0xFF065F46),
    exitPillBg: Color(0xFFFEF3C7),
    exitPillText: Color(0xFF92400E),
    avatarBg: Color(0xFF9A3412),
    loginBgColors: [
      Color(0xFF291811),
      Color(0xFF7C2D12),
      Color(0xFF1C1917),
    ],
    loginCardBg: Color(0x547C2D12),
    loginCardBorder: Color(0x40FDBA74),
    loginBtnBg: Color(0xFFFFFBEB),
    loginBtnText: Color(0xFF7C2D12),
    swatchDotColor: Color(0xFFD97706),
  );

  /// 3. Obsidian & Gold (Luxury Dark Mode — Dark)
  static const obsidian = AppPaletteColors(
    palette: AppPalette.obsidian,
    isDark: true,
    bgApp: Color(0xFF0B0F17),
    bgCard: Color(0xFF131B2E),
    bgSubtle: Color(0xFF19233C),
    heroFrom: Color(0xFF0F172A),
    heroTo: Color(0xFF1E293B),
    accent: Color(0xFFF59E0B),
    accentSoft: Color(0x29F59E0B),
    accentText: Color(0xFFFBBF24),
    textMain: Color(0xFFF8FAFC),
    textMuted: Color(0xFF94A3B8),
    borderSubtle: Color(0xFF1E293B),
    navBg: Color(0xF2131B2E),
    navBadgeDot: Color(0xFFF59E0B),
    notifUnreadBg: Color(0xFF172036),
    notifUnreadBorder: Color(0x59F59E0B),
    notifIconBg: Color(0x26F59E0B),
    notifIconColor: Color(0xFFFBBF24),
    unreadDot: Color(0xFFF59E0B),
    authorizedPillBg: Color(0x2610B981),
    authorizedPillText: Color(0xFF6EE7B7),
    exitPillBg: Color(0x26F59E0B),
    exitPillText: Color(0xFFFCD34D),
    avatarBg: Color(0xFF1E293B),
    loginBgColors: [
      Color(0xFF070A10),
      Color(0xFF131B2E),
      Color(0xFF1C1917),
    ],
    loginCardBg: Color(0xB80F172A),
    loginCardBorder: Color(0x4DF59E0B),
    loginBtnBg: Color(0xFFF59E0B),
    loginBtnText: Color(0xFF0F172A),
    swatchDotColor: Color(0xFFF59E0B),
  );

  /// 4. Ocean Teal (Coastal Modern — Light)
  static const teal = AppPaletteColors(
    palette: AppPalette.teal,
    isDark: false,
    bgApp: Color(0xFFF3F9F9),
    bgCard: Color(0xFFFFFFFF),
    bgSubtle: Color(0xFFE6F4F4),
    heroFrom: Color(0xFF115E59),
    heroTo: Color(0xFF0F766E),
    accent: Color(0xFF0F766E),
    accentSoft: Color(0xFFCCFBF1),
    accentText: Color(0xFF0F766E),
    textMain: Color(0xFF0F172A),
    textMuted: Color(0xFF526666),
    borderSubtle: Color(0xFFD5E8E8),
    navBg: Color(0xF2FFFFFF),
    navBadgeDot: Color(0xFFFF6B57),
    notifUnreadBg: Color(0xFFF0FDFA),
    notifUnreadBorder: Color(0xFF99F6E4),
    notifIconBg: Color(0xFFCCFBF1),
    notifIconColor: Color(0xFF0F766E),
    unreadDot: Color(0xFFFF6B57),
    authorizedPillBg: Color(0xFFCCFBF1),
    authorizedPillText: Color(0xFF0F766E),
    exitPillBg: Color(0xFFFFE4E1),
    exitPillText: Color(0xFFE11D48),
    avatarBg: Color(0xFF115E59),
    loginBgColors: [
      Color(0xFF082F2C),
      Color(0xFF115E59),
      Color(0xFF0F172A),
    ],
    loginCardBg: Color(0x52134E4A),
    loginCardBorder: Color(0x475EEAD4),
    loginBtnBg: Color(0xFFFFFFFF),
    loginBtnText: Color(0xFF115E59),
    swatchDotColor: Color(0xFF14B8A6),
  );

  static AppPaletteColors of(AppPalette palette) {
    switch (palette) {
      case AppPalette.cobalt:
        return cobalt;
      case AppPalette.terracotta:
        return terracotta;
      case AppPalette.obsidian:
        return obsidian;
      case AppPalette.teal:
        return teal;
    }
  }
}

class AppColors {
  AppColors._();

  static AppPalette _currentPalette = AppPalette.cobalt;

  static AppPalette get currentPalette => _currentPalette;

  static set currentPalette(AppPalette palette) {
    _currentPalette = palette;
  }

  static AppPaletteColors get palette => AppPaletteColors.of(_currentPalette);

  // Dynamic getters backed by the active palette
  static Color get primary => palette.accent;
  static Color get primaryDark => palette.heroFrom;
  static Color get primaryLight => palette.accentSoft;
  static Color get primarySubtle => palette.notifUnreadBg;

  static Color get secondary => palette.heroTo;
  static Color get secondaryDark => palette.heroFrom;

  // Neutrals — Active Palette Surfaces
  static Color get background => palette.bgApp;
  static Color get surface => palette.bgCard;
  static Color get surfaceMuted => palette.bgSubtle;
  static Color get divider => palette.borderSubtle;

  // Neutrals — Dark / Obsidian reference
  static const Color backgroundDark = Color(0xFF0B0F17);
  static const Color surfaceDark = Color(0xFF131B2E);
  static const Color surfaceDarkElevated = Color(0xFF19233C);
  static const Color dividerDark = Color(0xFF1E293B);

  // Text
  static Color get textPrimary => palette.textMain;
  static Color get textSecondary => palette.textMuted;
  static Color get textMuted => palette.textMuted;
  static const Color textPrimaryDark = Color(0xFFF8FAFC);
  static const Color textSecondaryDark = Color(0xFF94A3B8);
  static const Color textOnPrimary = Colors.white;

  // Status
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFD97706);
  static const Color error = Color(0xFFDC2626);
  static const Color info = Color(0xFF0284C7);
}
