import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/states.dart';

final pricesProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/market-prices'));
final priceHistoryProvider = FutureProvider.family<Cached<dynamic>, String>((ref, key) {
  final p = key.split('|');
  return cachedGet(ref, '/market-prices/${p[0]}/history', query: p.length > 1 && p[1].isNotEmpty ? {'province': p[1]} : null);
});

class PricesScreen extends ConsumerStatefulWidget {
  const PricesScreen({super.key});
  @override
  ConsumerState<PricesScreen> createState() => _PricesScreenState();
}

class _PricesScreenState extends ConsumerState<PricesScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(pricesProvider);
    return PageScaffold(
      title: 'Market prices',
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(pricesProvider.future),
        builder: (raw) {
          final d = asJson(raw);
          final prices = d.l('prices').where((p) => _q.isEmpty || p.m('crop').s('name').toLowerCase().contains(_q) || p.s('province').toLowerCase().contains(_q) || p.s('marketName').toLowerCase().contains(_q)).toList();
          final offers = d.l('listingOffers');
          return [
            TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search commodity, province or market'),
              onChanged: (t) => setState(() => _q = t.trim().toLowerCase()),
            ),
            const SizedBox(height: 10),
            const Text('Prices recorded by AgriFlow administrators from named sources (markets, FRA, surveys). Each row shows its source and date — they are not live exchange prices.',
                style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
            const SizedBox(height: 10),
            if (prices.isEmpty) const EmptyView(icon: Icons.trending_up, title: 'No recorded prices', message: 'Administrators have not recorded prices matching this search yet.'),
            for (final p in prices)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => context.push('/prices/${p.s('cropId')}?province=${p.s('province')}&name=${Uri.encodeComponent(p.m('crop').s('name'))}'),
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(p.m('crop').s('name'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        Text('${labelize(p.s('province'))}${p.sn('marketName') != null ? ' · ${p.s('marketName')}' : ''}', style: const TextStyle(color: AppColors.muted)),
                        Text('${labelize(p.s('sourceType'))}${p.sn('sourceName') != null ? ': ${p.s('sourceName')}' : ''} · ${dateFmt(p.d('observedOn'))}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(zmw(p.nn('price')), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text('per ${unitLabel(p.s('unit'))}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                    ]),
                  ]),
                ),
              ),
            if (offers.isNotEmpty) ...[
              const SectionHeader('Asking prices on AgriFlow'),
              const Text('What farmers are currently asking in active listings — offers, not market prices.', style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
              const SizedBox(height: 8),
              for (final o in offers)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${o.m('crop').s('name')} · ${unitLabel(o.s('unit'))}'),
                  subtitle: Text('${o.n('_count').toInt()} listing(s) · average ${zmw(o.m('_avg').nn('pricePerUnit'))}'),
                  trailing: Text('${zmw(o.m('_min').nn('pricePerUnit'))} – ${zmw(o.m('_max').nn('pricePerUnit'))}', style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
            ],
          ];
        },
      ),
    );
  }
}

class PriceHistoryScreen extends ConsumerWidget {
  const PriceHistoryScreen({super.key, required this.cropId, this.province, this.name});
  final String cropId;
  final String? province;
  final String? name;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = '$cropId|${province ?? ''}';
    final v = ref.watch(priceHistoryProvider(key));
    return PageScaffold(
      title: '${name ?? 'Price'} history',
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(priceHistoryProvider(key).future),
        builder: (raw) {
          final rows = (raw is List ? asJsonList(raw) : asJson(raw).l('series'))..sort((a, b) => (a.d('observedOn') ?? DateTime(0)).compareTo(b.d('observedOn') ?? DateTime(0)));
          if (rows.length < 2) {
            return [
              const EmptyView(icon: Icons.show_chart, title: 'Not enough history', message: 'At least two recorded prices are needed to draw a trend.'),
              for (final r in rows) ListTile(title: Text(zmw(r.nn('price'))), subtitle: Text('${dateFmt(r.d('observedOn'))} · ${unitLabel(r.s('unit'))}')),
            ];
          }
          final spots = [for (var i = 0; i < rows.length; i++) FlSpot(i.toDouble(), rows[i].n('price').toDouble())];
          return [
            Text('${province != null ? labelize(province) : 'All provinces'} · ZMW per ${unitLabel(rows.last.s('unit'))}', style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 12),
            AppCard(
              padding: const EdgeInsets.fromLTRB(8, 20, 18, 8),
              child: SizedBox(
                height: 240,
                child: LineChart(LineChartData(
                  gridData: const FlGridData(show: true, drawVerticalLine: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 52)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        interval: (rows.length / 4).ceilToDouble().clamp(1, 1000).toDouble(),
                        getTitlesWidget: (v, meta) {
                          final i = v.toInt();
                          if (i < 0 || i >= rows.length) return const SizedBox.shrink();
                          final d = rows[i].d('observedOn');
                          return Padding(padding: const EdgeInsets.only(top: 6), child: Text(d == null ? '' : '${d.day}/${d.month}', style: const TextStyle(fontSize: 11)));
                        },
                      ),
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(spots: spots, isCurved: true, color: AppColors.coral, barWidth: 3, dotData: const FlDotData(show: true), belowBarData: BarAreaData(show: true, color: AppColors.coral.withValues(alpha: 0.12))),
                  ],
                )),
              ),
            ),
            const SectionHeader('Recorded prices'),
            for (final r in rows.reversed)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(zmw(r.nn('price')), style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('${dateFmt(r.d('observedOn'))} · ${labelize(r.s('province'))}${r.sn('marketName') != null ? ' · ${r.s('marketName')}' : ''}'),
                trailing: Text(labelize(r.s('sourceType')), style: const TextStyle(fontSize: 12)),
              ),
          ];
        },
      ),
    );
  }
}
