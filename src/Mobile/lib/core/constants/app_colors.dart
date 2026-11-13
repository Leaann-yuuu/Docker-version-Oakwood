import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Fresh Forest / Oakwood Emerald
  static const Color primary = Color(0xFF15803D);       // Deep emerald green
  static const Color primaryDark = Color(0xFF14532D);   // Dark forest green
  static const Color primaryLight = Color(0xFFDCFCE7);  // Soft mint tint (#DCFCE7)
  static const Color primarySubtle = Color(0xFFF0FDF4); // Ultra light mint

  static const Color secondary = Color(0xFF16A34A);     // Vibrant leaf green
  static const Color secondaryLight = Color(0xFFBBF7D0);

  // Background & Surfaces
  static const Color background = Color(0xFFF8FAF8);    // Off-white with faint sage tint
  static const Color surface = Color(0xFFFFFFFF);       // Crisp pure white
  static const Color surfaceMuted = Color(0xFFF1F5F9);  // Input & chip grey tint
  static const Color divider = Color(0xFFE2E8F0);       // Soft border / separator

  // Accents (Warm Peach & Amber tags from mockup)
  static const Color accentPeach = Color(0xFFFFEDD5);   // Warm peach container
  static const Color accentOrange = Color(0xFFEA580C);  // Coral/orange accent text
  static const Color accentSky = Color(0xFFE0F2FE);     // Light sky container

  // Typography
  static const Color textPrimary = Color(0xFF0F172A);   // Slate 900
  static const Color textSecondary = Color(0xFF64748B); // Slate 500
  static const Color textMuted = Color(0xFF94A3B8);     // Slate 400
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // Status Indicators
  static const Color success = Color(0xFF16A34A);
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF0284C7);
}
