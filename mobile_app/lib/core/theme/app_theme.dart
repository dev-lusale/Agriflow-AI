import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'app_colors.dart';

const kFont = 'PlusJakartaSans';
const kRadius = 12.0;
const kBorderWidth = 1.6;

/// Hard, offset "sticker" shadow used under important buttons and cards.
List<BoxShadow> hardShadow([double dx = 3, double dy = 4]) =>
    [BoxShadow(color: AppColors.ink, offset: Offset(dx, dy), blurRadius: 0)];

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.coral, brightness: Brightness.light).copyWith(
    primary: AppColors.coral,
    onPrimary: AppColors.white,
    secondary: AppColors.ink,
    onSecondary: AppColors.white,
    surface: AppColors.background,
    onSurface: AppColors.ink,
    error: AppColors.danger,
    outline: AppColors.ink,
    outlineVariant: AppColors.divider,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: kFont, scaffoldBackgroundColor: AppColors.background);
  final text = base.textTheme.apply(bodyColor: AppColors.ink, displayColor: AppColors.ink, fontFamily: kFont).copyWith(
        headlineLarge: const TextStyle(fontFamily: kFont, fontSize: 30, fontWeight: FontWeight.w800, height: 1.15, color: AppColors.ink, letterSpacing: -0.5),
        headlineMedium: const TextStyle(fontFamily: kFont, fontSize: 24, fontWeight: FontWeight.w800, height: 1.2, color: AppColors.ink, letterSpacing: -0.3),
        titleLarge: const TextStyle(fontFamily: kFont, fontSize: 19, fontWeight: FontWeight.w800, color: AppColors.ink),
        titleMedium: const TextStyle(fontFamily: kFont, fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink),
        titleSmall: const TextStyle(fontFamily: kFont, fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.ink),
        bodyLarge: const TextStyle(fontFamily: kFont, fontSize: 16, height: 1.45, color: AppColors.ink),
        bodyMedium: const TextStyle(fontFamily: kFont, fontSize: 14.5, height: 1.45, color: AppColors.ink),
        bodySmall: const TextStyle(fontFamily: kFont, fontSize: 12.5, height: 1.4, color: AppColors.muted),
        labelLarge: const TextStyle(fontFamily: kFont, fontSize: 15, fontWeight: FontWeight.w700),
      );
  OutlineInputBorder border(Color c, [double w = kBorderWidth]) =>
      OutlineInputBorder(borderRadius: BorderRadius.circular(kRadius), borderSide: BorderSide(color: c, width: w));
  return base.copyWith(
    textTheme: text,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontFamily: kFont, fontSize: 19, fontWeight: FontWeight.w800, color: AppColors.ink),
      systemOverlayStyle: SystemUiOverlayStyle(statusBarColor: AppColors.background, statusBarIconBrightness: Brightness.dark),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: border(AppColors.ink),
      enabledBorder: border(AppColors.ink),
      focusedBorder: border(AppColors.coral, 2),
      errorBorder: border(AppColors.danger),
      focusedErrorBorder: border(AppColors.danger, 2),
      disabledBorder: border(AppColors.divider),
      hintStyle: const TextStyle(color: AppColors.muted, fontFamily: kFont),
      errorStyle: const TextStyle(color: AppColors.danger, fontFamily: kFont, fontSize: 12.5),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.divider, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.ink,
      contentTextStyle: const TextStyle(fontFamily: kFont, color: AppColors.white, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadius)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.white,
      selectedColor: AppColors.coralSoft,
      side: const BorderSide(color: AppColors.ink, width: 1.2),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      labelStyle: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w600, color: AppColors.ink, fontSize: 13),
      checkmarkColor: AppColors.coral,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.white,
      indicatorColor: AppColors.coralSoft,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontFamily: kFont,
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
            color: s.contains(WidgetState.selected) ? AppColors.coral : AppColors.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? AppColors.coral : AppColors.muted, size: 24)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.background,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.coral),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.white : AppColors.muted),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.coral : AppColors.divider),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.coral : AppColors.white),
      side: const BorderSide(color: AppColors.ink, width: 1.6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
    ),
    tabBarTheme: const TabBarThemeData(
      labelColor: AppColors.ink,
      unselectedLabelColor: AppColors.muted,
      indicatorColor: AppColors.coral,
      labelStyle: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, fontSize: 14),
      unselectedLabelStyle: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w600, fontSize: 14),
    ),
  );
}
