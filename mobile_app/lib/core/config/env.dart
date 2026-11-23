/// Build-time configuration (pass with --dart-define). No secrets live in the app:
/// AI, database and e-mail credentials stay on the AgriFlow server.
class Env {
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://agriflow-ai-wheat.vercel.app');
  static const websiteUrl = String.fromEnvironment('WEBSITE_URL', defaultValue: 'https://agriflow-ai-wheat.vercel.app');

  // Firebase Cloud Messaging (optional). Push stays off until these are provided.
  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  static bool get pushConfigured =>
      firebaseApiKey.isNotEmpty && firebaseAppId.isNotEmpty && firebaseSenderId.isNotEmpty && firebaseProjectId.isNotEmpty;

  static String get apiRoot => '$apiBaseUrl/api/v1';
}
