import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'core/constants/app_colors.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'providers/theme_provider.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = ref.watch(paletteProvider);
    AppColors.currentPalette = palette;

    return ScreenUtilInit(
      designSize: const Size(390, 844),
      minTextAdapt: true,
      splitScreenMode: true,
      fontSizeResolver: (fontSize, instance) {
        final scale = instance.scaleText;
        final clampedScale = scale > 1.25 ? 1.1 : scale;
        return fontSize * clampedScale;
      },
      builder: (context, child) {
        final activeTheme = AppTheme.forPalette(palette);
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Oakwood Subdivision',
          theme: activeTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: palette.isDark ? ThemeMode.dark : ThemeMode.light,
          initialRoute: AppRouter.splash,
          onGenerateRoute: AppRouter.onGenerateRoute,
        );
      },
    );
  }
}
