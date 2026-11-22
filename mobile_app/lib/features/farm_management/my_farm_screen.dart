import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/states.dart';
import 'farm_providers.dart';

class MyFarmScreen extends ConsumerWidget {
  const MyFarmScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final farms = ref.watch(farmsProvider);
    final crops = asJsonList(ref.watch(cropRecordsProvider).value?.data);
    final activities = asJsonList(ref.watch(activitiesProvider).value?.data);
    Future<void> refresh() async {
      ref.invalidate(cropRecordsProvider);
      ref.invalidate(activitiesProvider);
      ref.invalidate(farmsProvider);
      await ref.read(farmsProvider.future);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My Farm'), actions: [
        IconButton(tooltip: 'Tasks', onPressed: () => context.push('/tasks'), icon: const Icon(Icons.checklist)),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'farm-fab',
        backgroundColor: AppColors.coral,
        foregroundColor: AppColors.white,
        onPressed: () => _addSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('Add record', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: CachedListView(
        value: farms,
        onRefresh: refresh,
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) {
            return [
              EmptyView(
                icon: Icons.agriculture_outlined,
                title: 'Add your first farm',
                message: 'Register your farm to track crops, activities, harvests and get weather for your exact location.',
                actionLabel: 'Add farm',
                onAction: () => context.push('/farms/new'),
              ),
            ];
          }
          final ha = list.fold<double>(0, (s, f) => s + f.n('size').toDouble() * (f.s('sizeUnit') == 'ACRES' ? 0.404686 : 1));
          final active = crops.where((c) => c.s('status') == 'GROWING' || c.s('status') == 'PLANNED').toList();
          return [
            Row(children: [
              Expanded(child: StatTile(label: 'Farms', value: '${list.length}', icon: Icons.agriculture_outlined, tint: AppColors.leafSoft)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: 'Total hectares', value: numFmt(ha), icon: Icons.square_foot, tint: AppColors.amberSoft)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: 'Active crops', value: '${active.length}', icon: Icons.grass)),
            ]),
            SectionHeader('Farms', action: 'Add farm', onAction: () => context.push('/farms/new')),
            for (final f in list)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppCard(
                  onTap: () => context.push('/farms/${f.s('id')}'),
                  child: Row(children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(color: AppColors.leafSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.ink, width: 1.2)),
                      child: const Icon(Icons.landscape_outlined),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(f.s('name'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        Text('${numFmt(f.nn('size'))} ${labelize(f.s('sizeUnit')).toLowerCase()} · ${f.s('district')}', style: const TextStyle(color: AppColors.muted)),
                        if (f.sn('latitude') == null) const Text('No GPS yet', style: TextStyle(color: AppColors.amber, fontSize: 12, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                    const Icon(Icons.chevron_right),
                  ]),
                ),
              ),
            if (active.isNotEmpty) ...[
              SectionHeader('Crops in the ground', action: 'Add crop', onAction: () => context.push('/crop-records/new')),
              for (final c in active)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    onTap: () => context.push('/crop-records/${c.s('id')}', extra: c),
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${c.m('crop').s('name')}${c.sn('variety') != null ? ' · ${c.s('variety')}' : ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text('${c.m('farm').s('name')} · planted ${dateFmt(c.d('plantingDate'))}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                        ]),
                      ),
                      Pill(growthStages[c.s('growthStage')] ?? labelize(c.s('growthStage')), color: AppColors.leafSoft),
                    ]),
                  ),
                ),
            ],
            if (activities.isNotEmpty) ...[
              SectionHeader('Recent activities', action: 'Record', onAction: () => context.push('/activities/new')),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final a in activities.take(8))
                    ListTile(
                      dense: true,
                      leading: const Icon(Icons.history),
                      title: Text(activityTypes[a.s('type')] ?? labelize(a.s('type'))),
                      subtitle: Text('${dateFmt(a.d('date'))}${a.mn('farm') != null ? ' · ${a.m('farm').s('name')}' : ''}${a.nn('cost') != null ? ' · ${zmw(a.nn('cost'))}' : ''}'),
                    ),
                ]),
              ),
            ],
            const SizedBox(height: 70),
          ];
        },
      ),
    );
  }

  void _addSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            for (final (label, icon, route) in [
              ('Record a farm activity', Icons.edit_note, '/activities/new'),
              ('Add a crop / planting', Icons.grass, '/crop-records/new'),
              ('Add a task or reminder', Icons.event_available, '/tasks/new'),
              ('Check crop health (photo)', Icons.healing_outlined, '/crop-health/new'),
              ('Add a farm', Icons.add_location_alt_outlined, '/farms/new'),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SecondaryButton(
                  label: label,
                  icon: icon,
                  onPressed: () {
                    Navigator.pop(c);
                    context.push(route);
                  },
                ),
              ),
          ]),
        ),
      ),
    );
  }
}
