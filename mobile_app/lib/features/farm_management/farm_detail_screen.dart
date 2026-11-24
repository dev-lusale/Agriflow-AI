import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import '../../core/widgets/states.dart';
import 'farm_providers.dart';

class FarmDetailScreen extends ConsumerWidget {
  const FarmDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(farmDetailProvider(id));
    final f = asJson(v.value?.data);
    return PageScaffold(
      title: f.s('name', 'Farm'),
      actions: [
        if (f.isNotEmpty) IconButton(tooltip: 'Edit farm', icon: const Icon(Icons.edit_outlined), onPressed: () => context.push('/farms/$id/edit', extra: f)),
        if (f.isNotEmpty)
          IconButton(
            tooltip: 'Delete farm',
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              if (!await confirmDialog(context, title: 'Delete ${f.s('name')}?', message: 'Its fields, crops and activity records will be deleted too. This cannot be undone.', confirm: 'Delete', destructive: true)) return;
              try {
                await ref.read(apiClientProvider).delete('/farms/$id');
                ref.invalidate(farmsProvider);
                if (context.mounted) {
                  showSnack(context, 'Farm deleted.');
                  context.pop();
                }
              } on ApiException catch (e) {
                if (context.mounted) showSnack(context, e.message, error: true);
              }
            },
          ),
      ],
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(farmDetailProvider(id).future),
        builder: (raw) {
          final farm = asJson(raw);
          final fields = farm.l('fields');
          final crops = farm.l('cropRecords');
          return [
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${numFmt(farm.nn('size'))} ${labelize(farm.s('sizeUnit')).toLowerCase()} · ${labelize(farm.s('farmingType'))}', style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${farm.s('district')}, ${labelize(farm.s('province'))}${farm.sn('location') != null ? ' · ${farm.s('location')}' : ''}'),
                const SizedBox(height: 4),
                Text(
                  farm.sn('latitude') != null ? 'GPS: ${farm.n('latitude').toStringAsFixed(5)}, ${farm.n('longitude').toStringAsFixed(5)}' : 'No GPS point — add one for precise weather.',
                  style: TextStyle(color: farm.sn('latitude') != null ? AppColors.muted : AppColors.amber, fontSize: 13),
                ),
                if (farm.sn('description') != null) ...[const SizedBox(height: 8), Text(farm.s('description'))],
              ]),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: SecondaryButton(label: 'Weather', icon: Icons.wb_sunny_outlined, onPressed: () => context.push('/weather?farmId=$id'))),
              const SizedBox(width: 10),
              Expanded(child: SecondaryButton(label: 'Activity', icon: Icons.edit_note, onPressed: () => context.push('/activities/new?farmId=$id'))),
            ]),
            SectionHeader('Fields', action: 'Add field', onAction: () => _addField(context, ref)),
            if (fields.isEmpty)
              const Text('No fields yet. Fields help you track crops plot by plot.', style: TextStyle(color: AppColors.muted))
            else
              for (final fl in fields)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    shadow: false,
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(fl.s('name'), style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text('${numFmt(fl.nn('area'))} ${labelize(fl.s('areaUnit')).toLowerCase()} · ${labelize(fl.s('irrigation'))}${fl.sn('soilType') != null ? ' · ${fl.s('soilType')}' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                        ]),
                      ),
                      Pill(labelize(fl.s('status'))),
                    ]),
                  ),
                ),
            SectionHeader('Crops', action: 'Add crop', onAction: () => context.push('/crop-records/new?farmId=$id')),
            if (crops.isEmpty)
              const Text('No crops recorded on this farm yet.', style: TextStyle(color: AppColors.muted))
            else
              for (final c in crops)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    onTap: () => context.push('/crop-records/${c.s('id')}', extra: {...c, 'farm': {'id': id, 'name': farm.s('name')}}),
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${c.m('crop').s('name')}${c.sn('variety') != null ? ' · ${c.s('variety')}' : ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text('Planted ${dateFmt(c.d('plantingDate'))} · harvest ${dateFmt(c.d('expectedHarvestDate'))}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                          if (c.nn('actualHarvest') != null) Text('Harvested ${numFmt(c.nn('actualHarvest'))} ${unitLabel(c.s('yieldUnit'))}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.leaf)),
                        ]),
                      ),
                      Pill(labelize(c.s('status')), color: c.s('status') == 'GROWING' ? AppColors.leafSoft : AppColors.surfaceAlt),
                    ]),
                  ),
                ),
          ];
        },
      ),
    );
  }

  Future<void> _addField(BuildContext context, WidgetRef ref) async {
    final name = TextEditingController();
    final area = TextEditingController();
    String irrigation = 'RAINFED';
    String? error;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Add a field', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: 14),
            AppTextField(label: 'Field name', controller: name, hint: 'e.g. North plot'),
            const SizedBox(height: 12),
            AppTextField(label: 'Area (hectares)', controller: area, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 12),
            AppDropdown<String>(
              label: 'Water',
              value: irrigation,
              items: const [DropdownMenuItem(value: 'RAINFED', child: Text('Rain-fed')), DropdownMenuItem(value: 'IRRIGATED', child: Text('Irrigated')), DropdownMenuItem(value: 'PARTIAL', child: Text('Partly irrigated'))],
              onChanged: (v) => set(() => irrigation = v ?? 'RAINFED'),
            ),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(error!, style: const TextStyle(color: AppColors.danger))),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Save field',
              onPressed: () async {
                try {
                  await ref.read(apiClientProvider).post('/fields', {'farmId': id, 'name': name.text.trim(), 'area': num.tryParse(area.text), 'areaUnit': 'HECTARES', 'irrigation': irrigation});
                  ref.invalidate(farmDetailProvider(id));
                  if (c.mounted) Navigator.pop(c);
                } on ApiException catch (e) {
                  set(() => error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
                }
              },
            ),
          ]),
        ),
      ),
    );
  }
}
