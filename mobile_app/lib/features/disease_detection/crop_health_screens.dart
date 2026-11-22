import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../authentication/presentation/auth_common.dart';
import '../farm_management/farm_providers.dart';

final assessmentsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/crop-health'));
final assessmentProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/crop-health/$id'));

class CropHealthNewScreen extends ConsumerStatefulWidget {
  const CropHealthNewScreen({super.key});
  @override
  ConsumerState<CropHealthNewScreen> createState() => _CropHealthNewScreenState();
}

class _CropHealthNewScreenState extends ConsumerState<CropHealthNewScreen> {
  XFile? _photo;
  String? _cropId;
  String? _farmId;
  final _symptoms = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _symptoms.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    if (_cropId == null) return setState(() => _error = 'Choose the crop.');
    if (_symptoms.text.trim().length < 10) return setState(() => _error = 'Describe what you see (at least a short sentence).');
    if (!(ref.read(onlineProvider).value ?? true)) return setState(() => _error = 'A crop-health check needs an internet connection.');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final form = FormData.fromMap({
        'cropId': _cropId,
        if (_farmId != null) 'farmId': _farmId,
        'symptoms': _symptoms.text.trim(),
        if (_photo != null) 'image': await photoPart(_photo!),
      });
      final r = asJson(await ref.read(apiClientProvider).multipart('/crop-health', form));
      ref.invalidate(assessmentsProvider);
      if (mounted) context.pushReplacement('/crop-health/${r.s('id')}');
    } on ApiException catch (e) {
      setState(() => _error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final crops = asJsonList(ref.watch(cropCatalogProvider).value?.data);
    final farms = asJsonList(ref.watch(farmsProvider).value?.data);
    return Scaffold(
      appBar: AppBar(title: const Text('Crop health check'), actions: [
        TextButton(onPressed: () => context.push('/crop-health'), child: const Text('History')),
      ]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const _Steps(),
          const SizedBox(height: 18),
          FormErrorBox(_error),
          InkWell(
            onTap: () async {
              final p = await pickPhoto(context);
              if (p != null) setState(() => _photo = p);
            },
            borderRadius: BorderRadius.circular(16),
            child: Container(
              height: 220,
              decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.ink, width: 1.4), boxShadow: hardShadow(2, 3)),
              clipBehavior: Clip.antiAlias,
              child: _photo == null
                  ? const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.add_a_photo_outlined, size: 44),
                      SizedBox(height: 10),
                      Text('Add a clear photo of the affected leaves', style: TextStyle(fontWeight: FontWeight.w800)),
                      SizedBox(height: 4),
                      Text('Camera or gallery · optional but recommended', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                    ])
                  : Stack(fit: StackFit.expand, children: [
                      Image.file(File(_photo!.path), fit: BoxFit.cover),
                      Positioned(
                        right: 8,
                        top: 8,
                        child: IconButton.filled(
                          tooltip: 'Remove photo',
                          style: IconButton.styleFrom(backgroundColor: AppColors.ink),
                          onPressed: () => setState(() => _photo = null),
                          icon: const Icon(Icons.close, color: AppColors.white),
                        ),
                      ),
                    ]),
            ),
          ),
          const SizedBox(height: 18),
          AppDropdown<String>(
            label: 'Crop',
            value: _cropId,
            hint: 'Select crop',
            items: [for (final c in crops) DropdownMenuItem(value: c.s('id'), child: Text(c.s('name')))],
            onChanged: (v) => setState(() => _cropId = v),
          ),
          const SizedBox(height: 16),
          if (farms.isNotEmpty) ...[
            AppDropdown<String?>(
              label: 'Farm (optional)',
              value: _farmId,
              items: [const DropdownMenuItem<String?>(value: null, child: Text('Not linked to a farm')), for (final f in farms) DropdownMenuItem<String?>(value: f.s('id'), child: Text(f.s('name')))],
              onChanged: (v) => setState(() => _farmId = v),
            ),
            const SizedBox(height: 16),
          ],
          AppTextField(
            label: 'What do you see?',
            controller: _symptoms,
            maxLines: 4,
            hint: 'e.g. Yellow streaks on lower leaves, holes in the funnel, started a week ago after heavy rain…',
          ),
          const SizedBox(height: 22),
          PrimaryButton(label: 'Get advice', icon: Icons.healing_outlined, loading: _busy, onPressed: _submit),
          const SizedBox(height: 12),
          const Text(
            'AgriFlow AI (Grok vision) gives an AI-assisted assessment, not a laboratory diagnosis. For serious or spreading problems, ask a verified expert or your extension officer.',
            style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.4),
          ),
        ]),
      ),
    );
  }
}

class _Steps extends StatelessWidget {
  const _Steps();
  @override
  Widget build(BuildContext context) {
    Widget step(int n, String t, IconData i) => Expanded(
          child: Column(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: AppColors.coralSoft, shape: BoxShape.circle, border: Border.all(color: AppColors.ink, width: 1.3)),
              child: Icon(i, size: 22),
            ),
            const SizedBox(height: 6),
            Text('$n. $t', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
          ]),
        );
    return Row(children: [step(1, 'Upload photo', Icons.photo_camera_outlined), step(2, 'Add details', Icons.edit_note), step(3, 'Get advice', Icons.tips_and_updates_outlined)]);
  }
}

Color confidenceColor(String c) => c == 'HIGH' ? AppColors.leafSoft : c == 'MEDIUM' ? AppColors.amberSoft : AppColors.dangerSoft;

class CropHealthResultScreen extends ConsumerWidget {
  const CropHealthResultScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(assessmentProvider(id));
    final api = ref.read(apiClientProvider);
    return PageScaffold(
      title: 'Crop health result',
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(assessmentProvider(id).future),
        builder: (raw) {
          final a = asJson(raw);
          final r = a.m('result');
          final status = a.s('status');
          return [
            if (a.sn('imageId') != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: CachedNetworkImage(imageUrl: api.uploadUrl(a.s('imageId')), httpHeaders: api.authHeaders, height: 220, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox(height: 60, child: Center(child: Text('Photo unavailable offline')))),
              ),
            const SizedBox(height: 14),
            Text(a.m('crop').s('name'), style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700)),
            Text(status == 'COMPLETED' ? a.s('possibleIssue', 'Assessment') : status == 'FAILED' ? 'AI assessment unavailable' : 'Assessment pending', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            if (status == 'COMPLETED' && a.sn('confidence') != null)
              Row(children: [
                Pill('AI confidence: ${labelize(a.s('confidence'))}', color: confidenceColor(a.s('confidence'))),
                const SizedBox(width: 6),
                const Flexible(child: Text('(the model\'s own estimate)', style: TextStyle(fontSize: 12, color: AppColors.muted))),
              ]),
            if (status != 'COMPLETED') ...[
              const SizedBox(height: 8),
              Text(r.s('error', 'Grok could not assess this case right now. Your photo and description are saved.'), style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 12),
              SecondaryButton(
                label: 'Try the AI check again',
                icon: Icons.refresh,
                onPressed: () async {
                  try {
                    await api.post('/crop-health/$id/retry');
                    ref.invalidate(assessmentProvider(id));
                  } on ApiException catch (e) {
                    if (context.mounted) showSnack(context, e.message, error: true);
                  }
                },
              ),
            ],
            if (status == 'COMPLETED') ...[
              if (r.sn('confidence_explanation') != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(r.s('confidence_explanation'))),
              const SizedBox(height: 14),
              AppCard(
                color: a.b('expertRecommended') ? AppColors.dangerSoft : AppColors.leafSoft,
                shadow: false,
                child: Text(
                  a.b('expertRecommended') ? 'Expert inspection recommended: confirm with an agronomist or your camp extension officer before treating.' : 'Expert inspection not required now. Keep monitoring and ask an expert if it spreads.',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              _list('Symptoms', r.ls('visible_symptoms')),
              if (r.l('possible_causes').isNotEmpty) ...[
                const SectionHeader('Possible causes'),
                for (final c in r.l('possible_causes'))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      shadow: false,
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [Expanded(child: Text(c.s('name'), style: const TextStyle(fontWeight: FontWeight.w800))), Pill(labelize(c.s('likelihood')), color: confidenceColor(c.s('likelihood')))]),
                        const SizedBox(height: 4),
                        Text(c.s('why'), style: const TextStyle(color: AppColors.muted)),
                      ]),
                    ),
                  ),
              ],
              _list('Recommended steps', r.ls('next_steps'), ordered: true),
              _list('Prevention', r.ls('prevention')),
              if (r.sn('safety_note') != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: AppCard(color: AppColors.amberSoft, shadow: false, child: Text('Safety: ${r.s('safety_note')}')),
                ),
              const SectionHeader('Second opinion'),
              _ExpertBlock(a: a, onRequested: () => ref.invalidate(assessmentProvider(id))),
              const SizedBox(height: 14),
              Text('AI-assisted assessment by ${a.s('model', 'Grok')} on ${dateTimeFmt(a.d('createdAt'))}. Not a definitive diagnosis. Use only products registered for this crop in Zambia and follow the label.',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ],
          ];
        },
      ),
    );
  }

  Widget _list(String title, List<String> items, {bool ordered = false}) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionHeader(title),
      for (var i = 0; i < items.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 22, child: Text(ordered ? '${i + 1}.' : '•', style: const TextStyle(fontWeight: FontWeight.w800))),
            Expanded(child: Text(items[i])),
          ]),
        ),
    ]);
  }
}

class _ExpertBlock extends ConsumerStatefulWidget {
  const _ExpertBlock({required this.a, required this.onRequested});
  final Json a;
  final VoidCallback onRequested;
  @override
  ConsumerState<_ExpertBlock> createState() => _ExpertBlockState();
}

class _ExpertBlockState extends ConsumerState<_ExpertBlock> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final a = widget.a;
    switch (a.s('expertReviewStatus', 'NONE')) {
      case 'ANSWERED':
        return AppCard(
          color: AppColors.leafSoft,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Verified expert says', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(a.s('expertNote')),
            const SizedBox(height: 6),
            Text('Reviewed ${dateTimeFmt(a.d('expertReviewedAt'))}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ]),
        );
      case 'REQUESTED':
        return const AppCard(color: AppColors.skySoft, shadow: false, child: Text('Sent to verified experts. You will get a notification when one replies.', style: TextStyle(fontWeight: FontWeight.w600)));
      default:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Verified experts see the photo, crop and symptoms — not your name or contact details.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 10),
          SecondaryButton(
            label: 'Ask a verified expert',
            icon: Icons.school_outlined,
            loading: _busy,
            onPressed: () async {
              setState(() => _busy = true);
              try {
                final r = asJson(await ref.read(apiClientProvider).post('/crop-health/${a.s('id')}/expert-review'));
                widget.onRequested();
                if (context.mounted) {
                  showSnack(context, r.n('verifiedExperts') > 0 ? 'Sent to ${r.n('verifiedExperts').toInt()} verified expert(s).' : 'Sent. No expert is verified yet; your case will wait in the queue.');
                }
              } on ApiException catch (e) {
                if (context.mounted) showSnack(context, e.message, error: true);
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
        ]);
    }
  }
}

class CropHealthHistoryScreen extends ConsumerWidget {
  const CropHealthHistoryScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(assessmentsProvider);
    return PageScaffold(
      title: 'Crop health history',
      fab: FloatingActionButton(backgroundColor: AppColors.coral, foregroundColor: AppColors.white, tooltip: 'New check', onPressed: () => context.push('/crop-health/new'), child: const Icon(Icons.add_a_photo_outlined)),
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(assessmentsProvider.future),
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) return [const EmptyView(icon: Icons.healing_outlined, title: 'No checks yet', message: 'Take a photo of a sick plant to get AI-assisted advice.')];
          return [
            for (final a in list)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => context.push('/crop-health/${a.s('id')}'),
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${a.m('crop').s('name')} · ${a.s('possibleIssue', labelize(a.s('status')))}', style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text(dateTimeFmt(a.d('createdAt')), style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                      ]),
                    ),
                    if (a.s('expertReviewStatus') == 'ANSWERED') const Pill('Expert replied', color: AppColors.leafSoft),
                    if (a.s('expertReviewStatus') == 'REQUESTED') const Pill('With expert', color: AppColors.skySoft),
                  ]),
                ),
              ),
          ];
        },
      ),
    );
  }
}
