/// Build-time configuration (pass with --dart-define). No secrets live in the app:
/// AI, database and e-mail credentials stay on the AgriFlow server.
class Env {
  static const _defaultServer = 'https://agriflow-ai-wheat.vercel.app';
  static const _apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const _websiteUrl = String.fromEnvironment('WEBSITE_URL');

  /// Server address. Set at build time (GitHub variable API_BASE_URL), e.g. the Cloudflare relay
  /// for networks that cannot reach vercel.app; an empty value means the default server.
  static String get apiBaseUrl => _trim(_apiBaseUrl.isEmpty ? _defaultServer : _apiBaseUrl);
  static String get websiteUrl => _trim(_websiteUrl.isEmpty ? apiBaseUrl : _websiteUrl);
  static String _trim(String u) => u.endsWith('/') ? u.substring(0, u.length - 1) : u;

  // Firebase Cloud Messaging (optional). Push stays off until these are provided.
  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  static bool get pushConfigured =>
      firebaseApiKey.isNotEmpty && firebaseAppId.isNotEmpty && firebaseSenderId.isNotEmpty && firebaseProjectId.isNotEmpty;

  static String get apiRoot => '$apiBaseUrl/api/v1';
}
