import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Access and refresh tokens live only in Android's encrypted storage (Keystore-backed).
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _kAccess = 'af_access_token';
  static const _kRefresh = 'af_refresh_token';

  String? _access;
  String? _refresh;
  bool _loaded = false;

  String? get accessToken => _access;
  String? get refreshToken => _refresh;
  bool get hasSession => (_refresh ?? '').isNotEmpty;

  Future<void> load() async {
    if (_loaded) return;
    try {
      _access = await _storage.read(key: _kAccess);
      _refresh = await _storage.read(key: _kRefresh);
    } catch (_) {
      // Corrupted keystore (e.g. restored device): start signed out.
      _access = null;
      _refresh = null;
    }
    _loaded = true;
  }

  Future<void> save(String access, String refresh) async {
    _access = access;
    _refresh = refresh;
    _loaded = true;
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  Future<void> clear() async {
    _access = null;
    _refresh = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}
