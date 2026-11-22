import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_ce_flutter.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/providers/core_providers.dart';
import 'core/routing/app_router.dart';
import 'core/services/cache_store.dart';
import 'core/services/sync_queue.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: AppColors.background,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: AppColors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  await Hive.initFlutter();
  final cache = CacheStore();
  await cache.init();
  final queue = SyncQueue();
  await queue.init();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    // Errors are shown to the user with a retry button; no silent automatic retries.
    retry: (_, _) => null,
    overrides: [
      cacheStoreProvider.overrideWithValue(cache),
      syncQueueProvider.overrideWithValue(queue),
      prefsProvider.overrideWithValue(prefs),
    ],
    child: const AgriFlowApp(),
  ));
}

class AgriFlowApp extends ConsumerWidget {
  const AgriFlowApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'AgriFlow AI',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: ref.watch(routerProvider),
      builder: (context, child) {
        // Respect large-text settings but keep layouts usable.
        final mq = MediaQuery.of(context);
        return MediaQuery(data: mq.copyWith(textScaler: mq.textScaler.clamp(maxScaleFactor: 1.3)), child: child!);
      },
    );
  }
}
