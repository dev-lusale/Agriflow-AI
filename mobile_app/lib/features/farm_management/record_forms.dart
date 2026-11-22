import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/states.dart';
import '../authentication/presentation/auth_common.dart';
import 'farm_providers.dart';

String? _err(ApiException? e, String f) => e?.field(f);

/// Add or edit a crop record (planting through to harvest).
class CropRecordFormScreen extends ConsumerStatefulWidget {
  const CropRecordFormScreen({super.key, this.existing, this.farmId});
  final Json? existing;
  final String? farmId;
  @override
  ConsumerState<CropRecordFormScreen> createState() => _CropRecordFormScreenState();
}

class _CropRecordFormScreenState extends ConsumerState<CropRecordFormScreen> {
  late final e = widget.existing;
  late String? _farmId = e?.m('farm').sn('id') ?? e?.sn('farmId') ?? widget.farmId;
  late String? _cropId = e?.m('crop').sn('id') ?? e?.sn('cropId');
  late final _variety = TextEditingController(text: e?.sn('variety'));
  late final _area = TextEditingController(text: e?.sn('areaPlanted'));
  late final _estimate = TextEditingController(text: e?.sn('estimatedYield'));
  late final _actual = TextEditingController(text: e?.sn('actualHarvest'));
  late final _notes = TextEditingController(text: e?.sn('notes'));
  late DateTime? _planted = e?.d('plantingDate');
  late DateTime? _harvest = e?.d('expectedHarvestDate');
  late String _stage = e?.s('growthStage', 'PLANNED') ?? 'PLANNED';
  late String _status = e?.s('status', 'PLANNED') ?? 'PLANNED';
  late String _unit = e?.s('yieldUnit', 'KG') ?? 'KG';
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    for (final c in [_variety, _area, _estimate, _actual, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    if (_farmId == null || _cropId == null) return setState(() => _error = 'Choose the farm and the crop.');
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    String? t(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
    final body = <String, dynamic>{
      'farmId': _farmId,
      'cropId': _cropId,
      'variety': t(_variety),
      'areaPlanted': num.tryParse(_area.text),
      'plantingDate': _planted == null ? null : isoDate(_planted!),
      'expectedHarvestDate': _harvest == null ? null : isoDate(_harvest!),
      'growthStage': _stage,
      'status': _status,
      'estimatedYield': num.tryParse(_estimate.text),
      'actualHarvest': num.tryParse(_actual.text),
      'yieldUnit': _unit,
      'notes': t(_notes),
    }..removeWhere((k, v) => v == null);
    try {
      final api = ref.read(apiClientProvider);
      e == null ? await api.post('/crop-records', body) : await api.patch('/crop-records/${e!.s('id')}', body);
      ref.invalidate(cropRecordsProvider);
      ref.invalidate(farmDetailProvider(_farmId!));
      ref.invalidate(farmsProvider);
      if (!mounted) return;
      showSnack(context, 'Crop saved.');
      context.pop();
    } on ApiException catch (x) {
      setState(() {
        _error = x.isNetwork ? 'You need a connection to save crop records. Farm activities can be recorded offline.' : x.message;
        _fe = x;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final farms = asJsonList(ref.watch(farmsProvider).value?.data);
    final crops = asJsonList(ref.watch(cropCatalogProvider).value?.data);
    const gap = SizedBox(height: 16);
    return Scaffold(
      appBar: AppBar(
        title: Text(e == null ? 'Add crop' : 'Crop record'),
        actions: [
          if (e != null)
            IconButton(
              tooltip: 'Delete',
              icon: const Icon(Icons.delete_outline),
              onPressed: () async {
                if (!await confirmDialog(context, title: 'Delete this crop record?', message: 'This cannot be undone.', confirm: 'Delete', destructive: true)) return;
                try {
                  await ref.read(apiClientProvider).delete('/crop-records/${e!.s('id')}');
                  ref.invalidate(cropRecordsProvider);
                  if (_farmId != null) ref.invalidate(farmDetailProvider(_farmId!));
                  if (context.mounted) context.pop();
                } on ApiException catch (x) {
                  if (context.mounted) showSnack(context, x.message, error: true);
                }
              },
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FormErrorBox(_error),
          if (e != null && _status == 'GROWING')
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: SecondaryButton(
                label: 'Ask AgriFlow AI about this crop',
                icon: Icons.auto_awesome,
                onPressed: () => context.push('/ai/advice/${e!.s('id')}', extra: '${e!.m('crop').s('name')} at ${e!.m('farm').s('name')}'),
              ),
            ),
          AppDropdown<String>(
            label: 'Farm',
            value: farms.any((f) => f.s('id') == _farmId) ? _farmId : null,
            hint: farms.isEmpty ? 'Add a farm first' : 'Select farm',
            items: [for (final f in farms) DropdownMenuItem(value: f.s('id'), child: Text(f.s('name')))],
            onChanged: e == null ? (v) => setState(() => _farmId = v) : null,
            errorText: _err(_fe, 'farmId'),
          ),
          gap,
          AppDropdown<String>(
            label: 'Crop',
            value: crops.any((c) => c.s('id') == _cropId) ? _cropId : null,
            hint: 'Select crop',
            items: [for (final c in crops) DropdownMenuItem(value: c.s('id'), child: Text(c.s('name')))],
            onChanged: (v) => setState(() => _cropId = v),
            errorText: _err(_fe, 'cropId'),
          ),
          gap,
          AppTextField(label: 'Variety (optional)', controller: _variety, hint: 'e.g. SC 627'),
          gap,
          AppTextField(label: 'Area planted, hectares (optional)', controller: _area, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          gap,
          AppDateField(label: 'Planting date', value: _planted, optional: true, onChanged: (d) => setState(() => _planted = d)),
          gap,
          AppDateField(label: 'Expected harvest date', value: _harvest, optional: true, onChanged: (d) => setState(() => _harvest = d), errorText: _err(_fe, 'expectedHarvestDate')),
          gap,
          AppDropdown<String>(
            label: 'Growth stage',
            value: _stage,
            items: [for (final s in growthStages.entries) DropdownMenuItem(value: s.key, child: Text(s.value))],
            onChanged: (v) => setState(() => _stage = v ?? 'PLANNED'),
          ),
          gap,
          AppDropdown<String>(
            label: 'Status',
            value: _status,
            items: const [
              DropdownMenuItem(value: 'PLANNED', child: Text('Planned')),
              DropdownMenuItem(value: 'GROWING', child: Text('Growing')),
              DropdownMenuItem(value: 'HARVESTED', child: Text('Harvested')),
              DropdownMenuItem(value: 'FAILED', child: Text('Failed')),
            ],
            onChanged: (v) => setState(() => _status = v ?? 'PLANNED'),
          ),
          gap,
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: AppTextField(label: 'Expected yield', controller: _estimate, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
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
          AppTextField(label: 'Actual harvest (when harvested)', controller: _actual, keyboardType: const TextInputType.numberWithOptions(decimal: true), helper: 'Record your harvest here and set the status to Harvested.'),
          gap,
          AppTextField(label: 'Notes (optional)', controller: _notes, maxLines: 3),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Save crop', loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}

/// Record a farm activity — works offline (queued and synced later).
class ActivityFormScreen extends ConsumerStatefulWidget {
  const ActivityFormScreen({super.key, this.farmId, this.type});
  final String? farmId;
  final String? type;
  @override
  ConsumerState<ActivityFormScreen> createState() => _ActivityFormScreenState();
}

class _ActivityFormScreenState extends ConsumerState<ActivityFormScreen> {
  late String? _farmId = widget.farmId;
  String? _cropRecordId;
  late String _type = widget.type ?? 'FERTILIZER_APPLICATION';
  DateTime _date = DateTime.now();
  final _qty = TextEditingController();
  final _unit = TextEditingController();
  final _cost = TextEditingController();
  final _notes = TextEditingController();
  bool _expense = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_qty, _unit, _cost, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    if (_farmId == null) return setState(() => _error = 'Choose the farm.');
    setState(() {
      _busy = true;
      _error = null;
    });
    final cost = num.tryParse(_cost.text);
    final body = <String, dynamic>{
      'farmId': _farmId,
      'cropRecordId': _cropRecordId,
      'type': _type,
      'date': isoDate(_date),
      'quantity': num.tryParse(_qty.text),
      'unit': _unit.text.trim().isEmpty ? null : _unit.text.trim(),
      'cost': cost,
      'recordExpense': cost != null && _expense,
      'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
    }..removeWhere((k, v) => v == null);
    try {
      final online = await saveOrQueue(ref, path: '/activities', kind: 'activity.create', body: body, label: '${activityTypes[_type]} · ${dateFmt(_date)}');
      ref.invalidate(activitiesProvider);
      if (!mounted) return;
      showSnack(context, online ? 'Activity recorded.' : 'Saved on this phone. It will sync when you are back online.');
      context.pop();
    } on ApiException catch (e) {
      setState(() => _error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final farms = asJsonList(ref.watch(farmsProvider).value?.data);
    final crops = asJsonList(ref.watch(cropRecordsProvider).value?.data).where((c) => c.m('farm').s('id') == _farmId).toList();
    final online = ref.watch(onlineProvider).value ?? true;
    const gap = SizedBox(height: 16);
    return Scaffold(
      appBar: AppBar(title: const Text('Record activity')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (!online)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(12)),
              child: const Text('You are offline. This activity will be saved on your phone and synced automatically later.', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          FormErrorBox(_error),
          AppDropdown<String>(
            label: 'Farm',
            value: farms.any((f) => f.s('id') == _farmId) ? _farmId : null,
            hint: farms.isEmpty ? 'Add a farm first (needs a connection)' : 'Select farm',
            items: [for (final f in farms) DropdownMenuItem(value: f.s('id'), child: Text(f.s('name')))],
            onChanged: (v) => setState(() {
              _farmId = v;
              _cropRecordId = null;
            }),
          ),
          gap,
          AppDropdown<String>(
            label: 'Activity',
            value: _type,
            items: [for (final a in activityTypes.entries) DropdownMenuItem(value: a.key, child: Text(a.value))],
            onChanged: (v) => setState(() => _type = v ?? 'OTHER'),
          ),
          gap,
          if (crops.isNotEmpty) ...[
            AppDropdown<String?>(
              label: 'Crop (optional)',
              value: _cropRecordId,
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('Whole farm')),
                for (final c in crops) DropdownMenuItem<String?>(value: c.s('id'), child: Text('${c.m('crop').s('name')}${c.sn('variety') != null ? ' (${c.s('variety')})' : ''}')),
              ],
              onChanged: (v) => setState(() => _cropRecordId = v),
            ),
            gap,
          ],
          AppDateField(label: 'Date', value: _date, lastDate: DateTime.now().add(const Duration(days: 1)), onChanged: (d) => setState(() => _date = d ?? DateTime.now())),
          gap,
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: AppTextField(label: 'Quantity (optional)', controller: _qty, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
            const SizedBox(width: 12),
            Expanded(child: AppTextField(label: 'Unit', controller: _unit, hint: 'kg, L, bags')),
          ]),
          gap,
          AppTextField(label: 'Cost in ZMW (optional)', controller: _cost, keyboardType: const TextInputType.numberWithOptions(decimal: true), prefixText: 'K ', onChanged: (_) => setState(() {})),
          if (num.tryParse(_cost.text) != null)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _expense,
              onChanged: (v) => setState(() => _expense = v == true),
              title: const Text('Also add this cost to my farm expenses'),
              controlAffinity: ListTileControlAffinity.leading,
            ),
          gap,
          AppTextField(label: 'Notes (optional)', controller: _notes, maxLines: 3, hint: 'Product used, rate, workers, observations…'),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Save activity', loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}

/// Tasks and reminders.
class TasksScreen extends ConsumerWidget {
  const TasksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(tasksProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.coral,
        foregroundColor: AppColors.white,
        tooltip: 'Add task',
        onPressed: () => context.push('/tasks/new'),
        child: const Icon(Icons.add),
      ),
      body: v.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(tasksProvider)),
        data: (c) {
          final list = asJsonList(c.data);
          final pending = list.where((t) => t.s('status') == 'PENDING').toList();
          final done = list.where((t) => t.s('status') != 'PENDING').toList();
          if (list.isEmpty) return const EmptyView(icon: Icons.checklist, title: 'No tasks yet', message: 'Add reminders for planting, spraying, weeding and harvest.');
          return RefreshIndicator(
            onRefresh: () => ref.refresh(tasksProvider.future),
            child: ListView(padding: const EdgeInsets.all(16), children: [
              for (final t in [...pending, ...done])
                CheckboxListTile(
                  value: t.s('status') == 'DONE',
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(t.s('title'), style: TextStyle(decoration: t.s('status') == 'DONE' ? TextDecoration.lineThrough : null, fontWeight: FontWeight.w700)),
                  subtitle: Text('${dayFmt(t.d('dueDate'))}${t.mn('farm') != null ? ' · ${t.m('farm').s('name')}' : ''}'),
                  onChanged: t.s('status') == 'PENDING'
                      ? (_) async {
                          try {
                            final ok = await saveOrQueue(ref, path: '/tasks/${t.s('id')}/status', kind: 'task.complete', body: {'id': t.s('id'), 'status': 'DONE'}, label: 'Complete: ${t.s('title')}');
                            ref.invalidate(tasksProvider);
                            if (!ok && context.mounted) showSnack(context, 'Marked done on this phone; it will sync later.');
                          } on ApiException catch (e) {
                            if (context.mounted) showSnack(context, e.message, error: true);
                          }
                        }
                      : null,
                ),
            ]),
          );
        },
      ),
    );
  }
}

class TaskFormScreen extends ConsumerStatefulWidget {
  const TaskFormScreen({super.key});
  @override
  ConsumerState<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends ConsumerState<TaskFormScreen> {
  final _title = TextEditingController();
  final _desc = TextEditingController();
  String? _farmId;
  String _type = 'OTHER';
  DateTime _due = DateTime.now().add(const Duration(days: 1));
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    if (_title.text.trim().isEmpty) return setState(() => _error = 'Give the task a title.');
    setState(() => _busy = true);
    final body = <String, dynamic>{
      'title': _title.text.trim(),
      'description': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
      'farmId': _farmId,
      'type': _type,
      'dueDate': isoDate(_due),
      'reminder': true,
    }..removeWhere((k, v) => v == null);
    try {
      final ok = await saveOrQueue(ref, path: '/tasks', kind: 'task.create', body: body, label: 'Task: ${_title.text.trim()}');
      ref.invalidate(tasksProvider);
      if (!mounted) return;
      showSnack(context, ok ? 'Task added.' : 'Saved on this phone; it will sync later.');
      context.pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final farms = asJsonList(ref.watch(farmsProvider).value?.data);
    const gap = SizedBox(height: 16);
    return Scaffold(
      appBar: AppBar(title: const Text('New task')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FormErrorBox(_error),
          AppTextField(label: 'Title', controller: _title, hint: 'e.g. Top-dress maize with urea'),
          gap,
          AppDropdown<String?>(
            label: 'Farm (optional)',
            value: _farmId,
            items: [const DropdownMenuItem<String?>(value: null, child: Text('No specific farm')), for (final f in farms) DropdownMenuItem<String?>(value: f.s('id'), child: Text(f.s('name')))],
            onChanged: (v) => setState(() => _farmId = v),
          ),
          gap,
          AppDropdown<String>(
            label: 'Type',
            value: _type,
            items: [for (final a in activityTypes.entries) DropdownMenuItem(value: a.key, child: Text(a.value))],
            onChanged: (v) => setState(() => _type = v ?? 'OTHER'),
          ),
          gap,
          AppDateField(label: 'Due date', value: _due, onChanged: (d) => setState(() => _due = d ?? _due)),
          gap,
          AppTextField(label: 'Details (optional)', controller: _desc, maxLines: 3),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Add task', loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}
