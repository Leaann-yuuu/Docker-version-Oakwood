import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants/app_colors.dart';

class AppTheme {
  AppTheme._();

  // Font Family — Plus Jakarta Sans (matching Oakwood UI showcase)
  static String get _fontFamily => GoogleFonts.plusJakartaSans().fontFamily!;

  static ThemeData forPalette(AppPalette palette) {
    final p = AppPaletteColors.of(palette);
    return p.isDark ? _buildDarkTheme(p) : _buildLightTheme(p);
  }

  static ThemeData get lightTheme =>
      _buildLightTheme(AppPaletteColors.of(AppColors.currentPalette.isDark
          ? AppPalette.cobalt
          : AppColors.currentPalette));

  static ThemeData get darkTheme => _buildDarkTheme(AppPaletteColors.obsidian);

  static ThemeData _buildLightTheme(AppPaletteColors p) => ThemeData(
        useMaterial3: true,
        fontFamily: _fontFamily,
        brightness: Brightness.light,

        // ── Colors ──
        colorScheme: ColorScheme.fromSeed(
          seedColor: p.accent,
          brightness: Brightness.light,
          primary: p.accent,
          secondary: p.heroTo,
          error: AppColors.error,
          surface: p.bgCard,
          onSurface: p.textMain,
          onSurfaceVariant: p.textMuted,
          onPrimary: Colors.white,
        ),
        scaffoldBackgroundColor: p.bgApp,
        cardColor: p.bgCard,
        dividerColor: p.borderSubtle,

        // ── AppBar ──
        appBarTheme: AppBarTheme(
          backgroundColor: p.heroFrom,
          foregroundColor: Colors.white,
          centerTitle: true,
          elevation: 0,
        ),

        // ── Text ──
        textTheme: TextTheme(
          headlineLarge: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: p.textMain,
          ),
          headlineMedium: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: p.textMain,
          ),
          titleLarge: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: p.textMain,
          ),
          bodyLarge: TextStyle(fontSize: 16, color: p.textMain),
          bodyMedium: TextStyle(fontSize: 14, color: p.textMuted),
          labelLarge: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),

        // ── Elevated Button ──
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: p.accent,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            elevation: 0,
          ),
        ),

        // ── Outlined Button ──
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: p.accent,
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            side: BorderSide(color: p.accent, width: 1.5),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),

        // ── Input Decoration ──
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: p.bgSubtle,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide(color: p.borderSubtle),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide(color: p.borderSubtle),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide(color: p.accent, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: const BorderSide(color: AppColors.error),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: const BorderSide(color: AppColors.error, width: 2),
          ),
          hintStyle: TextStyle(color: p.textMuted, fontSize: 14),
          errorStyle: const TextStyle(color: AppColors.error, fontSize: 12),
        ),

        // ── Card ──
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: p.borderSubtle, width: 1),
          ),
          color: p.bgCard,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        ),

        // ── Bottom Navigation Bar ──
        bottomNavigationBarTheme: BottomNavigationBarThemeData(
          backgroundColor: p.bgCard,
          selectedItemColor: p.accent,
          unselectedItemColor: p.textMuted,
          type: BottomNavigationBarType.fixed,
          elevation: 8,
          showUnselectedLabels: true,
        ),

        // ── SnackBar ──
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),

        // ── Divider ──
        dividerTheme: DividerThemeData(
          color: p.borderSubtle,
          thickness: 1,
        ),
      );

  static ThemeData _buildDarkTheme(AppPaletteColors p) => ThemeData(
        useMaterial3: true,
        fontFamily: _fontFamily,
        brightness: Brightness.dark,

        // ── Colors ──
        colorScheme: ColorScheme.fromSeed(
          seedColor: p.accent,
          brightness: Brightness.dark,
          primary: p.accent,
          secondary: p.heroTo,
          error: AppColors.error,
          surface: p.bgCard,
          onSurface: p.textMain,
          onSurfaceVariant: p.textMuted,
          onPrimary: const Color(0xFF0F172A),
        ),
        scaffoldBackgroundColor: p.bgApp,
        cardColor: p.bgCard,
        dividerColor: p.borderSubtle,

        // ── AppBar ──
        appBarTheme: AppBarTheme(
          backgroundColor: p.heroFrom,
          foregroundColor: Colors.white,
          centerTitle: true,
          elevation: 0,
        ),

        // ── Text ──
        textTheme: TextTheme(
          headlineLarge: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: p.textMain,
          ),
          headlineMedium: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: p.textMain,
          ),
          headlineSmall: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: p.textMain,
          ),
          titleLarge: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: p.textMain,
          ),
          titleMedium: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: p.textMain,
          ),
          titleSmall: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFFE2E8F0),
          ),
          bodyLarge: TextStyle(fontSize: 16, color: p.textMain),
          bodyMedium: TextStyle(fontSize: 14, color: p.textMuted),
          bodySmall: TextStyle(fontSize: 12, color: p.textMuted),
          labelLarge: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
          labelMedium: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: p.textMuted,
          ),
          labelSmall: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: p.textMuted,
          ),
        ),

        // ── ListTile ──
        listTileTheme: ListTileThemeData(
          iconColor: p.textMuted,
          textColor: p.textMain,
        ),

        // ── Dialog ──
        dialogTheme: DialogThemeData(
          backgroundColor: p.bgCard,
          titleTextStyle: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: p.textMain,
          ),
          contentTextStyle: TextStyle(
            fontSize: 14,
            color: p.textMuted,
          ),
        ),

        // ── Elevated Button ──
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: p.accent,
            foregroundColor: const Color(0xFF0F172A),
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            textStyle:
                const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            elevation: 0,
          ),
        ),

        // ── Outlined Button ──
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: p.accent,
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            side: BorderSide(color: p.accent, width: 1.5),
          ),
        ),

        // ── Input Decoration ──
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: p.bgSubtle,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide(color: p.borderSubtle),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide(color: p.borderSubtle),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: BorderSide(color: p.accent, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: const BorderSide(color: AppColors.error),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(20),
            borderSide: const BorderSide(color: AppColors.error, width: 2),
          ),
          hintStyle: TextStyle(color: p.textMuted, fontSize: 14),
          errorStyle: const TextStyle(color: AppColors.error, fontSize: 12),
        ),

        // ── Card ──
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: p.borderSubtle, width: 1),
          ),
          color: p.bgCard,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        ),

        // ── Bottom Navigation Bar ──
        bottomNavigationBarTheme: BottomNavigationBarThemeData(
          backgroundColor: p.bgCard,
          selectedItemColor: p.accent,
          unselectedItemColor: p.textMuted,
          type: BottomNavigationBarType.fixed,
          elevation: 8,
          showUnselectedLabels: true,
        ),

        // ── FAB ──
        floatingActionButtonTheme: FloatingActionButtonThemeData(
          backgroundColor: p.accent,
          foregroundColor: const Color(0xFF0F172A),
        ),

        // ── SnackBar ──
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),

        // ── Divider ──
        dividerTheme: DividerThemeData(color: p.borderSubtle, thickness: 1),
      );
}
