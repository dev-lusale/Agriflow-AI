import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../networking/api_client.dart';
import '../networking/token_store.dart';
import '../services/cache_store.dart';
import '../services/location_service.dart';
import '../services/push_service.dart';
import '../services/sync_queue.dart';
import '../../features/authentication/application/auth_controller.dart';

/// Overridden in main() with initialised instances.
final prefsProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError('SharedPreferences not initialised'));
final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());
final cacheStoreProvider = Provider<CacheStore>((ref) => throw UnimplementedError('CacheStore not initialised'));
final syncQueueProvider = Provider<SyncQueue>((ref) => throw UnimplementedError('SyncQueue not initialised'));
final locationServiceProvider = Provider<LocationService>((ref) => LocationService());
final pushServiceProvider = Provider<PushService>((ref) => PushService());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    ref.watch(tokenStoreProvider),
    onSessionExpired: () => ref.read(authControllerProvider.notifier).sessionExpired(),
  )..deviceName = 'AgriFlow AI Android';
});

/// The account currently signed in on this phone (null when signed out).
/// Every provider that holds a user's data depends on it (through [userApi] or
/// [cachedGet]), so when one person signs out and another signs in, everything loaded for the
/// previous account is discarded and reloaded for the new one.
final sessionUserIdProvider = NotifierProvider<SessionUserId, String?>(SessionUserId.new);

class SessionUserId extends Notifier<String?> {
  @override
  String? build() => null;
  void set(String? id) {
    if (state != id) state = id;
  }
}

/// The API client for a data provider, tied to the signed-in account: the provider reloads
/// whenever a different person signs in (or out). Use this inside every provider that loads data.
/// (Watching the account directly matters: the client object itself never changes, so
/// depending on it alone would not trigger a reload.)
ApiClient userApi(Ref ref) {
  ref.watch(sessionUserIdProvider);
  return ref.watch(apiClientProvider);
}

/// true when the phone reports any network connection.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final c = Connectivity();
  bool isOnline(List<ConnectivityResult> r) => r.any((x) => x != ConnectivityResult.none);
  yield isOnline(await c.checkConnectivity());
  yield* c.onConnectivityChanged.map(isOnline);
});
