import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../config/env.dart';
import '../networking/api_client.dart';

/// Push notifications through Firebase Cloud Messaging.
/// Off until the owner supplies Firebase settings at build time (see docs/MOBILE_APP.md);
/// the in-app notification centre works either way.
class PushService {
  bool _ready = false;
  bool get configured => Env.pushConfigured;
  bool get ready => _ready;

  Future<void> register(ApiClient api) async {
    if (!configured) return;
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: const FirebaseOptions(
            apiKey: Env.firebaseApiKey,
            appId: Env.firebaseAppId,
            messagingSenderId: Env.firebaseSenderId,
            projectId: Env.firebaseProjectId,
          ),
        );
      }
      final fm = FirebaseMessaging.instance;
      final settings = await fm.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await fm.getToken();
      if (token != null) await api.post('/me/push-token', {'token': token, 'platform': 'android'});
      fm.onTokenRefresh.listen((t) => api.post('/me/push-token', {'token': t, 'platform': 'android'}).catchError((_) => null));
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }
}
