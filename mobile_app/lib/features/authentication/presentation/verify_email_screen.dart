import 'dart:async';

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
import '../../../core/widgets/states.dart';
import '../application/auth_controller.dart';
import 'auth_common.dart';

class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, this.initialDelivery});
  final Json? initialDelivery;
  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _code = TextEditingController();
  Timer? _timer;
  int _wait = 0;
  bool _busy = false;
  bool _sending = false;
  String? _error;
  String? _delivery;

  @override
  void initState() {
    super.initState();
    _delivery = widget.initialDelivery?.sn('delivery');
    _startCountdown((widget.initialDelivery?.n('resendAfterSeconds', 60) ?? 0).toInt());
    if (widget.initialDelivery == null) WidgetsBinding.instance.addPostFrameCallback((_) => _resend());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _timer?.cancel();
    setState(() => _wait = seconds);
    if (seconds <= 0) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _wait = _wait - 1);
      if (_wait <= 0) t.cancel();
    });
  }

  Future<void> _resend() async {
    if (_sending || _wait > 0) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final r = await ref.read(authRepositoryProvider).sendVerification();
      if (r.b('alreadyVerified')) {
        await ref.read(authControllerProvider.notifier).refreshMe();
        if (mounted) context.go('/home');
        return;
      }
      setState(() => _delivery = r.sn('delivery'));
      _startCountdown(r.n('resendAfterSeconds', 60).toInt());
      if (mounted && _delivery == 'sent') showSnack(context, 'A new code is on its way to your inbox.');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _verify() async {
    if (_busy) return;
    final code = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'Enter the 6-digit code from the email.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).verifyEmail(code);
      await ref.read(authControllerProvider.notifier).refreshMe();
      if (!mounted) return;
      showSnack(context, 'Email verified. Welcome to AgriFlow AI!');
      context.go('/home');
    } on ApiException catch (e) {
      setState(() => _error = e.field('code') ?? e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = ref.watch(authControllerProvider).user?.email ?? 'your email';
    final notConfigured = _delivery == 'not_configured';
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AuthHeader(title: 'Verify your email', subtitle: 'We sent a 6-digit code to $email.'),
            if (notConfigured)
              Container(
                margin: const EdgeInsets.only(bottom: 18),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(kRadius), border: Border.all(color: AppColors.amber.withValues(alpha: 0.5))),
                child: const Text(
                  'Email sending is not set up on the AgriFlow server yet, so the code could not be delivered. You can continue and verify later from your profile.',
                  style: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w600, height: 1.4),
                ),
              ),
            if (_delivery == 'failed') const FormErrorBox('The email could not be sent. Try resending in a moment.'),
            FormErrorBox(_error),
            AppTextField(
              label: 'Verification code',
              controller: _code,
              hint: '••••••',
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              autofillHints: const [AutofillHints.oneTimeCode],
              onSubmitted: (_) => _verify(),
            ),
            const SizedBox(height: 22),
            PrimaryButton(label: 'Verify', loading: _busy, onPressed: _verify),
            const SizedBox(height: 18),
            Center(
              child: _wait > 0
                  ? Text('Resend code in 0:${_wait.toString().padLeft(2, '0')}', style: const TextStyle(fontFamily: kFont, color: AppColors.muted, fontWeight: FontWeight.w600))
                  : LinkText(_sending ? 'Sending…' : 'Resend code', onTap: _resend),
            ),
            const SizedBox(height: 28),
            const DividerLabel('or'),
            const SizedBox(height: 18),
            SecondaryButton(label: 'Verify later', onPressed: () => context.go('/home')),
          ]),
        ),
      ),
    );
  }
}
