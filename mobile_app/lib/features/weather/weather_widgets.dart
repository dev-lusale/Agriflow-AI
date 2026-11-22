import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/cards.dart';

/// WMO weather code → icon.
IconData weatherIcon(int? code) {
  if (code == null) return Icons.cloud_outlined;
  if (code == 0) return Icons.wb_sunny_outlined;
  if (code <= 2) return Icons.wb_cloudy_outlined;
  if (code == 3) return Icons.cloud_outlined;
  if (code == 45 || code == 48) return Icons.foggy;
  if (code >= 51 && code <= 67) return Icons.grain;
  if (code >= 80 && code <= 82) return Icons.umbrella_outlined;
  if (code >= 95) return Icons.thunderstorm_outlined;
  return Icons.cloud_outlined;
}

/// Farming advice computed by the server from the forecast (rule-based, not AI).
List<String> weatherAdvice(Json weather) => weather.m('flags').ls('flags');
num? rainNext7(Json weather) => weather.m('flags').nn('rainNext7DaysMm');

class WeatherSummaryCard extends StatelessWidget {
  const WeatherSummaryCard({super.key, required this.weather, this.onTap});
  final Json weather;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (!weather.b('ok')) {
      return AppCard(
        onTap: onTap,
        child: Row(children: [
          const Icon(Icons.cloud_off_outlined, color: AppColors.muted),
          const SizedBox(width: 12),
          Expanded(child: Text(weather.s('message', 'Weather is not available right now.'), style: const TextStyle(color: AppColors.muted))),
        ]),
      );
    }
    final data = weather.m('data');
    final cur = data.m('current');
    final today = data.l('daily').isNotEmpty ? data.l('daily').first : <String, dynamic>{};
    final loc = weather.m('location');
    return AppCard(
      onTap: onTap,
      color: AppColors.skySoft,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(loc.s('label'), style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
          const Icon(Icons.chevron_right, color: AppColors.ink),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Icon(weatherIcon(cur.nn('weatherCode')?.toInt()), size: 46, color: AppColors.ink),
          const SizedBox(width: 12),
          Text('${cur.nn('temperatureC')?.round() ?? '—'}°C', style: const TextStyle(fontFamily: kFont, fontSize: 36, fontWeight: FontWeight.w800)),
          const SizedBox(width: 12),
          Expanded(child: Text(cur.s('conditions', ''), style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w700))),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 14, runSpacing: 6, children: [
          _metric(Icons.water_drop_outlined, '${cur.nn('humidityPct')?.round() ?? '—'}%', 'Humidity'),
          _metric(Icons.umbrella_outlined, '${today.nn('precipitationMm') ?? '—'} mm', 'Rain today'),
          _metric(Icons.air, '${cur.nn('windSpeedKmh')?.round() ?? '—'} km/h', 'Wind'),
        ]),
        const SizedBox(height: 8),
        Text('${data.s('source')} · ${data.s('currentKind') == 'modelled' ? 'modelled conditions' : 'station'} · updated ${relative(weather.d('fetchedAt'))}',
            style: const TextStyle(fontSize: 11.5, color: AppColors.muted)),
      ]),
    );
  }

  Widget _metric(IconData i, String v, String l) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(i, size: 16, color: AppColors.ink),
        const SizedBox(width: 4),
        Text(v, style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(width: 3),
        Text(l, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      ]);
}
