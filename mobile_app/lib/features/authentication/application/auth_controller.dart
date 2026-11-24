import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/networking/api_exception.dart';
import '../../../core/providers/core_providers.dart';
import '../../../core/utils/json.dart';
import '../../../models/app_user.dart';
import '../data/auth_repository.dart';

enum AuthStatus { unknown, signedOut, signedIn }

@immutable
class AuthState {
  const AuthState(this.status, {this.user, this.offline = false, this.notice});
  final AuthStatus status;
  final AppUser? user;
  /// Signed in from the saved profile while the server could not be reached.
  final bool offline;
  final String? notice;
}

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository(ref.watch(apiClientProvider)));

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  static const _meCacheKey = 'me';

  Timer? _reconnectTimer;
  AppLifecycleListener? _lifecycle;

  @override
  AuthState build() {
    ref.onDispose(() {
      _reconnectTimer?.cancel();
      _lifecycle?.dispose();
    });
    Future.microtask(_restore);
    return const AuthState(AuthStatus.unknown);
  }

  /// While signed in from the saved profile, keep checking the server: every 30 seconds and
  /// whenever the app comes back to the foreground. The first answer switches back to live data.
  void _startReconnecting() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer.periodic(const Duration(seconds: 30), (_) => tryReconnect());
    _lifecycle ??= AppLifecycleListener(onResume: tryReconnect);
  }

  bool _reconnecting = false;

  /// Returns true when the server answered and the app is live again.
  Future<bool> tryReconnect() async {
    if (!state.offline || _reconnecting) return !state.offline;
    _reconnecting = true;
    try {
      await _signedIn(await _repo.me());
      _reconnectTimer?.cancel();
      return true;
    } on ApiException catch (e) {
      if (!e.isNetwork && e.isUnauthenticated) {
        _reconnectTimer?.cancel();
        await ref.read(tokenStoreProvider).clear();
        state = const AuthState(AuthStatus.signedOut);
      }
      return false;
    } finally {
      _reconnecting = false;
    }
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  Future<void> _restore() async {
    final tokens = ref.read(tokenStoreProvider);
    await tokens.load();
    if (!tokens.hasSession) {
      state = const AuthState(AuthStatus.signedOut);
      return;
    }
    try {
      await _signedIn(await _repo.me());
    } on ApiException catch (e) {
      if (e.isNetwork) {
        // Offline start: use the last profile saved on this phone.
        final cache = ref.read(cacheStoreProvider);
        final userId = _savedUserId();
        cache.setScope(userId);
        final cached = cache.get(_meCacheKey);
        if (cached != null) {
          _scope(userId);
          state = AuthState(AuthStatus.signedIn, user: AppUser(asJson(cached.data)), offline: true);
          _startReconnecting();
          return;
        }
      }
      await tokens.clear();
      state = const AuthState(AuthStatus.signedOut);
    }
  }

  static const _kLastUser = 'last_user_id';
  String? _savedUserId() => ref.read(prefsProvider).getString(_kLastUser);

  void _scope(String? userId) {
    final prefs = ref.read(prefsProvider);
    userId == null ? prefs.remove(_kLastUser) : prefs.setString(_kLastUser, userId);
    ref.read(cacheStoreProvider).setScope(userId);
    ref.read(syncQueueProvider).setScope(userId);
    // Discards everything loaded for any previous account on this phone.
    ref.read(sessionUserIdProvider.notifier).set(userId);
  }

  Future<void> _signedIn(Json me) async {
    final user = AppUser(me);
    _scope(user.id);
    await ref.read(cacheStoreProvider).put(_meCacheKey, me);
    state = AuthState(AuthStatus.signedIn, user: user);
    // Push registration is best-effort and only when configured.
    ref.read(pushServiceProvider).register(ref.read(apiClientProvider));
  }

  Future<void> login(String email, String password) async {
    final res = await _repo.login(email.trim(), password);
    await _signedIn(asJson(res['user']));
  }

  /// Returns the e-mail verification delivery report from the server.
  Future<Json> register(Json body) async {
    final res = await _repo.register(body);
    await _signedIn(asJson(res['user']));
    return asJson(res['verification']);
  }

  Future<void> refreshMe() async {
    try {
      await _signedIn(await _repo.me());
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
    }
  }

  Future<void> logout({bool everywhere = false}) async {
    final user = state.user;
    try {
      everywhere ? await _repo.logoutAll() : await _repo.logout();
    } catch (_) {
      // Signing out locally must always work, even offline.
    }
    await ref.read(tokenStoreProvider).clear();
    if (user != null) await ref.read(cacheStoreProvider).clearScope(user.id);
    _scope(null);
    state = const AuthState(AuthStatus.signedOut);
  }

  void sessionExpired() {
    if (state.status != AuthStatus.signedIn) return;
    _scope(null);
    state = const AuthState(AuthStatus.signedOut, notice: 'Your session ended. Please sign in again.');
  }
}
