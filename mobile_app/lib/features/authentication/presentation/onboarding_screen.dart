import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/networking/api_exception.dart';
import '../../../core/providers/core_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/json.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/inputs.dart';
import '../../../core/widgets/states.dart';
import '../../../models/app_user.dart';
import '../application/auth_controller.dart';
import 'auth_common.dart';

final cropNamesProvider = FutureProvider<List<Json>>((ref) async => asJsonList(await ref.watch(userApiProvider).get('/crops')));
final productCategoriesProvider = FutureProvider<List<Json>>((ref) async => asJsonList(await ref.watch(userApiProvider).get('/meta/product-categories')));

/// Role-specific details the server needs before the account can be used (same as the website).
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _form = GlobalKey<FormState>();
  final _business = TextEditingController();
  final _reg = TextEditingController();
  final _desc = TextEditingController();
  final _phone = TextEditingController();
  final _farmName = TextEditingController();
  final _farmSize = TextEditingController();
  final _experience = TextEditingController();
  final _org = TextEditingController();
  final _qual = TextEditingController();
  final _baseRate = TextEditingController();
  String _farmingType = 'SMALLHOLDER';
  String _sizeUnit = 'HECTARES';
  String? _buyerType;
  String _pricing = 'NEGOTIABLE';
  String? _prov;
  String? _dist;
  final Set<String> _crops = {};
  final Set<String> _categories = {};
  final Set<String> _provinces = {};
  final Set<String> _specialisations = {};
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    for (final c in [_business, _reg, _desc, _phone, _farmName, _farmSize, _experience, _org, _qual, _baseRate]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit(AppUser u) async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    final body = <String, dynamic>{'fullName': u.fullName, 'province': u.province ?? _prov, 'district': u.district ?? _dist};
    if ((u.phone ?? '').isNotEmpty) body['phone'] = u.phone;
    String? t(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
    switch (u.role) {
      case UserRole.farmer:
        body.addAll({'farmingType': _farmingType, 'mainCrops': _crops.toList(), 'experienceYears': int.tryParse(_experience.text), 'farmName': t(_farmName), 'farmSize': num.tryParse(_farmSize.text), 'sizeUnit': _sizeUnit});
      case UserRole.buyer:
        body.addAll({'businessName': t(_business), 'buyerType': _buyerType, 'preferredCrops': _crops.toList()});
      case UserRole.supplier:
        body.addAll({'businessName': t(_business), 'registrationNumber': t(_reg), 'description': t(_desc), 'categories': _categories.toList()});
      case UserRole.transporter:
        body.addAll({'businessName': t(_business), 'contactPhone': t(_phone), 'pricingModel': _pricing, 'baseRate': num.tryParse(_baseRate.text), 'serviceProvinces': _provinces.toList()});
      case UserRole.expert:
        body.addAll({'organisation': t(_org), 'qualification': t(_qual), 'specialisations': _specialisations.toList()});
      case UserRole.distributor:
        body.addAll({'businessName': t(_business), 'registrationNumber': t(_reg), 'description': t(_desc), 'categories': _categories.toList(), 'contactPhone': t(_phone), 'serviceProvinces': _provinces.toList()});
      default:
        break;
    }
    body.removeWhere((k, v) => v == null);
    try {
      await ref.read(authRepositoryProvider).onboarding(body);
      await ref.read(authControllerProvider.notifier).refreshMe();
      if (mounted) context.go('/home');
    } on ApiException catch (e) {
      setState(() {
        _fe = e;
        _error = e.fieldErrors.isEmpty ? e.message : 'Please check: ${e.fieldErrors.keys.map((k) => k).join(', ')}.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _chips(String label, List<String> options, Set<String> selected, {List<String>? labels, String? error}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700, fontSize: 14.5)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (var i = 0; i < options.length; i++)
          FilterChip(
            label: Text(labels?[i] ?? options[i]),
            selected: selected.contains(options[i]),
            onSelected: (v) => setState(() => v ? selected.add(options[i]) : selected.remove(options[i])),
          ),
      ]),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(error, style: const TextStyle(color: AppColors.danger, fontSize: 12.5))),
      const SizedBox(height: 18),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final u = ref.watch(authControllerProvider).user;
    if (u == null) return const Scaffold(body: LoadingView());
    final crops = ref.watch(cropNamesProvider).value?.map((c) => c.s('name')).toList() ?? const <String>[];
    final cats = ref.watch(productCategoriesProvider).value?.map((c) => c.s('name')).toList() ?? const <String>[];
    final provinces = ref.watch(regionsProvider).value?.l('provinces') ?? const <Json>[];
    final gap = const SizedBox(height: 18);
    final needsBusiness = u.role == UserRole.supplier || u.role == UserRole.transporter || u.role == UserRole.distributor;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AuthHeader(title: 'A few details', subtitle: '${u.roleLabel} account · only the essentials. You can change these later.'),
              FormErrorBox(_error),
              if (u.province == null || u.district == null) ...[
                AppDropdown<String>(
                  label: 'Province',
                  value: _prov,
                  hint: 'Select province',
                  items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))],
                  onChanged: (v) => setState(() {
                    _prov = v;
                    _dist = null;
                  }),
                  validator: (v) => v == null ? 'Choose your province' : null,
                ),
                gap,
                AppDropdown<String>(
                  label: 'District',
                  value: _dist,
                  hint: _prov == null ? 'Choose a province first' : 'Select district',
                  items: [
                    for (final d in provinces.firstWhere((p) => p.s('value') == _prov, orElse: () => <String, dynamic>{}).ls('districts')) DropdownMenuItem(value: d, child: Text(d)),
                  ],
                  onChanged: _prov == null ? null : (v) => setState(() => _dist = v),
                  validator: (v) => v == null ? 'Choose your district' : null,
                ),
                gap,
              ],
              if (u.role == UserRole.buyer || needsBusiness) ...[
                AppTextField(
                  label: needsBusiness ? 'Business name' : 'Business name (optional)',
                  controller: _business,
                  validator: needsBusiness ? (v) => (v ?? '').trim().isEmpty ? 'Enter your business name' : null : null,
                  errorText: _fe?.field('businessName'),
                ),
                gap,
              ],
              if (u.role == UserRole.farmer) ...[
                AppDropdown<String>(
                  label: 'Type of farming',
                  value: _farmingType,
                  items: const [
                    DropdownMenuItem(value: 'SMALLHOLDER', child: Text('Smallholder')),
                    DropdownMenuItem(value: 'EMERGENT', child: Text('Emergent')),
                    DropdownMenuItem(value: 'COMMERCIAL', child: Text('Commercial')),
                    DropdownMenuItem(value: 'COOPERATIVE', child: Text('Cooperative')),
                    DropdownMenuItem(value: 'ORGANIC', child: Text('Organic')),
                    DropdownMenuItem(value: 'MIXED', child: Text('Mixed')),
                  ],
                  onChanged: (v) => setState(() => _farmingType = v ?? 'SMALLHOLDER'),
                ),
                gap,
                AppTextField(label: 'Years of farming (optional)', controller: _experience, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly]),
                gap,
                _chips('Main crops', crops, _crops),
                AppTextField(label: 'Farm name (optional)', controller: _farmName, textCapitalization: TextCapitalization.words),
                gap,
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: AppTextField(label: 'Farm size', controller: _farmSize, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppDropdown<String>(
                      label: 'Unit',
                      value: _sizeUnit,
                      items: const [DropdownMenuItem(value: 'HECTARES', child: Text('Hectares')), DropdownMenuItem(value: 'ACRES', child: Text('Acres'))],
                      onChanged: (v) => setState(() => _sizeUnit = v ?? 'HECTARES'),
                    ),
                  ),
                ]),
                gap,
              ],
              if (u.role == UserRole.buyer) ...[
                AppDropdown<String>(
                  label: 'Buyer type',
                  value: _buyerType,
                  hint: 'Select',
                  items: [for (final b in ['Trader', 'Processor / miller', 'Retailer', 'Exporter', 'Institution (school, hospital)', 'Individual']) DropdownMenuItem(value: b, child: Text(b))],
                  onChanged: (v) => setState(() => _buyerType = v),
                ),
                gap,
                _chips('Produce you buy', crops, _crops),
              ],
              if (u.role == UserRole.supplier || u.role == UserRole.distributor) ...[
                AppTextField(label: 'Business registration no. (optional)', controller: _reg, helper: 'e.g. PACRA number'),
                gap,
                AppTextField(label: 'About your business (optional)', controller: _desc, maxLines: 3),
                gap,
                _chips('Product categories', cats, _categories),
              ],
              if (u.role == UserRole.transporter || u.role == UserRole.distributor) ...[
                AppTextField(label: 'Dispatch phone (optional)', controller: _phone, keyboardType: TextInputType.phone, hint: '+260 …'),
                gap,
                _chips(
                  u.role == UserRole.distributor ? 'Provinces you deliver to' : 'Provinces you serve',
                  [for (final p in provinces) p.s('value')],
                  _provinces,
                  labels: [for (final p in provinces) p.s('label')],
                  error: _fe?.field('serviceProvinces'),
                ),
              ],
              if (u.role == UserRole.transporter) ...[
                AppDropdown<String>(
                  label: 'Pricing',
                  value: _pricing,
                  items: const [
                    DropdownMenuItem(value: 'NEGOTIABLE', child: Text('Negotiable per job')),
                    DropdownMenuItem(value: 'PER_KM', child: Text('Per kilometre')),
                    DropdownMenuItem(value: 'PER_TONNE', child: Text('Per tonne')),
                    DropdownMenuItem(value: 'PER_TRIP', child: Text('Per trip')),
                  ],
                  onChanged: (v) => setState(() => _pricing = v ?? 'NEGOTIABLE'),
                ),
                gap,
                AppTextField(label: 'Base rate in ZMW (optional)', controller: _baseRate, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
                gap,
              ],
              if (u.role == UserRole.expert) ...[
                AppTextField(label: 'Organisation (optional)', controller: _org, helper: 'e.g. ZARI, a university or an NGO'),
                gap,
                AppTextField(label: 'Qualification (optional)', controller: _qual, helper: 'e.g. BSc Agronomy'),
                gap,
                _chips('Specialisations', const ['Maize', 'Wheat', 'Soybeans', 'Groundnuts', 'Beans', 'Cassava', 'Vegetables', 'Plant pathology', 'Entomology (pests)', 'Soil fertility', 'Irrigation', 'Livestock'], _specialisations,
                    error: _fe?.field('specialisations')),
                const Text('An administrator verifies expert accounts before farmers\' cases are shown to you.', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                gap,
              ],
              const SizedBox(height: 6),
              PrimaryButton(label: 'Save and continue', loading: _busy, onPressed: () => _submit(u)),
              const SizedBox(height: 14),
              Center(child: TextButton(onPressed: () => ref.read(authControllerProvider.notifier).logout(), child: const Text('Sign out'))),
            ]),
          ),
        ),
      ),
    );
  }
}
