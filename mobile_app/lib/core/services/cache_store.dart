import 'dart:convert';

import 'package:hive_ce_flutter/hive_ce_flutter.dart';

class Cached<T> {
  Cached(this.data, this.savedAt, {this.fromCache = false});
  final T data;
  final DateTime savedAt;
  final bool fromCache;
}

/// Offline copies of what the user has already loaded, kept per account.
/// Cleared on sign-out so a shared phone never shows another person's farm data.
class CacheStore {
  late Box<String> _box;
  String _scope = 'anon';

  Future<void> init() async {
    _box = await Hive.openBox<String>('af_cache_v1');
  }

  void setScope(String? userId) => _scope = userId ?? 'anon';

  String _k(String key) => '$_scope|$key';

  Future<void> put(String key, dynamic data) async {
    await _box.put(_k(key), jsonEncode({'savedAt': DateTime.now().toIso8601String(), 'data': data}));
  }

  Cached<dynamic>? get(String key) {
    final raw = _box.get(_k(key));
    if (raw == null) return null;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      return Cached<dynamic>(m['data'], DateTime.parse(m['savedAt'] as String), fromCache: true);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearScope(String userId) async {
    final keys = _box.keys.where((k) => '$k'.startsWith('$userId|')).toList();
    await _box.deleteAll(keys);
  }

  Future<void> clearAll() => _box.clear();
}
