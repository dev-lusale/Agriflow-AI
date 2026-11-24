import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/networking/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/json.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/inputs.dart';
import '../../../core/widgets/states.dart';
import '../application/auth_controller.dart';
import 'auth_common.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  ApiException? _fieldErrors;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return; // prevent duplicate login requests
    setState(() {
      _error = null;
      _fieldErrors = null;
    });
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).login(_email.text, _password.text);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.status == 401 ? 'Incorrect email or password.' : e.message;
        _fieldErrors = e;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _social(String name, bool configured) {
    // Social sign-in only works once the owner configures OAuth credentials; never pretend.
    showSnack(context, configured ? '$name sign-in is coming soon in this version.' : '$name sign-in is not set up yet. Use your email and password.');
  }

  @override
  Widget build(BuildContext context) {
    final cfg = ref.watch(authConfigProvider).value;
    final providers = cfg?.m('socialProviders') ?? const <String, dynamic>{};
    final notice = ref.watch(authControllerProvider).notice;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Form(
            key: _form,
            child: AutofillGroup(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                AuthHeader(
                  title: 'Welcome back!',
                  subtitle: 'Log in to your account to continue.',
                  onBack: context.canPop() ? () => context.pop() : () => context.go('/welcome'),
                ),
                if (notice != null && _error == null) FormErrorBox(notice),
                FormErrorBox(_error),
                AppTextField(
                  label: 'Email address',
                  controller: _email,
                  hint: 'you@example.com',
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email, AutofillHints.username],
                  validator: validateEmail,
                  errorText: _fieldErrors?.field('email'),
                ),
                const SizedBox(height: 20),
                AppTextField(
                  label: 'Password',
                  controller: _password,
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  validator: (v) => (v ?? '').isEmpty ? 'Enter your password' : null,
                  onSubmitted: (_) => _submit(),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: LinkText('Forgot Password?', onTap: () => context.push('/forgot-password')),
                  ),
                ),
                const SizedBox(height: 22),
                PrimaryButton(label: 'Log In', loading: _busy, onPressed: _submit),
                const SizedBox(height: 36),
                const DividerLabel('Or log in with'),
                const SizedBox(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  SquareIconButton(
                    semanticLabel: 'Log in with Google',
                    onTap: () => _social('Google', providers.b('google')),
                    child: Image.asset('assets/brand/google-g.png', width: 26, height: 26, excludeFromSemantics: true),
                  ),
                  const SizedBox(width: 18),
                  SquareIconButton(
                    semanticLabel: 'Log in with Apple',
                    onTap: () => _social('Apple', providers.b('apple')),
                    child: const Icon(Icons.apple, size: 30, color: AppColors.ink),
                  ),
                  const SizedBox(width: 18),
                  SquareIconButton(
                    semanticLabel: 'Log in with Facebook',
                    onTap: () => _social('Facebook', providers.b('facebook')),
                    child: const Icon(Icons.facebook, size: 28, color: Color(0xFF1877F2)),
                  ),
                ]),
                const SizedBox(height: 32),
                Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  const Text("Don't have an account? ", style: TextStyle(fontFamily: kFont, color: AppColors.muted, fontSize: 14.5)),
                  LinkText('Sign up', onTap: () => context.pushReplacement('/register')),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
