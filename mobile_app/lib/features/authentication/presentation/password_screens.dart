import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/networking/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/json.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/inputs.dart';
import '../application/auth_controller.dart';
import 'auth_common.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await ref.read(authRepositoryProvider).forgotPassword(_email.text.trim());
      if (!mounted) return;
      context.push('/reset-password', extra: {'email': _email.text.trim(), ...r});
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AuthHeader(title: 'Forgot password?', subtitle: "Enter your account's email and we'll send you a 6-digit reset code.", onBack: () => context.pop()),
              FormErrorBox(_error),
              AppTextField(
                label: 'Email address',
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                validator: validateEmail,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 24),
              PrimaryButton(label: 'Send reset code', loading: _busy, onPressed: _submit),
            ]),
          ),
        ),
      ),
    );
  }
}

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.info});
  final Json info;
  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _pw = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _done = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    _code.dispose();
    _pw.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    try {
      await ref.read(authRepositoryProvider).resetPassword({
        'email': widget.info.s('email'),
        'code': _code.text.trim(),
        'password': _pw.text,
        'confirmPassword': _confirm.text,
      });
      setState(() => _done = true);
    } on ApiException catch (e) {
      setState(() {
        _error = e.field('code') ?? e.message;
        _fe = e;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Icon(Icons.check_circle_outline, color: AppColors.leaf, size: 72),
              const SizedBox(height: 16),
              Text('Password changed', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              const Text('You can now log in with your new password. Other devices have been signed out.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 28),
              PrimaryButton(label: 'Back to log in', onPressed: () => context.go('/login')),
            ]),
          ),
        ),
      );
    }
    final notConfigured = widget.info.s('emailDelivery') == 'not_configured';
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AuthHeader(title: 'Reset password', subtitle: widget.info.s('message', 'Enter the code we e-mailed you and choose a new password.'), onBack: () => context.pop()),
              if (notConfigured)
                Container(
                  margin: const EdgeInsets.only(bottom: 18),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(kRadius)),
                  child: const Text('Email sending is not set up on the AgriFlow server yet, so reset codes cannot be delivered. Contact support to reset your password.',
                      style: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w600, height: 1.4)),
                ),
              FormErrorBox(_error),
              AppTextField(
                label: 'Reset code',
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                autofillHints: const [AutofillHints.oneTimeCode],
                validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '') ? null : 'Enter the 6-digit code',
              ),
              const SizedBox(height: 18),
              StatefulBuilder(builder: (c, setLocal) {
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  AppTextField(label: 'New password', controller: _pw, obscure: true, validator: validatePassword, onChanged: (_) => setLocal(() {}), errorText: _fe?.field('password')),
                  PasswordStrengthMeter(password: _pw.text),
                ]);
              }),
              const SizedBox(height: 18),
              AppTextField(label: 'Confirm new password', controller: _confirm, obscure: true, validator: (v) => v != _pw.text ? 'Passwords do not match' : null),
              const SizedBox(height: 24),
              PrimaryButton(label: 'Change password', loading: _busy, onPressed: _submit),
            ]),
          ),
        ),
      ),
    );
  }
}
