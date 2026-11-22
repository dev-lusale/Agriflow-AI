import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../authentication/presentation/auth_common.dart';
import '../farm_management/farm_providers.dart';
import 'market_providers.dart';
import 'market_widgets.dart';

const _draftKey = 'listing_draft_v1';

class SellListingScreen extends ConsumerStatefulWidget {
  const SellListingScreen({super.key});
  @override
  ConsumerState<SellListingScreen> createState() => _SellListingScreenState();
}

class _SellListingScreenState extends ConsumerState<SellListingScreen> {
  final _title = TextEditingController();
  final _variety = TextEditingController();
  final _qty = TextEditingController();
  final _price = TextEditingController();
  final _min = TextEditingController();
  final _pickup = TextEditingController();
  final _desc = TextEditingController();
  String? _cropId;
  String? _farmId;
  String _unit = 'BAG_50KG';
  String _grade = 'UNGRADED';
  String? _province;
  String? _district;
  final List<XFile> _photos = [];
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void initState() {
    super.initState();
    final u = ref.read(authControllerProvider).user;
    _province = u?.province;
    _district = u?.district;
    _restoreDraft();
  }

  @override
  void dispose() {
    for (final c in [_title, _variety, _qty, _price, _min, _pickup, _desc]) {
      c.dispose();
    }
    super.dispose();
  }

  String get _scopedKey => '${ref.read(authControllerProvider).user?.id}|$_draftKey';

  void _restoreDraft() {
    final raw = ref.read(prefsProvider).getString(_scopedKey);
    if (raw == null) return;
    final d = asJson(jsonDecode(raw));
    _title.text = d.s('title');
    _variety.text = d.s('variety');
    _qty.text = d.s('quantity');
    _price.text = d.s('pricePerUnit');
    _min.text = d.s('minOrderQuantity');
    _pickup.text = d.s('pickupLocation');
    _desc.text = d.s('description');
    _cropId = d.sn('cropId');
    _farmId = d.sn('farmId');
    _unit = d.s('unit', 'BAG_50KG');
    _grade = d.s('qualityGrade', 'UNGRADED');
    _province = d.sn('province') ?? _province;
    _district = d.sn('district') ?? _district;
    for (final p in d.ls('photos')) {
      if (File(p).existsSync()) _photos.add(XFile(p));
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) showSnack(context, 'Restored your saved draft.');
    });
  }

  Map<String, dynamic> _body() => {
        'cropId': _cropId,
        'farmId': _farmId,
        'title': _title.text.trim(),
        'variety': _variety.text.trim(),
        'quantity': _qty.text.trim(),
        'unit': _unit,
        'pricePerUnit': _price.text.trim(),
        'minOrderQuantity': _min.text.trim(),
        'province': _province,
        'district': _district,
        'pickupLocation': _pickup.text.trim(),
        'qualityGrade': _grade,
        'description': _desc.text.trim(),
      };

  Future<void> _saveDraft() async {
    await ref.read(prefsProvider).setString(_scopedKey, jsonEncode({..._body(), 'photos': _photos.map((p) => p.path).toList()}));
    if (mounted) showSnack(context, 'Draft saved on this phone. Publish it when you are online.');
  }

  Future<void> _publish() async {
    if (_busy) return;
    if (!(ref.read(onlineProvider).value ?? true)) {
      await _saveDraft();
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    try {
      final fields = _body()..removeWhere((k, v) => v == null || (v is String && v.isEmpty));
      final form = FormData();
      fields.forEach((k, v) => form.fields.add(MapEntry(k, '$v')));
      form.fields.add(const MapEntry('status', 'ACTIVE'));
      for (final p in _photos) {
        form.files.add(MapEntry('photos', await photoPart(p)));
      }
      final r = asJson(await ref.read(apiClientProvider).multipart('/marketplace/listings', form));
      await ref.read(prefsProvider).remove(_scopedKey);
      ref.invalidate(myListingsProvider);
      if (!mounted) return;
      showSnack(context, 'Listing published.');
      context.pushReplacement('/market/listing/${r.s('id')}');
    } on ApiException catch (e) {
      setState(() {
        _fe = e;
        _error = e.isNetwork ? 'No connection. Tap "Save draft" and publish later.' : (e.fieldErrors.isEmpty ? e.message : 'Please check the highlighted fields.');
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final crops = asJsonList(ref.watch(cropCatalogProvider).value?.data);
    final farms = asJsonList(ref.watch(farmsProvider).value?.data);
    final provinces = ref.watch(regionsProvider).value?.l('provinces') ?? const <Json>[];
    final districts = provinces.firstWhere((p) => p.s('value') == _province, orElse: () => <String, dynamic>{}).ls('districts');
    const gap = SizedBox(height: 16);
    return Scaffold(
      appBar: AppBar(title: const Text('Sell produce'), actions: [TextButton(onPressed: _saveDraft, child: const Text('Save draft'))]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FormErrorBox(_error),
          const Text('Photos (up to 4)', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          SizedBox(
            height: 96,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final p in _photos)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Stack(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.file(File(p.path), width: 96, height: 96, fit: BoxFit.cover)),
                    Positioned(
                      right: 2,
                      top: 2,
                      child: InkWell(
                        onTap: () => setState(() => _photos.remove(p)),
                        child: const CircleAvatar(radius: 12, backgroundColor: AppColors.ink, child: Icon(Icons.close, size: 14, color: AppColors.white)),
                      ),
                    ),
                  ]),
                ),
              if (_photos.length < 4)
                InkWell(
                  onTap: () async {
                    final p = await pickPhoto(context);
                    if (p != null) setState(() => _photos.add(p));
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.ink, width: 1.3)),
                    child: const Icon(Icons.add_a_photo_outlined),
                  ),
                ),
            ]),
          ),
          gap,
          AppDropdown<String>(
            label: 'Crop',
            value: _cropId,
            hint: 'Select crop',
            items: [for (final c in crops) DropdownMenuItem(value: c.s('id'), child: Text(c.s('name')))],
            onChanged: (v) => setState(() {
              _cropId = v;
              if (_title.text.isEmpty && v != null) _title.text = crops.firstWhere((c) => c.s('id') == v).s('name');
            }),
            errorText: _fe?.field('cropId'),
          ),
          gap,
          AppTextField(label: 'Produce name', controller: _title, hint: 'e.g. White maize, dry and clean', errorText: _fe?.field('title')),
          gap,
          AppTextField(label: 'Variety (optional)', controller: _variety),
          gap,
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: AppTextField(label: 'Quantity', controller: _qty, keyboardType: const TextInputType.numberWithOptions(decimal: true), errorText: _fe?.field('quantity'))),
            const SizedBox(width: 12),
            Expanded(
              child: AppDropdown<String>(
                label: 'Unit',
                value: _unit,
                items: [for (final u in quantityUnits) DropdownMenuItem(value: u, child: Text(unitLabel(u)))],
                onChanged: (v) => setState(() => _unit = v ?? 'KG'),
              ),
            ),
          ]),
          gap,
          AppTextField(label: 'Price per unit (ZMW)', controller: _price, keyboardType: const TextInputType.numberWithOptions(decimal: true), prefixText: 'K ', errorText: _fe?.field('pricePerUnit')),
          gap,
          AppTextField(label: 'Minimum order (optional)', controller: _min, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          gap,
          AppDropdown<String>(
            label: 'Quality grade',
            value: _grade,
            items: const [
              DropdownMenuItem(value: 'UNGRADED', child: Text('Ungraded')),
              DropdownMenuItem(value: 'GRADE_A', child: Text('Grade A')),
              DropdownMenuItem(value: 'GRADE_B', child: Text('Grade B')),
              DropdownMenuItem(value: 'GRADE_C', child: Text('Grade C')),
            ],
            onChanged: (v) => setState(() => _grade = v ?? 'UNGRADED'),
          ),
          gap,
          if (farms.isNotEmpty) ...[
            AppDropdown<String?>(
              label: 'From farm (optional)',
              value: _farmId,
              items: [const DropdownMenuItem<String?>(value: null, child: Text('Not specified')), for (final f in farms) DropdownMenuItem<String?>(value: f.s('id'), child: Text(f.s('name')))],
              onChanged: (v) => setState(() => _farmId = v),
            ),
            gap,
          ],
          AppDropdown<String>(
            label: 'Province',
            value: _province,
            items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))],
            onChanged: (v) => setState(() {
              _province = v;
              _district = null;
            }),
          ),
          gap,
          AppDropdown<String>(
            label: 'District',
            value: districts.contains(_district) ? _district : null,
            hint: 'Select district',
            items: [for (final d in districts) DropdownMenuItem(value: d, child: Text(d))],
            onChanged: (v) => setState(() => _district = v),
            errorText: _fe?.field('district'),
          ),
          gap,
          AppTextField(label: 'Pickup location (optional)', controller: _pickup),
          gap,
          AppTextField(label: 'Description (optional)', controller: _desc, maxLines: 4, hint: 'Moisture, packaging, storage, availability dates…'),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Publish listing', loading: _busy, onPressed: _publish),
          const SizedBox(height: 10),
          const Text('Listings are reviewed by AgriFlow moderators. Payments are agreed directly between buyer and seller.', style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
        ]),
      ),
    );
  }
}

class MyListingsScreen extends ConsumerWidget {
  const MyListingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(myListingsProvider);
    return PageScaffold(
      title: 'My listings',
      fab: FloatingActionButton(backgroundColor: AppColors.coral, foregroundColor: AppColors.white, tooltip: 'Sell produce', onPressed: () => context.push('/market/sell'), child: const Icon(Icons.add)),
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(myListingsProvider.future),
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) return [EmptyView(icon: Icons.sell_outlined, title: 'No listings yet', message: 'List your harvest so buyers across Zambia can find it.', actionLabel: 'Sell produce', onAction: () => context.push('/market/sell'))];
          return [
            for (final l in list)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  padding: EdgeInsets.zero,
                  child: Row(children: [
                    SizedBox(width: 86, height: 86, child: UploadImage(uploadId: l.l('images').isNotEmpty ? l.l('images').first.s('uploadId') : null, label: l.s('title'))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(l.s('title'), style: const TextStyle(fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('${zmw(l.nn('pricePerUnit'))} / ${unitLabel(l.s('unit'))} · ${numFmt(l.nn('quantityAvailable'))} left', style: const TextStyle(fontSize: 13)),
                        const SizedBox(height: 4),
                        Wrap(spacing: 6, children: [
                          Pill(labelize(l.s('status')), color: l.s('status') == 'ACTIVE' ? AppColors.leafSoft : AppColors.surfaceAlt),
                          if (l.s('moderationStatus') != 'APPROVED') Pill(labelize(l.s('moderationStatus')), color: AppColors.amberSoft),
                        ]),
                      ]),
                    ),
                    PopupMenuButton<String>(
                      tooltip: 'Listing options',
                      onSelected: (a) async {
                        if (a == 'view') {
                          context.push('/market/listing/${l.s('id')}');
                          return;
                        }
                        try {
                          await ref.read(apiClientProvider).post('/marketplace/listings/${l.s('id')}/status', {'status': a});
                          ref.invalidate(myListingsProvider);
                        } on ApiException catch (e) {
                          if (context.mounted) showSnack(context, e.message, error: true);
                        }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(value: 'view', child: Text('View')),
                        if (l.s('status') != 'ACTIVE') const PopupMenuItem(value: 'ACTIVE', child: Text('Make active')),
                        if (l.s('status') == 'ACTIVE') const PopupMenuItem(value: 'INACTIVE', child: Text('Pause listing')),
                      ],
                    ),
                  ]),
                ),
              ),
          ];
        },
      ),
    );
  }
}
