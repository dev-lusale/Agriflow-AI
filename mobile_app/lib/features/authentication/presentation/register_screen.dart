import 'package:flutter/gestures.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/env.dart';
import '../../../core/networking/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/json.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/inputs.dart';
import '../../../core/widgets/states.dart';
import '../application/auth_controller.dart';
import 'auth_common.dart';

const accountTypes = [
  ('FARMER', 'Farmer', 'Manage farms, get AI advice, sell produce', Icons.agriculture_outlined),
  ('SUPPLIER', 'Agricultural supplier', 'Sell seed, fertiliser and equipment', Icons.storefront_outlined),
  ('BUYER', 'Buyer', 'Buy produce from farmers', Icons.shopping_basket_outlined),
  ('EXPERT', 'Agricultural expert', 'Give farmers second opinions on crop problems', Icons.school_outlined),
  ('DISTRIBUTOR', 'Distributor', 'Sell inputs and deliver them', Icons.local_shipping_outlined),
  ('TRANSPORTER', 'Transporter', 'Deliver agricultural goods', Icons.fire_truck_outlined),
];

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _province;
  String? _district;
  String _role = 'FARMER';
  bool _terms = false;
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _password, _confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _error = null;
      _fe = null;
    });
    final valid = _form.currentState!.validate();
    if (!_terms) setState(() => _error = 'Please accept the terms and privacy notice to continue.');
    if (!valid || !_terms) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      final verification = await ref.read(authControllerProvider.notifier).register({
        'fullName': _name.text.trim(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
        'password': _password.text,
        'confirmPassword': _confirm.text,
        'country': 'ZM',
        'province': _province,
        'district': _district,
        'role': _role,
        'acceptTerms': true,
      });
      if (!mounted) return;
      context.go('/verify-email', extra: verification);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.fieldErrors.isEmpty ? e.message : 'Please check the highlighted fields.';
        _fe = e;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final regions = ref.watch(regionsProvider);
    final provinces = regions.value?.l('provinces') ?? const <Json>[];
    final districts = provinces.firstWhere((p) => p.s('value') == _province, orElse: () => <String, dynamic>{}).ls('districts');
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          child: Form(
            key: _form,
            child: AutofillGroup(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                AuthHeader(
                  title: 'Create your account',
                  subtitle: 'Join farmers and agribusinesses across Zambia.',
                  onBack: context.canPop() ? () => context.pop() : () => context.go('/welcome'),
                ),
                FormErrorBox(_error),
                AppTextField(
                  label: 'Full name',
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.name],
                  validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your full name' : null,
                  errorText: _fe?.field('fullName'),
                ),
                const SizedBox(height: 18),
                AppTextField(
                  label: 'Email address',
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email],
                  validator: validateEmail,
                  errorText: _fe?.field('email'),
                ),
                const SizedBox(height: 18),
                AppTextField(
                  label: 'Phone number',
                  controller: _phone,
                  hint: '+260 97 123 4567',
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  validator: (v) => RegExp(r'^\+?[0-9 ]{9,15}$').hasMatch((v ?? '').trim()) ? null : 'Enter a valid phone number, e.g. +260 97 1234567',
                  errorText: _fe?.field('phone'),
                ),
                const SizedBox(height: 18),
                StatefulBuilder(builder: (context, setLocal) {
                  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    AppTextField(
                      label: 'Password',
                      controller: _password,
                      obscure: true,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.newPassword],
                      validator: validatePassword,
                      onChanged: (_) => setLocal(() {}),
                      errorText: _fe?.field('password'),
                      helper: 'At least 8 characters with a letter and a number.',
                    ),
                    PasswordStrengthMeter(password: _password.text),
                  ]);
                }),
                const SizedBox(height: 18),
                AppTextField(
                  label: 'Confirm password',
                  controller: _confirm,
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  validator: (v) => v != _password.text ? 'Passwords do not match' : null,
                  errorText: _fe?.field('confirmPassword'),
                ),
                const SizedBox(height: 18),
                AppDropdown<String>(
                  label: 'Country',
                  value: 'ZM',
                  items: const [DropdownMenuItem(value: 'ZM', child: Text('Zambia'))],
                  onChanged: null,
                ),
                const SizedBox(height: 18),
                if (regions.isLoading)
                  const LinearProgressIndicator()
                else if (regions.hasError)
                  ErrorView(error: regions.error!, onRetry: () => ref.invalidate(regionsProvider))
                else ...[
                  AppDropdown<String>(
                    label: 'Province',
                    value: _province,
                    hint: 'Select province',
                    items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))],
                    onChanged: (v) => setState(() {
                      _province = v;
                      _district = null;
                    }),
                    validator: (v) => v == null ? 'Choose your province' : null,
                    errorText: _fe?.field('province'),
                  ),
                  const SizedBox(height: 18),
                  AppDropdown<String>(
                    label: 'District',
                    value: _district,
                    hint: _province == null ? 'Choose a province first' : 'Select district',
                    items: [for (final d in districts) DropdownMenuItem(value: d, child: Text(d))],
                    onChanged: _province == null ? null : (v) => setState(() => _district = v),
                    validator: (v) => v == null ? 'Choose your district' : null,
                    errorText: _fe?.field('district'),
                  ),
                ],
                const SizedBox(height: 22),
                const Text('Account type', style: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700, fontSize: 14.5)),
                const SizedBox(height: 10),
                for (final t in accountTypes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _RoleTile(
                      title: t.$2,
                      subtitle: t.$3,
                      icon: t.$4,
                      selected: _role == t.$1,
                      onTap: () => setState(() => _role = t.$1),
                    ),
                  ),
                const SizedBox(height: 8),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Checkbox(value: _terms, onChanged: (v) => setState(() => _terms = v == true)),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text.rich(TextSpan(
                        style: const TextStyle(fontFamily: kFont, fontSize: 14, color: AppColors.ink, height: 1.4),
                        children: [
                          const TextSpan(text: 'I agree to the '),
                          TextSpan(
                            text: 'Terms',
                            style: const TextStyle(color: AppColors.coral, fontWeight: FontWeight.w800),
                            recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('${Env.websiteUrl}/terms'), mode: LaunchMode.externalApplication),
                          ),
                          const TextSpan(text: ' and the '),
                          TextSpan(
                            text: 'Privacy notice',
                            style: const TextStyle(color: AppColors.coral, fontWeight: FontWeight.w800),
                            recognizer: TapGestureRecognizer()..onTap = () => launchUrl(Uri.parse('${Env.websiteUrl}/privacy'), mode: LaunchMode.externalApplication),
                          ),
                          const TextSpan(text: ', including processing of my data under the Data Protection Act, 2021.'),
                        ],
                      )),
                    ),
                  ),
                ]),
                const SizedBox(height: 18),
                PrimaryButton(label: 'Register', loading: _busy, onPressed: _submit),
                const SizedBox(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text('Already have an account? ', style: TextStyle(fontFamily: kFont, color: AppColors.muted, fontSize: 14.5)),
                  LinkText('Log in', onTap: () => context.pushReplacement('/login')),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleTile extends StatelessWidget {
  const _RoleTile({required this.title, required this.subtitle, required this.icon, required this.selected, required this.onTap});
  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(kRadius),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: selected ? AppColors.coralSoft : AppColors.white,
            borderRadius: BorderRadius.circular(kRadius),
            border: Border.all(color: selected ? AppColors.coral : AppColors.ink, width: selected ? 2 : 1.3),
          ),
          child: Row(children: [
            Icon(icon, color: selected ? AppColors.coral : AppColors.ink),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, fontSize: 15)),
                Text(subtitle, style: const TextStyle(fontFamily: kFont, color: AppColors.muted, fontSize: 13)),
              ]),
            ),
            Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: selected ? AppColors.coral : AppColors.muted),
          ]),
        ),
      ),
    );
  }
}
