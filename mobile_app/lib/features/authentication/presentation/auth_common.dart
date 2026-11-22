import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/json.dart';
import '../application/auth_controller.dart';

final regionsProvider = FutureProvider<Json>((ref) => ref.watch(authRepositoryProvider).regions());
final authConfigProvider = FutureProvider<Json>((ref) => ref.watch(authRepositoryProvider).config());

final emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');

String? validateEmail(String? v) {
  final t = (v ?? '').trim();
  if (t.isEmpty) return 'Enter your email address';
  if (!emailRe.hasMatch(t)) return 'Enter a valid email address';
  return null;
}

/// Same rules as the server: 8+ characters, a letter and a number.
String? validatePassword(String? v) {
  final t = v ?? '';
  if (t.length < 8) return 'At least 8 characters';
  if (!RegExp(r'[A-Za-z]').hasMatch(t)) return 'Include a letter';
  if (!RegExp(r'[0-9]').hasMatch(t)) return 'Include a number';
  return null;
}

/// 0..4 strength score for the meter.
int passwordStrength(String p) {
  var s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (RegExp(r'[A-Za-z]').hasMatch(p) && RegExp(r'[0-9]').hasMatch(p)) s++;
  if (RegExp(r'[^A-Za-z0-9]').hasMatch(p) || (RegExp(r'[a-z]').hasMatch(p) && RegExp(r'[A-Z]').hasMatch(p))) s++;
  return s;
}

class PasswordStrengthMeter extends StatelessWidget {
  const PasswordStrengthMeter({super.key, required this.password});
  final String password;

  @override
  Widget build(BuildContext context) {
    if (password.isEmpty) return const SizedBox.shrink();
    final s = passwordStrength(password);
    const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = [AppColors.danger, AppColors.danger, AppColors.amber, AppColors.leaf, AppColors.leaf];
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        for (var i = 0; i < 4; i++)
          Expanded(
            child: Container(
              height: 5,
              margin: const EdgeInsets.only(right: 4),
              decoration: BoxDecoration(color: i < s ? colors[s] : AppColors.divider, borderRadius: BorderRadius.circular(3)),
            ),
          ),
        const SizedBox(width: 8),
        Text(labels[s], style: TextStyle(fontFamily: kFont, fontSize: 12, fontWeight: FontWeight.w700, color: colors[s])),
      ]),
    );
  }
}

/// Header used on every auth screen: back arrow, bold title, muted subtitle.
class AuthHeader extends StatelessWidget {
  const AuthHeader({super.key, required this.title, required this.subtitle, this.onBack});
  final String title;
  final String subtitle;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (onBack != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 28),
          child: IconButton(
            onPressed: onBack,
            tooltip: 'Back',
            icon: const Icon(Icons.arrow_back, color: AppColors.ink, size: 26),
            style: IconButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(44, 44), alignment: Alignment.centerLeft),
          ),
        )
      else
        const SizedBox(height: 40),
      Text(title, style: Theme.of(context).textTheme.headlineLarge),
      const SizedBox(height: 8),
      Text(subtitle, style: const TextStyle(fontFamily: kFont, fontSize: 16, color: AppColors.muted, height: 1.4)),
      const SizedBox(height: 28),
    ]);
  }
}

class DividerLabel extends StatelessWidget {
  const DividerLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Row(children: [
        const Expanded(child: Divider()),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(text, style: const TextStyle(fontFamily: kFont, color: AppColors.muted, fontSize: 14))),
        const Expanded(child: Divider()),
      ]);
}

/// Inline error box for form-level errors.
class FormErrorBox extends StatelessWidget {
  const FormErrorBox(this.message, {super.key});
  final String? message;
  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.dangerSoft, borderRadius: BorderRadius.circular(kRadius), border: Border.all(color: AppColors.danger.withValues(alpha: 0.5))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
        const SizedBox(width: 8),
        Expanded(child: Text(message!, style: const TextStyle(fontFamily: kFont, color: AppColors.ink, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}
