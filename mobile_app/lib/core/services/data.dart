import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../networking/api_client.dart';
import '../networking/api_exception.dart';
import '../providers/core_providers.dart';
import 'cache_store.dart';

/// Loads live data and keeps an offline copy. When the phone is offline the saved copy is
/// returned with `fromCache = true`, so screens can label it clearly as not live.
Future<Cached<dynamic>> fetchCached(ApiClient api, CacheStore cache, String path, {Map<String, dynamic>? query}) async {
  final key = query == null || query.isEmpty ? path : '$path?${Uri(queryParameters: query.map((k, v) => MapEntry(k, '$v'))).query}';
  try {
    final data = await api.get(path, query: query);
    await cache.put(key, data);
    return Cached<dynamic>(data, DateTime.now());
  } on ApiException catch (e) {
    if (e.isNetwork) {
      final saved = cache.get(key);
      if (saved != null) return saved;
    }
    rethrow;
  }
}

Future<Cached<dynamic>> cachedGet(Ref ref, String path, {Map<String, dynamic>? query}) =>
    fetchCached(ref.watch(userApiProvider), ref.read(cacheStoreProvider), path, query: query);
