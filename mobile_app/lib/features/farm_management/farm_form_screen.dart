import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../authentication/presentation/auth_common.dart';
import 'farm_providers.dart';

class FarmFormScreen extends ConsumerStatefulWidget {
  const FarmFormScreen({super.key, this.existing});
  final Json? existing;
  @override
  ConsumerState<FarmFormScreen> createState() => _FarmFormScreenState();
}

class _FarmFormScreenState extends ConsumerState<FarmFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.s('name'));
  late final _size = TextEditingController(text: widget.existing?.sn('size'));
  late final _location = TextEditingController(text: widget.existing?.sn('location'));
  late final _desc = TextEditingController(text: widget.existing?.sn('description'));
  late String? _province = widget.existing?.sn('province');
  late String? _district = widget.existing?.sn('district');
  late String _unit = widget.existing?.s('sizeUnit', 'HECTARES') ?? 'HECTARES';
  late String _type = widget.existing?.s('farmingType', 'SMALLHOLDER') ?? 'SMALLHOLDER';
  late double? _lat = widget.existing?.nn('latitude')?.toDouble();
  late double? _lng = widget.existing?.nn('longitude')?.toDouble();
  bool _locating = false;
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void initState() {
    super.initState();
    if (widget.existing == null) {
      final u = ref.read(authControllerProvider).user;
      _province = u?.province;
      _district = u?.district;
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _size, _location, _desc]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _gps() async {
    setState(() => _locating = true);
    final r = await ref.read(locationServiceProvider).current();
    if (!mounted) return;
    setState(() => _locating = false);
    if (!r.ok) return showSnack(context, r.error!, error: true);
    if (r.lat! > -8.1 || r.lat! < -18.2 || r.lng! < 21.9 || r.lng! > 33.8) {
      return showSnack(context, 'That location is outside Zambia. Stand on the farm and try again.', error: true);
    }
    setState(() {
      _lat = r.lat;
      _lng = r.lng;
    });
    showSnack(context, 'Location captured (±${r.accuracy!.round()} m).');
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'province': _province,
      'district': _district,
      'size': num.tryParse(_size.text),
      'sizeUnit': _unit,
      'farmingType': _type,
      if (_location.text.trim().isNotEmpty) 'location': _location.text.trim(),
      if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
      if (_lat != null) 'latitude': _lat,
      if (_lng != null) 'longitude': _lng,
    };
    try {
      final api = ref.read(apiClientProvider);
      final id = widget.existing?.s('id');
      id == null ? await api.post('/farms', body) : await api.patch('/farms/$id', body);
      ref.invalidate(farmsProvider);
      if (id != null) ref.invalidate(farmDetailProvider(id));
      if (!mounted) return;
      showSnack(context, id == null ? 'Farm added.' : 'Farm updated.');
      context.pop();
    } on ApiException catch (e) {
      setState(() {
        _error = e.isNetwork ? 'You need a connection to add or edit a farm.' : e.message;
        _fe = e;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provinces = ref.watch(regionsProvider).value?.l('provinces') ?? const <Json>[];
    final districts = provinces.firstWhere((p) => p.s('value') == _province, orElse: () => <String, dynamic>{}).ls('districts');
    const gap = SizedBox(height: 16);
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Add farm' : 'Edit farm')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              FormErrorBox(_error),
              AppTextField(label: 'Farm name', controller: _name, textCapitalization: TextCapitalization.words, validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a name' : null, errorText: _fe?.field('name')),
              gap,
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: AppTextField(
                    label: 'Size',
                    controller: _size,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    validator: (v) => (num.tryParse(v ?? '') ?? 0) <= 0 ? 'Enter the size' : null,
                    errorText: _fe?.field('size'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppDropdown<String>(
                    label: 'Unit',
                    value: _unit,
                    items: const [DropdownMenuItem(value: 'HECTARES', child: Text('Hectares')), DropdownMenuItem(value: 'ACRES', child: Text('Acres'))],
                    onChanged: (v) => setState(() => _unit = v ?? 'HECTARES'),
                  ),
                ),
              ]),
              gap,
              AppDropdown<String>(
                label: 'Province',
                value: _province,
                hint: 'Select province',
                items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))],
                onChanged: (v) => setState(() {
                  _province = v;
                  _district = null;
                }),
                validator: (v) => v == null ? 'Choose a province' : null,
              ),
              gap,
              AppDropdown<String>(
                label: 'District',
                value: districts.contains(_district) ? _district : null,
                hint: 'Select district',
                items: [for (final d in districts) DropdownMenuItem(value: d, child: Text(d))],
                onChanged: (v) => setState(() => _district = v),
                validator: (v) => v == null ? 'Choose a district' : null,
                errorText: _fe?.field('district'),
              ),
              gap,
              AppTextField(label: 'Location / village (optional)', controller: _location),
              gap,
              const Text('GPS coordinates', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.ink, width: 1.3)),
                child: Row(children: [
                  Expanded(
                    child: Text(_lat == null ? 'Not set — weather will use the district centre.' : '${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}',
                        style: TextStyle(color: _lat == null ? AppColors.muted : AppColors.ink, fontWeight: FontWeight.w600)),
                  ),
                  TextButton.icon(
                    onPressed: _locating ? null : _gps,
                    icon: _locating ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location),
                    label: const Text('Use my location'),
                  ),
                ]),
              ),
              if (_fe?.field('latitude') != null || _fe?.field('longitude') != null)
                Padding(padding: const EdgeInsets.only(top: 6), child: Text('${_fe?.field('latitude') ?? ''} ${_fe?.field('longitude') ?? ''}', style: const TextStyle(color: AppColors.danger))),
              gap,
              AppDropdown<String>(
                label: 'Type of farming',
                value: _type,
                items: [for (final t in ['SMALLHOLDER', 'EMERGENT', 'COMMERCIAL', 'COOPERATIVE', 'ORGANIC', 'MIXED']) DropdownMenuItem(value: t, child: Text(t[0] + t.substring(1).toLowerCase()))],
                onChanged: (v) => setState(() => _type = v ?? 'SMALLHOLDER'),
              ),
              gap,
              AppTextField(label: 'Notes (optional)', controller: _desc, maxLines: 3),
              const SizedBox(height: 24),
              PrimaryButton(label: widget.existing == null ? 'Add farm' : 'Save changes', loading: _busy, onPressed: _save),
            ]),
          ),
        ),
      ),
    );
  }
}
