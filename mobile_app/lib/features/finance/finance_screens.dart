import 'dart:io';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

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

final financeSummaryProvider = FutureProvider.family<Cached<dynamic>, String>((ref, period) {
  final now = DateTime.now();
  final from = switch (period) {
    'month' => DateTime(now.year, now.month, 1),
    'year' => DateTime(now.year, 1, 1),
    _ => null,
  };
  return cachedGet(ref, '/finance/summary', query: from == null ? null : {'from': isoDate(from)});
});
final transactionsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/finance/transactions', query: {'take': 300}));

const incomeCategories = {'PRODUCE_SALE': 'Produce sale', 'OTHER_INCOME': 'Other income'};
const expenseCategories = {
  'SEEDS': 'Seeds',
  'FERTILIZER': 'Fertiliser',
  'CHEMICALS': 'Chemicals',
  'LABOUR': 'Labour',
  'TRANSPORT': 'Transport',
  'EQUIPMENT': 'Equipment',
  'IRRIGATION': 'Irrigation',
  'FUEL': 'Fuel',
  'STORAGE': 'Storage',
  'OTHER_EXPENSE': 'Other expense',
};
String categoryLabel(String c) => incomeCategories[c] ?? expenseCategories[c] ?? labelize(c);

class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});
  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen> {
  String _period = 'year';
  bool _exporting = false;

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final bytes = await ref.read(apiClientProvider).bytes('/finance/transactions.csv');
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/agriflow-farm-transactions-${isoDate(DateTime.now())}.csv');
      await f.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: 'text/csv')], subject: 'AgriFlow farm transactions'));
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(financeSummaryProvider(_period));
    final txns = asJsonList(ref.watch(transactionsProvider).value?.data);
    return PageScaffold(
      title: 'Farm finances',
      actions: [
        IconButton(
          tooltip: 'Export CSV report',
          onPressed: _exporting ? null : _export,
          icon: _exporting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.ios_share),
        ),
      ],
      fab: FloatingActionButton.extended(
        heroTag: 'fin',
        backgroundColor: AppColors.coral,
        foregroundColor: AppColors.white,
        onPressed: () => showTransactionForm(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Record', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: CachedListView(
        value: v,
        onRefresh: () async {
          ref.invalidate(transactionsProvider);
          ref.invalidate(financeSummaryProvider(_period));
          await ref.read(financeSummaryProvider(_period).future);
        },
        builder: (raw) {
          final s = asJson(raw);
          final net = s.n('netProfit');
          final cats = s.l('byCategory');
          final monthly = s.l('monthly');
          return [
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'month', label: Text('This month')), ButtonSegment(value: 'year', label: Text('This year')), ButtonSegment(value: 'all', label: Text('All time'))],
              selected: {_period},
              onSelectionChanged: (x) => setState(() => _period = x.first),
            ),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: StatTile(label: 'Income', value: zmw(s.nn('totalIncome')), icon: Icons.south_west, tint: AppColors.leafSoft)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: 'Expenses', value: zmw(s.nn('totalExpenses')), icon: Icons.north_east, tint: AppColors.dangerSoft)),
            ]),
            const SizedBox(height: 10),
            AppCard(
              color: net >= 0 ? AppColors.leafSoft : AppColors.dangerSoft,
              child: Row(children: [
                Expanded(child: Text(net >= 0 ? 'Profit' : 'Loss', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                Text(zmw(net.abs()), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
              ]),
            ),
            if (s.m('estimates').n('count') > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Budget: estimated cost ${zmw(s.m('estimates').nn('cost'))}, estimated revenue ${zmw(s.m('estimates').nn('revenue'))}.', style: const TextStyle(color: AppColors.muted)),
              ),
            if (monthly.length > 1) ...[
              const SectionHeader('Monthly'),
              AppCard(
                padding: const EdgeInsets.fromLTRB(8, 18, 12, 8),
                child: SizedBox(
                  height: 200,
                  child: BarChart(BarChartData(
                    gridData: const FlGridData(show: true, drawVerticalLine: false),
                    borderData: FlBorderData(show: false),
                    titlesData: FlTitlesData(
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 50)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (x, meta) {
                            final i = x.toInt();
                            if (i < 0 || i >= monthly.length) return const SizedBox.shrink();
                            return Padding(padding: const EdgeInsets.only(top: 6), child: Text(monthly[i].s('month').substring(5), style: const TextStyle(fontSize: 11)));
                          },
                        ),
                      ),
                    ),
                    barGroups: [
                      for (var i = 0; i < monthly.length; i++)
                        BarChartGroupData(x: i, barsSpace: 3, barRods: [
                          BarChartRodData(toY: monthly[i].n('income').toDouble(), color: AppColors.leaf, width: 7),
                          BarChartRodData(toY: monthly[i].n('expenses').toDouble(), color: AppColors.coral, width: 7),
                        ]),
                    ],
                  )),
                ),
              ),
              const Padding(padding: EdgeInsets.only(top: 6), child: Text('Green: income · Coral: expenses', style: TextStyle(fontSize: 12, color: AppColors.muted))),
            ],
            if (cats.isNotEmpty) ...[
              const SectionHeader('By category'),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final c in cats)
                    ListTile(
                      dense: true,
                      title: Text(categoryLabel(c.s('name'))),
                      trailing: Text(zmw(c.nn('amount')), style: TextStyle(fontWeight: FontWeight.w800, color: incomeCategories.containsKey(c.s('name')) ? AppColors.leaf : AppColors.ink)),
                    ),
                ]),
              ),
            ],
            if (s.l('profitByCrop').isNotEmpty) ...[
              const SectionHeader('Profit by crop'),
              for (final p in s.l('profitByCrop'))
                ListTile(contentPadding: EdgeInsets.zero, title: Text(p.s('name', p.s('crop'))), subtitle: Text('Revenue ${zmw(p.nn('revenue'))} · cost ${zmw(p.nn('cost'))}'), trailing: Text(zmw(p.nn('profit')), style: const TextStyle(fontWeight: FontWeight.w800))),
            ],
            SectionHeader('Transactions (${txns.length})'),
            if (txns.isEmpty) const Text('No transactions yet. Record sales and costs to see your profit.', style: TextStyle(color: AppColors.muted)),
            for (final t in txns.take(50))
              Dismissible(
                key: ValueKey(t.s('id')),
                direction: DismissDirection.endToStart,
                background: Container(color: AppColors.dangerSoft, alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 16), child: const Icon(Icons.delete_outline)),
                confirmDismiss: (_) => confirmDialog(context, title: 'Delete transaction?', message: 'This cannot be undone.', confirm: 'Delete', destructive: true),
                onDismissed: (_) async {
                  try {
                    await ref.read(apiClientProvider).delete('/finance/transactions/${t.s('id')}');
                  } on ApiException catch (e) {
                    if (context.mounted) showSnack(context, e.message, error: true);
                  }
                  ref.invalidate(transactionsProvider);
                  ref.invalidate(financeSummaryProvider(_period));
                },
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(t.s('type') == 'INCOME' ? Icons.south_west : Icons.north_east, color: t.s('type') == 'INCOME' ? AppColors.leaf : AppColors.danger),
                  title: Text(t.s('description', categoryLabel(t.s('category'))), maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text('${categoryLabel(t.s('category'))} · ${dateFmt(t.d('date'))}'),
                  trailing: Text('${t.s('type') == 'INCOME' ? '+' : '−'}${zmw(t.nn('amount'))}', style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            const SizedBox(height: 80),
          ];
        },
      ),
    );
  }
}

Future<void> showTransactionForm(BuildContext context, WidgetRef ref) async {
  String type = 'EXPENSE';
  String category = 'FERTILIZER';
  final amount = TextEditingController();
  final desc = TextEditingController();
  DateTime date = DateTime.now();
  String? error;
  bool busy = false;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (c) => StatefulBuilder(builder: (c, set) {
      final cats = type == 'INCOME' ? incomeCategories : expenseCategories;
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Record a transaction', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'EXPENSE', label: Text('Expense')), ButtonSegment(value: 'INCOME', label: Text('Income'))],
              selected: {type},
              onSelectionChanged: (s) => set(() {
                type = s.first;
                category = type == 'INCOME' ? 'PRODUCE_SALE' : 'FERTILIZER';
              }),
            ),
            const SizedBox(height: 12),
            FormErrorBox(error),
            AppDropdown<String>(label: 'Category', value: category, items: [for (final e in cats.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => set(() => category = v ?? category)),
            const SizedBox(height: 12),
            AppTextField(label: 'Amount (ZMW)', controller: amount, prefixText: 'K ', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 12),
            AppDateField(label: 'Date', value: date, lastDate: DateTime.now(), onChanged: (d) => set(() => date = d ?? date)),
            const SizedBox(height: 12),
            AppTextField(label: 'Description (optional)', controller: desc, hint: 'e.g. 10 bags of D-compound'),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Save',
              loading: busy,
              onPressed: () async {
                set(() {
                  busy = true;
                  error = null;
                });
                try {
                  await ref.read(apiClientProvider).post('/finance/transactions', {
                    'type': type,
                    'category': category,
                    'amount': num.tryParse(amount.text),
                    'date': isoDate(date),
                    if (desc.text.trim().isNotEmpty) 'description': desc.text.trim(),
                  });
                  ref.invalidate(transactionsProvider);
                  ref.invalidate(financeSummaryProvider);
                  if (c.mounted) Navigator.pop(c);
                } on ApiException catch (e) {
                  set(() => error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
                } finally {
                  set(() => busy = false);
                }
              },
            ),
          ]),
        ),
      );
    }),
  );
}
