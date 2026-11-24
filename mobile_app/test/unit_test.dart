import 'package:agriflow_ai/core/networking/api_exception.dart';
import 'package:agriflow_ai/core/routing/app_router.dart';
import 'package:agriflow_ai/core/utils/format.dart';
import 'package:agriflow_ai/core/utils/json.dart';
import 'package:agriflow_ai/features/authentication/application/auth_controller.dart';
import 'package:agriflow_ai/features/authentication/presentation/auth_common.dart';
import 'package:agriflow_ai/models/app_user.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

AppUser user({String role = 'FARMER', bool onboarded = true}) => AppUser({'id': 'u1', 'email': 'a@b.zm', 'role': role, 'onboardingCompleted': onboarded, 'profile': {'fullName': 'Mwila Banda'}});

void main() {
  group('auth redirect', () {
    test('unknown session shows the splash screen', () {
      expect(authRedirect(const AuthState(AuthStatus.unknown), '/home'), '/splash');
      expect(authRedirect(const AuthState(AuthStatus.unknown), '/splash'), isNull);
    });
    test('signed-out users can only reach the auth screens', () {
      const s = AuthState(AuthStatus.signedOut);
      expect(authRedirect(s, '/home'), '/welcome');
      expect(authRedirect(s, '/admin'), '/welcome');
      for (final p in ['/welcome', '/login', '/register', '/forgot-password', '/reset-password']) {
        expect(authRedirect(s, p), isNull, reason: p);
      }
    });
    test('signed-in users skip auth screens and must finish onboarding', () {
      expect(authRedirect(AuthState(AuthStatus.signedIn, user: user()), '/login'), '/home');
      expect(authRedirect(AuthState(AuthStatus.signedIn, user: user(onboarded: false)), '/home'), '/onboarding');
      expect(authRedirect(AuthState(AuthStatus.signedIn, user: user(onboarded: false)), '/verify-email'), isNull);
      expect(authRedirect(AuthState(AuthStatus.signedIn, user: user()), '/farms/x'), isNull);
    });
  });

  group('roles', () {
    test('distributor is both seller and carrier', () {
      final d = user(role: 'DISTRIBUTOR');
      expect(d.isSeller, isTrue);
      expect(d.isCarrier, isTrue);
      expect(d.isFarmer, isFalse);
      expect(user(role: 'EXPERT').roleLabel, 'Agricultural expert');
      expect(user(role: 'SUPER_ADMIN').isAdmin, isTrue);
    });
  });

  group('validation (same rules as the server)', () {
    test('email', () {
      expect(validateEmail('farmer@agri.zm'), isNull);
      expect(validateEmail('nope'), isNotNull);
      expect(validateEmail(''), isNotNull);
    });
    test('password', () {
      expect(validatePassword('Harvest2026'), isNull);
      expect(validatePassword('short1'), isNotNull);
      expect(validatePassword('allletters'), isNotNull);
      expect(validatePassword('12345678'), isNotNull);
      expect(passwordStrength('Harvest2026!'), greaterThanOrEqualTo(3));
      expect(passwordStrength('abc'), 0);
    });
  });

  group('API errors', () {
    DioException resp(int status, Object data) => DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: status, data: data),
          type: DioExceptionType.badResponse,
        );
    test('reads server error messages and field errors', () {
      final e = ApiException.from(resp(400, {
        'error': {
          'code': 'VALIDATION',
          'message': 'Please check the highlighted fields.',
          'fieldErrors': {'email': ['Enter a valid email address']}
        }
      }));
      expect(e.code, 'VALIDATION');
      expect(e.field('email'), 'Enter a valid email address');
    });
    test('network problems are recognised as offline', () {
      final e = ApiException.from(DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.connectionError));
      expect(e.isNetwork, isTrue);
      expect(ApiException.from(DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.receiveTimeout)).isNetwork, isTrue);
    });
    test('server errors get a friendly message', () {
      expect(ApiException.from(resp(502, 'Bad gateway')).message, contains('server'));
    });
  });

  group('JSON and formatting', () {
    test('Prisma decimals arrive as strings', () {
      final j = <String, dynamic>{'price': '1250.50', 'qty': 3, 'when': '2026-11-20T10:00:00.000Z', 'nested': {'a': 1}};
      expect(j.n('price'), 1250.5);
      expect(j.n('qty'), 3);
      expect(j.nn('missing'), isNull);
      expect(j.d('when')!.year, 2026);
      expect(j.m('nested').n('a'), 1);
      expect(j.l('nothing'), isEmpty);
    });
    test('kwacha formatting', () {
      expect(zmw(1250.5), 'K 1,250.50');
      expect(zmw(null), '—');
      expect(unitLabel('BAG_50KG'), '50 kg bag');
      expect(labelize('GRAIN_FILL'), 'Grain fill');
      expect(initials('Mwila Banda'), 'MB');
    });
  });
}
