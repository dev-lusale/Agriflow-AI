import '../../../core/networking/api_client.dart';
import '../../../core/utils/json.dart';

class AuthRepository {
  AuthRepository(this.api);
  final ApiClient api;

  Future<Json> config() async => asJson(await api.get('/auth/config'));
  Future<Json> regions() async => asJson(await api.get('/meta/regions'));
  Future<Json> login(String email, String password) => api.signIn('/auth/login', {'email': email, 'password': password, 'deviceName': api.deviceName});
  Future<Json> register(Json body) => api.signIn('/auth/register', {...body, 'deviceName': api.deviceName});
  Future<Json> me() async => asJson(await api.get('/me'));
  Future<Json> sendVerification() async => asJson(await api.post('/auth/verify-email/send'));
  Future<void> verifyEmail(String code) async => api.post('/auth/verify-email', {'code': code});
  Future<Json> forgotPassword(String email) async => asJson(await api.post('/auth/forgot-password', {'email': email}));
  Future<void> resetPassword(Json body) async => api.post('/auth/reset-password', body);
  Future<void> logout() async {
    final rt = api.tokens.refreshToken;
    if (rt != null) await api.post('/auth/logout', {'refreshToken': rt});
  }

  Future<void> logoutAll() async => api.post('/auth/logout-all');
  Future<void> changePassword(Json body) async => api.post('/me/password', body);
  Future<Json> onboarding(Json body) async => asJson(await api.post('/me/onboarding', body));
  Future<Json> updateProfile(Json body) async => asJson(await api.patch('/me', body));
}
