import 'dart:convert';
import 'dart:typed_data';

import 'package:agriflow_ai/core/networking/api_client.dart';
import 'package:agriflow_ai/core/networking/api_exception.dart';
import 'package:agriflow_ai/core/networking/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Token store without the Android keystore.
class MemoryTokens extends TokenStore {
  String? a;
  String? r;
  @override
  String? get accessToken => a;
  @override
  String? get refreshToken => r;
  @override
  bool get hasSession => (r ?? '').isNotEmpty;
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

typedef Responder = ResponseBody Function(RequestOptions o);

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.respond);
  final Responder respond;
  final calls = <String>[];
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    calls.add('${options.method} ${options.path} ${options.headers['Authorization'] ?? ''}');
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody json(int status, Object body) => ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });

void main() {
  late MemoryTokens tokens;
  setUp(() {
    tokens = MemoryTokens()
      ..a = 'old-access'
      ..r = 'refresh-1';
  });

  test('refreshes an expired access token once and retries the request', () async {
    final api = FakeAdapter((o) => o.headers['Authorization'] == 'Bearer new-access' ? json(200, {'ok': true}) : json(401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'expired'}}));
    final refresh = FakeAdapter((o) => json(200, {'accessToken': 'new-access', 'refreshToken': 'refresh-2'}));
    var expired = 0;
    final client = ApiClient(tokens, onSessionExpired: () => expired++, dio: Dio()..httpClientAdapter = api, refreshDio: Dio()..httpClientAdapter = refresh);
    expect(await client.get('/me'), {'ok': true});
    expect(tokens.r, 'refresh-2');
    expect(refresh.calls, hasLength(1));
    expect(expired, 0);
  });

  test('parallel 401s share a single refresh', () async {
    final api = FakeAdapter((o) => o.headers['Authorization'] == 'Bearer new-access' ? json(200, {'ok': true}) : json(401, {}));
    final refresh = FakeAdapter((o) {
      return json(200, {'accessToken': 'new-access', 'refreshToken': 'refresh-2'});
    });
    final client = ApiClient(tokens, onSessionExpired: () {}, dio: Dio()..httpClientAdapter = api, refreshDio: Dio()..httpClientAdapter = refresh);
    await Future.wait([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(refresh.calls, hasLength(1));
  });

  test('a rejected refresh token ends the session', () async {
    final api = FakeAdapter((o) => json(401, {}));
    final refresh = FakeAdapter((o) => json(401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'Please sign in again.'}}));
    var expired = 0;
    final client = ApiClient(tokens, onSessionExpired: () => expired++, dio: Dio()..httpClientAdapter = api, refreshDio: Dio()..httpClientAdapter = refresh);
    await expectLater(client.get('/me'), throwsA(isA<ApiException>()));
    expect(expired, 1);
    expect(tokens.hasSession, isFalse);
  });

  test('a network failure during refresh never signs the farmer out', () async {
    final api = FakeAdapter((o) => json(401, {}));
    final refresh = FakeAdapter((o) => throw DioException.connectionError(requestOptions: o, reason: 'offline'));
    var expired = 0;
    final client = ApiClient(tokens, onSessionExpired: () => expired++, dio: Dio()..httpClientAdapter = api, refreshDio: Dio()..httpClientAdapter = refresh);
    await expectLater(client.get('/me'), throwsA(isA<ApiException>()));
    expect(expired, 0);
    expect(tokens.hasSession, isTrue);
  });

  test('login endpoints never trigger a refresh', () async {
    final api = FakeAdapter((o) => json(401, {'error': {'code': 'UNAUTHENTICATED', 'message': 'Incorrect email or password.'}}));
    final refresh = FakeAdapter((o) => json(200, {}));
    final client = ApiClient(tokens, onSessionExpired: () {}, dio: Dio()..httpClientAdapter = api, refreshDio: Dio()..httpClientAdapter = refresh);
    await expectLater(client.post('/auth/login', {'email': 'x', 'password': 'y'}), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
    expect(refresh.calls, isEmpty);
  });
}
