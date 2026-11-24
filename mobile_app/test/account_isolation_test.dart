import 'dart:convert';
import 'dart:typed_data';

import 'package:agriflow_ai/core/networking/api_client.dart';
import 'package:agriflow_ai/core/networking/token_store.dart';
import 'package:agriflow_ai/core/providers/core_providers.dart';
import 'package:agriflow_ai/core/services/cache_store.dart';
import 'package:agriflow_ai/core/services/sync_queue.dart';
import 'package:agriflow_ai/core/utils/json.dart';
import 'package:agriflow_ai/features/ai_assistant/ai_chat_screen.dart';
import 'package:agriflow_ai/features/authentication/application/auth_controller.dart';
import 'package:agriflow_ai/features/dashboard/home_screen.dart';
import 'package:agriflow_ai/features/farm_management/farm_providers.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// One phone, several people: what A loaded must never be shown to B, and A's data comes back
/// when A signs in again. The fake server answers per access token, like the real one.

class MemoryTokens extends TokenStore {
  String? a, r;
  @override
  String? get accessToken => a;
  @override
  String? get refreshToken => r;
  @override
  bool get hasSession => r != null;
  @override
  Future<void> load() async {}
  @override
  Future<void> save(String access, String refresh) async {
    a = access;
    r = refresh;
  }

  @override
  Future<void> clear() async {
    a = null;
    r = null;
  }
}

class MemoryCache extends CacheStore {
  final _m = <String, String>{};
  String _scope = 'anon';
  @override
  Future<void> init() async {}
  @override
  void setScope(String? userId) => _scope = userId ?? 'anon';
  @override
  Future<void> put(String key, dynamic data) async => _m['$_scope|$key'] = jsonEncode({'savedAt': DateTime.now().toIso8601String(), 'data': data});
  @override
  Cached<dynamic>? get(String key) {
    final raw = _m['$_scope|$key'];
    if (raw == null) return null;
    final m = jsonDecode(raw) as Map<String, dynamic>;
    return Cached<dynamic>(m['data'], DateTime.parse(m['savedAt'] as String), fromCache: true);
  }

  @override
  Future<void> clearScope(String userId) async => _m.removeWhere((k, _) => k.startsWith('$userId|'));
  int keysFor(String userId) => _m.keys.where((k) => k.startsWith('$userId|')).length;
}

class NoQueue extends SyncQueue {
  @override
  void setScope(String? userId) {}
}

/// A tiny stand-in for the AgriFlow server.
class FakeServer implements HttpClientAdapter {
  final users = <String, Map<String, dynamic>>{}; // email -> user
  final tokens = <String, String>{}; // access token -> email
  var _n = 0;

  ResponseBody _json(int status, Object body) =>
      ResponseBody.fromString(jsonEncode(body), status, headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});

  Map<String, dynamic> _session(String email) {
    final t = 'access-${++_n}';
    tokens[t] = email;
    return {'accessToken': t, 'refreshToken': 'refresh-$_n', 'user': users[email], 'verification': {'delivery': 'sent'}};
  }

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final body = o.data is Map ? Map<String, dynamic>.from(o.data as Map) : <String, dynamic>{};
    final auth = '${o.headers['Authorization'] ?? ''}'.replaceFirst('Bearer ', '');
    final me = users[tokens[auth]];
    switch (o.path) {
      case '/auth/register':
        final email = body['email'] as String;
        users[email] = {
          'id': 'user-${users.length + 1}',
          'email': email,
          'role': body['role'],
          'emailVerified': true,
          'onboardingCompleted': true,
          'avatarUrl': null,
          'profile': {'fullName': body['fullName'], 'province': body['province'], 'district': body['district']},
        };
        return _json(201, _session(email));
      case '/auth/login':
        return users.containsKey(body['email']) ? _json(200, _session(body['email'] as String)) : _json(401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'Incorrect email or password.'}});
      case '/auth/logout':
        return _json(200, {'ok': true});
    }
    if (me == null) return _json(401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'Please sign in.'}});
    final p = me['profile'] as Map;
    switch (o.path) {
      case '/me':
        return _json(200, me);
      case '/dashboard':
        return _json(200, {'greetingName': '${p['fullName']}'.split(' ').first, 'role': me['role'], 'avatarUrl': me['avatarUrl'], 'location': {'province': p['province'], 'district': p['district']}});
      case '/farms':
        return _json(200, [if (me['role'] == 'FARMER') {'id': 'farm-of-${me['id']}', 'name': "${p['fullName']}'s farm"}]);
      case '/ai/conversations':
        return _json(200, [{'id': 'chat-of-${me['id']}', 'title': "${p['fullName']}'s question"}]);
    }
    return _json(404, {'error': {'code': 'NOT_FOUND', 'message': o.path}});
  }

  @override
  void close({bool force = false}) {}
}

Json reg(String name, String email, String role, String province, String district) => {
      'fullName': name,
      'email': email,
      'phone': '+260970000000',
      'password': 'Harvest2026',
      'confirmPassword': 'Harvest2026',
      'country': 'ZM',
      'province': province,
      'district': district,
      'role': role,
      'acceptTerms': true,
    };

void main() {
  late FakeServer server;
  late MemoryCache cache;
  late ProviderContainer c;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    server = FakeServer();
    cache = MemoryCache();
    final tokens = MemoryTokens();
    c = ProviderContainer(overrides: [
      prefsProvider.overrideWithValue(prefs),
      tokenStoreProvider.overrideWithValue(tokens),
      cacheStoreProvider.overrideWithValue(cache),
      syncQueueProvider.overrideWithValue(NoQueue()),
      apiClientProvider.overrideWith(
        (ref) => ApiClient(tokens, onSessionExpired: () {}, dio: Dio()..httpClientAdapter = server, refreshDio: Dio()..httpClientAdapter = server, retryDelays: const []),
      ),
    ]);
    addTearDown(c.dispose);
    c.read(authControllerProvider);
    await Future<void>.delayed(Duration.zero);
  });

  Future<Json> dashboard() async => asJson((await c.read(dashboardProvider.future)).data);
  Future<List<Json>> farms() async => asJsonList((await c.read(farmsProvider.future)).data);
  Future<List<Json>> chats() async => asJsonList((await c.read(conversationsProvider.future)).data);
  AuthController auth() => c.read(authControllerProvider.notifier);

  test('A registers, B registers on the same phone, A signs in again: each sees only their own data', () async {
    // Keep the providers alive like open screens do.
    c.listen(dashboardProvider, (_, _) {});
    c.listen(farmsProvider, (_, _) {});
    c.listen(conversationsProvider, (_, _) {});

    await auth().register(reg('Alice Phiri', 'alice@test.zm', 'FARMER', 'SOUTHERN', 'Choma'));
    expect(c.read(authControllerProvider).user!.fullName, 'Alice Phiri');
    expect((await dashboard()).s('greetingName'), 'Alice');
    expect((await farms()).single.s('name'), "Alice Phiri's farm");
    expect((await chats()).single.s('title'), "Alice Phiri's question");
    final aliceId = c.read(authControllerProvider).user!.id;
    expect(cache.keysFor(aliceId), greaterThan(0));

    await auth().logout();
    expect(c.read(authControllerProvider).user, isNull);
    expect(c.read(sessionUserIdProvider), isNull);
    expect(cache.keysFor(aliceId), 0, reason: "Alice's saved copies are removed from the phone at sign-out");

    await auth().register(reg('Bwalya Mulenga', 'bwalya@test.zm', 'BUYER', 'COPPERBELT', 'Kitwe'));
    expect(c.read(authControllerProvider).user!.fullName, 'Bwalya Mulenga');
    final d = await dashboard();
    expect(d.s('greetingName'), 'Bwalya');
    expect(d.s('role'), 'BUYER');
    expect(d.m('location').s('district'), 'Kitwe');
    expect(await farms(), isEmpty);
    expect((await chats()).single.s('title'), "Bwalya Mulenga's question");
    expect(jsonEncode(d), isNot(contains('Alice')));

    await auth().logout();
    await auth().login('alice@test.zm', 'Harvest2026');
    expect(c.read(authControllerProvider).user!.fullName, 'Alice Phiri');
    expect((await dashboard()).s('greetingName'), 'Alice');
    expect((await farms()).single.s('name'), "Alice Phiri's farm");
    expect((await chats()).single.s('title'), "Alice Phiri's question");
  });

  test('all six account types sign in to their own profile and dashboard', () async {
    c.listen(dashboardProvider, (_, _) {});
    const roles = ['FARMER', 'SUPPLIER', 'BUYER', 'EXPERT', 'DISTRIBUTOR', 'TRANSPORTER'];
    for (final role in roles) {
      final name = 'Person ${role.toLowerCase()}';
      await auth().register(reg(name, '$role@test.zm', role, 'LUSAKA', 'Lusaka'));
      final u = c.read(authControllerProvider).user!;
      expect(u.fullName, name);
      expect(u.roleCode, role);
      final d = await dashboard();
      expect(d.s('greetingName'), 'Person');
      expect(d.s('role'), role, reason: 'dashboard for $role belongs to $role');
      await auth().logout();
    }
  });
}
