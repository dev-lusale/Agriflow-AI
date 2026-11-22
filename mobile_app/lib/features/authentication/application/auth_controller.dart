import 'package:flutter/foundation.dart';
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

  @override
  AuthState build() {
    Future.microtask(_restore);
    return const AuthState(AuthStatus.unknown);
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
          ref.read(syncQueueProvider).setScope(userId);
          state = AuthState(AuthStatus.signedIn, user: AppUser(asJson(cached.data)), offline: true);
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
