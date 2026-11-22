import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/states.dart';
import '../authentication/presentation/auth_common.dart';

final inventoryProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/inventory'));
final movementsProvider = FutureProvider.family<Cached<dynamic>, String>((ref, itemId) => cachedGet(ref, '/inventory/movements', query: {'itemId': itemId}));

const inventoryCategories = {
  'SEEDS': 'Seeds',
  'FERTILIZER': 'Fertiliser',
  'PESTICIDE': 'Pesticides',
  'TOOLS': 'Tools',
  'EQUIPMENT': 'Equipment',
  'HARVESTED_PRODUCE': 'Harvested produce',
  'FEED': 'Animal feed',
  'IRRIGATION': 'Irrigation',
  'OTHER': 'Other',
};

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});
  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  String? _cat;

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(inventoryProvider);
    return PageScaffold(
      title: 'Inventory',
      fab: FloatingActionButton.extended(
        heroTag: 'inv',
        backgroundColor: AppColors.coral,
        foregroundColor: AppColors.white,
        onPressed: () => showItemForm(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Add item', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(inventoryProvider.future),
        builder: (raw) {
          final all = asJsonList(raw);
          final list = all.where((i) => _cat == null || i.s('category') == _cat).toList();
          final low = all.where((i) => i.n('minStockLevel') > 0 && i.n('quantity') <= i.n('minStockLevel')).length;
          final soon = all.where((i) => i.d('expiryDate') != null && i.d('expiryDate')!.isBefore(DateTime.now().add(const Duration(days: 30)))).length;
          final value = all.fold<num>(0, (s, i) => s + i.n('quantity') * i.n('unitCost'));
          return [
            Row(children: [
              Expanded(child: StatTile(label: 'Items', value: '${all.length}', icon: Icons.inventory_2_outlined)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: 'Low stock', value: '$low', icon: Icons.warning_amber, tint: AppColors.amberSoft)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: 'Expiring ≤30d', value: '$soon', icon: Icons.event_busy, tint: AppColors.dangerSoft)),
            ]),
            const SizedBox(height: 8),
            Text('Stock value (at purchase price): ${zmw(value)}', style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 8),
            SizedBox(
              height: 44,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: const Text('All'), selected: _cat == null, onSelected: (_) => setState(() => _cat = null))),
                for (final c in inventoryCategories.entries)
                  Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(c.value), selected: _cat == c.key, onSelected: (_) => setState(() => _cat = c.key))),
              ]),
            ),
            const SizedBox(height: 8),
            if (list.isEmpty) const EmptyView(icon: Icons.inventory_2_outlined, title: 'Nothing here yet', message: 'Add seed, fertiliser, chemicals and equipment to track stock.'),
            for (final i in list)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => _itemSheet(context, i),
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(i.s('name'), style: const TextStyle(fontWeight: FontWeight.w800)),
                        Text('${inventoryCategories[i.s('category')] ?? labelize(i.s('category'))}${i.sn('storageLocation') != null ? ' · ${i.s('storageLocation')}' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                        if (i.d('expiryDate') != null) Text('Expires ${dateFmt(i.d('expiryDate'))}', style: TextStyle(fontSize: 12.5, color: i.d('expiryDate')!.isBefore(DateTime.now().add(const Duration(days: 30))) ? AppColors.danger : AppColors.muted)),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('${numFmt(i.nn('quantity'))} ${i.s('unit')}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      if (i.n('minStockLevel') > 0 && i.n('quantity') <= i.n('minStockLevel')) const Pill('Low stock', color: AppColors.amberSoft),
                    ]),
                  ]),
                ),
              ),
            const SizedBox(height: 70),
          ];
        },
      ),
    );
  }

  void _itemSheet(BuildContext context, Json item) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => _ItemSheet(item: item),
    );
  }
}

class _ItemSheet extends ConsumerStatefulWidget {
  const _ItemSheet({required this.item});
  final Json item;
  @override
  ConsumerState<_ItemSheet> createState() => _ItemSheetState();
}

class _ItemSheetState extends ConsumerState<_ItemSheet> {
  String _dir = 'OUT';
  final _qty = TextEditingController();
  final _reason = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final i = widget.item;
    final moves = ref.watch(movementsProvider(i.s('id')));
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(i.s('name'), style: Theme.of(context).textTheme.titleLarge),
          Text('In stock: ${numFmt(i.nn('quantity'))} ${i.s('unit')}', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 14),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'IN', label: Text('Stock in')), ButtonSegment(value: 'OUT', label: Text('Use / out')), ButtonSegment(value: 'ADJUST', label: Text('Count'))],
            selected: {_dir},
            onSelectionChanged: (s) => setState(() => _dir = s.first),
          ),
          const SizedBox(height: 12),
          FormErrorBox(_error),
          AppTextField(label: _dir == 'ADJUST' ? 'Counted quantity difference' : 'Quantity (${i.s('unit')})', controller: _qty, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          const SizedBox(height: 12),
          AppTextField(label: 'Reason (optional)', controller: _reason, hint: _dir == 'IN' ? 'Purchase, harvest…' : 'Used on field, sold, damaged…'),
          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Record movement',
            loading: _busy,
            onPressed: () async {
              setState(() {
                _busy = true;
                _error = null;
              });
              try {
                await ref.read(apiClientProvider).post('/inventory/movements', {'itemId': i.s('id'), 'direction': _dir, 'quantity': num.tryParse(_qty.text), if (_reason.text.trim().isNotEmpty) 'reason': _reason.text.trim()});
                ref.invalidate(inventoryProvider);
                ref.invalidate(movementsProvider(i.s('id')));
                if (context.mounted) Navigator.pop(context);
              } on ApiException catch (e) {
                setState(() => _error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
          const SectionHeader('History'),
          moves.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(ApiException.from(e).message),
            data: (c) => Column(children: [
              for (final m in asJsonList(c.data).take(15))
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(m.s('type') == 'IN' || m.s('direction') == 'IN' ? Icons.add_circle_outline : Icons.remove_circle_outline),
                  title: Text('${labelize(m.s('type', m.s('direction')))} ${numFmt(m.nn('quantity'))}'),
                  subtitle: Text('${dateTimeFmt(m.d('createdAt'))}${m.sn('reason') != null ? ' · ${m.s('reason')}' : ''}'),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

Future<void> showItemForm(BuildContext context, WidgetRef ref) async {
  final name = TextEditingController();
  final unit = TextEditingController(text: 'kg');
  final qty = TextEditingController(text: '0');
  final cost = TextEditingController();
  final min = TextEditingController(text: '0');
  final loc = TextEditingController();
  String cat = 'FERTILIZER';
  DateTime? expiry;
  String? error;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (c) => StatefulBuilder(
      builder: (c, set) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Add inventory item', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: 12),
            FormErrorBox(error),
            AppTextField(label: 'Item name', controller: name, hint: 'e.g. Urea 46%N'),
            const SizedBox(height: 12),
            AppDropdown<String>(label: 'Category', value: cat, items: [for (final e in inventoryCategories.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => set(() => cat = v ?? cat)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: AppTextField(label: 'Opening quantity', controller: qty, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
              const SizedBox(width: 12),
              Expanded(child: AppTextField(label: 'Unit', controller: unit)),
            ]),
            const SizedBox(height: 12),
            AppTextField(label: 'Purchase price per unit, ZMW (optional)', controller: cost, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 12),
            AppTextField(label: 'Warn me below (minimum stock)', controller: min, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 12),
            AppTextField(label: 'Storage location (optional)', controller: loc),
            const SizedBox(height: 12),
            AppDateField(label: 'Expiry date (optional)', value: expiry, optional: true, onChanged: (d) => set(() => expiry = d)),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Save item',
              onPressed: () async {
                try {
                  await ref.read(apiClientProvider).post('/inventory', {
                    'name': name.text.trim(),
                    'category': cat,
                    'unit': unit.text.trim(),
                    'quantity': num.tryParse(qty.text) ?? 0,
                    if (num.tryParse(cost.text) != null) 'unitCost': num.tryParse(cost.text),
                    'minStockLevel': num.tryParse(min.text) ?? 0,
                    if (loc.text.trim().isNotEmpty) 'storageLocation': loc.text.trim(),
                    if (expiry != null) 'expiryDate': isoDate(expiry!),
                  });
                  ref.invalidate(inventoryProvider);
                  if (c.mounted) Navigator.pop(c);
                } on ApiException catch (e) {
                  set(() => error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
                }
              },
            ),
          ]),
        ),
      ),
    ),
  );
}
