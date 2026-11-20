import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/app_colors.dart';
import '../core/storage/secure_storage.dart';

class PaletteNotifier extends Notifier<AppPalette> {
  final SecureStorage _storage = SecureStorage();

  @override
  AppPalette build() {
    _loadPersistedPalette();
    return AppColors.currentPalette;
  }

  Future<void> _loadPersistedPalette() async {
    try {
      final savedPalette = await _storage.getPalette();
      if (savedPalette != null && savedPalette.isNotEmpty) {
        final palette = AppPalette.fromString(savedPalette);
        AppColors.currentPalette = palette;
        state = palette;
        return;
      }
      final savedMode = await _storage.getThemeMode();
      if (savedMode == 'dark') {
        AppColors.currentPalette = AppPalette.obsidian;
        state = AppPalette.obsidian;
      }
    } catch (_) {}
  }

  Future<void> setPalette(AppPalette palette) async {
    AppColors.currentPalette = palette;
    state = palette;
    try {
      await _storage.savePalette(palette.key);
      await _storage.saveThemeMode(palette.isDark ? 'dark' : 'light');
    } catch (_) {}
  }

  Future<AppPalette> cyclePalette() async {
    final next = state.next;
    await setPalette(next);
    return next;
  }
}

final paletteProvider =
    NotifierProvider<PaletteNotifier, AppPalette>(PaletteNotifier.new);

class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    final palette = ref.watch(paletteProvider);
    return palette.isDark ? ThemeMode.dark : ThemeMode.light;
  }

  Future<void> toggleTheme() async {
    await ref.read(paletteProvider.notifier).cyclePalette();
  }

  Future<void> setTheme(ThemeMode mode) async {
    final current = ref.read(paletteProvider);
    if (mode == ThemeMode.dark && !current.isDark) {
      await ref.read(paletteProvider.notifier).setPalette(AppPalette.obsidian);
    } else if (mode == ThemeMode.light && current.isDark) {
      await ref.read(paletteProvider.notifier).setPalette(AppPalette.cobalt);
    }
  }
}

final themeModeProvider =
    NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);
