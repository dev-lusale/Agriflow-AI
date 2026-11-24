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
import '../../core/widgets/cards.dart';
import '../../core/widgets/states.dart';
import '../farm_management/farm_providers.dart';
import 'weather_widgets.dart';

/// Query key: `farm:<id>`, `gps:<lat>,<lng>` or `home`.
final weatherProvider = FutureProvider.family<Cached<dynamic>, String>((ref, key) {
  if (key.startsWith('farm:')) return cachedGet(ref, '/weather', query: {'farmId': key.substring(5)});
  if (key.startsWith('gps:')) {
    final p = key.substring(4).split(',');
    return cachedGet(ref, '/weather', query: {'lat': p[0], 'lng': p[1]});
  }
  return cachedGet(ref, '/dashboard').then((c) => Cached<dynamic>(asJson(c.data)['weather'], c.savedAt, fromCache: c.fromCache));
});

class WeatherScreen extends ConsumerStatefulWidget {
  const WeatherScreen({super.key, this.farmId});
  final String? farmId;
  @override
  ConsumerState<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends ConsumerState<WeatherScreen> {
  late String _key = widget.farmId != null ? 'farm:${widget.farmId}' : 'home';
  bool _locating = false;

  Future<void> _gps() async {
    setState(() => _locating = true);
    final r = await ref.read(locationServiceProvider).current();
    if (!mounted) return;
    setState(() => _locating = false);
    if (!r.ok) return showSnack(context, r.error!, error: true);
    setState(() => _key = 'gps:${r.lat!.toStringAsFixed(2)},${r.lng!.toStringAsFixed(2)}');
  }

  @override
  Widget build(BuildContext context) {
    final farms = asJsonList(ref.watch(farmsProvider).value?.data);
    final v = ref.watch(weatherProvider(_key));
    return PageScaffold(
      title: 'Weather',
      actions: [
        IconButton(
          tooltip: 'Use my current location',
          onPressed: _locating ? null : _gps,
          icon: _locating ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location),
        ),
      ],
      body: Column(children: [
        if (farms.isNotEmpty)
          SizedBox(
            height: 54,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), children: [
              Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: const Text('My area'), selected: _key == 'home', onSelected: (_) => setState(() => _key = 'home'))),
              for (final f in farms)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(label: Text(f.s('name')), selected: _key == 'farm:${f.s('id')}', onSelected: (_) => setState(() => _key = 'farm:${f.s('id')}')),
                ),
              if (_key.startsWith('gps:')) const ChoiceChip(label: Text('Current location'), selected: true),
            ]),
          ),
        Expanded(
          child: CachedListView(
            value: v,
            onRefresh: () => ref.refresh(weatherProvider(_key).future),
            builder: (raw) {
              final w = asJson(raw);
              if (!w.b('ok')) {
                final last = w.mn('lastKnown');
                return [
                  EmptyView(icon: Icons.cloud_off_outlined, title: 'Weather unavailable', message: w.s('message', ApiException('').message)),
                  if (last != null) const Text('Showing the last known forecast is not supported offline for this location.', style: TextStyle(color: AppColors.muted)),
                ];
              }
              final daily = w.m('data').l('daily');
              final advice = weatherAdvice(w);
              final flags = w.m('flags');
              return [
                WeatherSummaryCard(weather: w),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: StatTile(label: 'Rain next 3 days', value: '${numFmt(flags.nn('rainNext3DaysMm'))} mm', icon: Icons.umbrella_outlined, tint: AppColors.skySoft)),
                  const SizedBox(width: 10),
                  Expanded(child: StatTile(label: 'Rain next 7 days', value: '${numFmt(flags.nn('rainNext7DaysMm'))} mm', icon: Icons.water_outlined, tint: AppColors.skySoft)),
                ]),
                const SectionHeader('Farming advice'),
                AppCard(
                  color: advice.isEmpty ? AppColors.leafSoft : AppColors.amberSoft,
                  shadow: false,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (advice.isEmpty) const Text('No weather risks flagged for the coming week. A good time for routine field work.', style: TextStyle(fontWeight: FontWeight.w600)),
                    for (final a in advice) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('• $a', style: const TextStyle(fontWeight: FontWeight.w600))),
                    if ((flags.nn('rainNext7DaysMm') ?? 0) >= 20) const Text('• Planting: enough rain is forecast for planting if your soil is already moist (about 25 mm of cumulative rain is a common rule of thumb in Zambia).'),
                  ]),
                ),
                const SectionHeader('7-day forecast'),
                AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(children: [
                    for (final d in daily)
                      ListTile(
                        leading: Icon(weatherIcon(d.nn('weatherCode')?.toInt())),
                        title: Text(dayFmt(DateTime.tryParse(d.s('date'))), style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${d.s('conditions')} · rain ${numFmt(d.nn('precipitationMm'))} mm (${d.nn('precipitationProbPct')?.round() ?? '—'}%) · wind ${d.nn('windMaxKmh')?.round() ?? '—'} km/h'),
                        trailing: Text('${d.nn('tempMaxC')?.round() ?? '—'}° / ${d.nn('tempMinC')?.round() ?? '—'}°', style: const TextStyle(fontWeight: FontWeight.w800)),
                      ),
                  ]),
                ),
                const SizedBox(height: 10),
                Text('Source: ${w.m('data').s('source')} (forecast model). Location: ${w.m('location').s('label')}.', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              ];
            },
          ),
        ),
      ]),
    );
  }
}
