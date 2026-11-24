import 'dart:async';

import 'package:dio/dio.dart';

import '../config/env.dart';
import 'api_exception.dart';
import 'token_store.dart';

/// HTTP client for the AgriFlow mobile API (/api/v1).
/// - Adds the access token to every request.
/// - When a connection cannot be made (slow or patchy mobile networks), retries with short pauses,
///   then tries the other server address (relay or direct) and keeps using whichever works.
///   A failed connection means the server never received the request, so retrying is safe.
/// - On 401, refreshes once (single-flight) and retries; if refresh fails the session ends.
class ApiClient {
  ApiClient(
    this.tokens, {
    required this.onSessionExpired,
    Dio? dio,
    Dio? refreshDio,
    List<String>? servers,
    this.retryDelays = const [Duration(seconds: 1), Duration(seconds: 3)],
  })  : _dio = dio ?? Dio(_options()),
        _refreshDio = refreshDio ?? Dio(_options()),
        servers = servers ?? (dio == null ? Env.apiRoots : [dio.options.baseUrl]) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final t = tokens.accessToken;
        if (t != null && options.headers['Authorization'] == null) options.headers['Authorization'] = 'Bearer $t';
        handler.next(options);
      },
      onResponse: (res, handler) {
        _useServer(res.requestOptions.baseUrl);
        handler.next(res);
      },
      onError: (err, handler) async {
        final req = err.requestOptions;
        if (_connectFailed(err)) {
          final next = _nextAttempt(req);
          if (next != null) {
            await Future<void>.delayed(next);
            try {
              return handler.resolve(await _dio.fetch(_forRetry(req)));
            } on DioException catch (e) {
              return handler.next(e);
            }
          }
        }
        final isAuthCall = req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register') || req.path.startsWith('/auth/refresh');
        if (err.response?.statusCode == 401 && !isAuthCall && req.extra['retried'] != true && tokens.hasSession) {
          final outcome = await _refreshOnce();
          if (outcome == _Refresh.ok) {
            req.extra['retried'] = true;
            req.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
            try {
              return handler.resolve(await _dio.fetch(req));
            } on DioException catch (e) {
              return handler.next(e);
            }
          }
          if (outcome == _Refresh.rejected) onSessionExpired();
        }
        handler.next(err);
      },
    ));
  }

  static BaseOptions _options() => BaseOptions(
        baseUrl: Env.apiRoot,
        connectTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 75), // AI answers can take a while
        headers: {'Accept': 'application/json'},
      );

  final TokenStore tokens;
  final void Function() onSessionExpired;
  final Dio _dio;
  final Dio _refreshDio;
  final List<String> servers;
  final List<Duration> retryDelays;
  Completer<_Refresh>? _refreshing;

  static bool _connectFailed(DioException e) =>
      e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout;

  /// Decides the next attempt for a request whose connection failed: the same address again after
  /// a pause, then each other address once. Returns the pause, or null when everything was tried.
  Duration? _nextAttempt(RequestOptions req) {
    final attempt = (req.extra['attempt'] as int?) ?? 0;
    if (attempt < retryDelays.length) {
      req.extra['attempt'] = attempt + 1;
      return retryDelays[attempt];
    }
    final tried = <String>{...((req.extra['triedServers'] as List?)?.cast<String>() ?? const []), req.baseUrl};
    for (final s in servers) {
      if (!tried.contains(s)) {
        req
          ..baseUrl = s
          ..extra['attempt'] = 0
          ..extra['triedServers'] = [...tried, s];
        return Duration.zero;
      }
    }
    return null;
  }

  /// Form uploads can only be sent once, so a retry needs a fresh copy.
  RequestOptions _forRetry(RequestOptions req) {
    final data = req.data;
    if (data is FormData) return req.copyWith(data: data.clone());
    return req;
  }

  /// Keep using an address that just worked.
  void _useServer(String base) {
    if (base.isEmpty || base == _dio.options.baseUrl || !servers.contains(base)) return;
    _dio.options.baseUrl = base;
    _refreshDio.options.baseUrl = base;
  }

  /// The API address currently in use (relay or direct).
  String get apiRoot => _dio.options.baseUrl;

  /// The server address (without /api/v1), e.g. for profile photos.
  String get serverUrl => apiRoot.endsWith('/api/v1') ? apiRoot.substring(0, apiRoot.length - 7) : apiRoot;

  String? deviceName;

  Future<_Refresh> _refreshOnce() {
    final pending = _refreshing;
    if (pending != null) return pending.future;
    final c = Completer<_Refresh>();
    _refreshing = c;
    () async {
      try {
        final res = await _refreshDio.post('/auth/refresh', data: {'refreshToken': tokens.refreshToken, 'deviceName': deviceName});
        final d = res.data as Map;
        await tokens.save('${d['accessToken']}', '${d['refreshToken']}');
        c.complete(_Refresh.ok);
      } on DioException catch (e) {
        // A network problem must never sign a farmer out; only a refresh token the server rejects does.
        if (e.response?.statusCode == 401) {
          await tokens.clear();
          c.complete(_Refresh.rejected);
        } else {
          c.complete(_Refresh.failed);
        }
      } catch (_) {
        c.complete(_Refresh.failed);
      } finally {
        _refreshing = null;
      }
    }();
    return c.future;
  }

  Map<String, String> get authHeaders {
    final t = tokens.accessToken;
    return t == null ? const {} : {'Authorization': 'Bearer $t'};
  }

  /// Absolute URL for an uploaded image (requires [authHeaders]).
  String uploadUrl(String id) => '$apiRoot/uploads/$id';

  Future<dynamic> _wrap(Future<Response<dynamic>> Function() call) async {
    try {
      final res = await call();
      return res.data;
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => _wrap(() => _dio.get(path, queryParameters: query));
  Future<dynamic> post(String path, [Object? data]) => _wrap(() => _dio.post(path, data: data ?? const {}));
  Future<dynamic> patch(String path, Object? data) => _wrap(() => _dio.patch(path, data: data));
  Future<dynamic> put(String path, Object? data) => _wrap(() => _dio.put(path, data: data));
  Future<dynamic> delete(String path, [Object? data]) => _wrap(() => _dio.delete(path, data: data));
  Future<dynamic> multipart(String path, FormData form) => _wrap(() => _dio.post(path, data: form));

  Future<List<int>> bytes(String path) async {
    try {
      final res = await _dio.get<List<int>>(path, options: Options(responseType: ResponseType.bytes));
      return res.data ?? const [];
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  /// Public auth calls that save the returned token pair.
  Future<Map<String, dynamic>> signIn(String path, Map<String, dynamic> body) async {
    final data = await post(path, body) as Map;
    await tokens.save('${data['accessToken']}', '${data['refreshToken']}');
    return Map<String, dynamic>.from(data);
  }
}

enum _Refresh { ok, rejected, failed }
