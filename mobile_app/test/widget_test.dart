import 'package:agriflow_ai/core/theme/app_theme.dart';
import 'package:agriflow_ai/features/authentication/application/auth_controller.dart';
import 'package:agriflow_ai/features/authentication/presentation/auth_common.dart';
import 'package:agriflow_ai/features/authentication/presentation/login_screen.dart';
import 'package:agriflow_ai/features/authentication/presentation/register_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

class SignedOutAuth extends AuthController {
  int logins = 0;
  @override
  AuthState build() => const AuthState(AuthStatus.signedOut);
  @override
  Future<void> login(String email, String password) async {
    logins++;
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
}

Widget app(Widget home, SignedOutAuth auth, {Size size = const Size(390, 844)}) {
  final router = GoRouter(routes: [
    GoRoute(path: '/', builder: (_, _) => home),
    GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
    GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
    GoRoute(path: '/welcome', builder: (_, _) => const SizedBox()),
    GoRoute(path: '/forgot-password', builder: (_, _) => const Text('forgot')),
  ]);
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(() => auth),
      authConfigProvider.overrideWith((ref) async => {
            'socialProviders': {'google': false, 'apple': false, 'facebook': false},
          }),
      regionsProvider.overrideWith((ref) async => {
            'provinces': [
              {'value': 'SOUTHERN', 'label': 'Southern', 'districts': ['Choma', 'Monze']},
            ],
          }),
    ],
    child: MediaQuery(data: MediaQueryData(size: size), child: MaterialApp.router(theme: buildTheme(), routerConfig: router)),
  );
}

void main() {
  for (final size in const [Size(320, 640), Size(390, 844), Size(480, 1000)]) {
    testWidgets('login screen matches the reference layout at ${size.width.toInt()}dp', (t) async {
      t.view.physicalSize = size * 2;
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      await t.pumpWidget(app(const LoginScreen(), SignedOutAuth(), size: size));
      await t.pumpAndSettle();
      expect(find.text('Welcome back!'), findsOneWidget);
      expect(find.text('Log in to your account to continue.'), findsOneWidget);
      expect(find.text('Email address'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Forgot Password?'), findsOneWidget);
      expect(find.text('Log In'), findsOneWidget);
      expect(find.text('Or log in with'), findsOneWidget);
      expect(find.bySemanticsLabel('Log in with Google'), findsOneWidget);
      expect(find.text('Sign up'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  }

  testWidgets('login validates input before calling the server', (t) async {
    final auth = SignedOutAuth();
    await t.pumpWidget(app(const LoginScreen(), auth));
    await t.pumpAndSettle();
    await t.tap(find.text('Log In'));
    await t.pumpAndSettle();
    expect(find.text('Enter your email address'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
    expect(auth.logins, 0);
  });

  testWidgets('login ignores double taps (no duplicate requests)', (t) async {
    final auth = SignedOutAuth();
    await t.pumpWidget(app(const LoginScreen(), auth));
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextFormField).at(0), 'farmer@agri.zm');
    await t.enterText(find.byType(TextFormField).at(1), 'Harvest2026');
    await t.tap(find.text('Log In'));
    await t.pump();
    await t.tap(find.byType(LoginScreen), warnIfMissed: false);
    await t.pumpAndSettle();
    expect(auth.logins, 1);
  });

  testWidgets('social buttons say honestly that they are not set up', (t) async {
    await t.pumpWidget(app(const LoginScreen(), SignedOutAuth()));
    await t.pumpAndSettle();
    await t.tap(find.bySemanticsLabel('Log in with Google'));
    await t.pump();
    expect(find.textContaining('not set up yet'), findsOneWidget);
  });

  testWidgets('registration enforces password rules, matching and terms', (t) async {
    await t.pumpWidget(app(const RegisterScreen(), SignedOutAuth()));
    await t.pumpAndSettle();
    expect(find.text('Create your account'), findsOneWidget);
    await t.enterText(find.byType(TextFormField).at(3), 'short');
    await t.enterText(find.byType(TextFormField).at(4), 'different');
    await t.ensureVisible(find.text('Register'));
    await t.pumpAndSettle();
    await t.tap(find.text('Register'));
    await t.pumpAndSettle();
    expect(find.text('At least 8 characters'), findsOneWidget);
    expect(find.text('Passwords do not match'), findsOneWidget);
    expect(find.textContaining('accept the terms'), findsOneWidget);
  });
}
