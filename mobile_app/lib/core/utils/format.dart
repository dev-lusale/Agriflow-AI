import 'package:intl/intl.dart';

final _money = NumberFormat('#,##0.00', 'en_US');
final _compact = NumberFormat('#,##0.##', 'en_US');

/// All amounts are Zambian Kwacha.
String zmw(num? v) => v == null ? '—' : 'K ${_money.format(v)}';
String numFmt(num? v) => v == null ? '—' : _compact.format(v);
String dateFmt(DateTime? d) => d == null ? '—' : DateFormat('d MMM yyyy').format(d);
String dateTimeFmt(DateTime? d) => d == null ? '—' : DateFormat('d MMM yyyy, HH:mm').format(d);
String dayFmt(DateTime? d) => d == null ? '—' : DateFormat('EEE d MMM').format(d);
String isoDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String relative(DateTime? d) {
  if (d == null) return '—';
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  if (diff.inHours < 24) return '${diff.inHours} h ago';
  if (diff.inDays < 7) return '${diff.inDays} d ago';
  return dateFmt(d);
}

/// "BAG_50KG" → "50 kg bag", "GRAIN_FILL" → "Grain fill".
String labelize(String? v) {
  if (v == null || v.isEmpty) return '—';
  const special = {
    'BAG_50KG': '50 kg bag',
    'BAG_25KG': '25 kg bag',
    'BAG_10KG': '10 kg bag',
    'KG': 'kg',
    'TONNE': 'tonne',
    'LITRE': 'litre',
    'NORTH_WESTERN': 'North-Western',
    'SUPER_ADMIN': 'Super admin',
  };
  if (special.containsKey(v)) return special[v]!;
  final words = v.toLowerCase().split('_');
  final s = words.join(' ');
  return s[0].toUpperCase() + s.substring(1);
}

String unitLabel(String? u) => labelize(u);
String initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
}
