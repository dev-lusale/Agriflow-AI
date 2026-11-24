/// Small helpers for reading API JSON safely (Prisma decimals arrive as strings).
typedef Json = Map<String, dynamic>;

extension JsonRead on Map<String, dynamic> {
  String s(String k, [String fallback = '']) {
    final v = this[k];
    return v == null ? fallback : v.toString();
  }

  String? sn(String k) {
    final v = this[k];
    if (v == null) return null;
    final t = v.toString();
    return t.isEmpty ? null : t;
  }

  num n(String k, [num fallback = 0]) {
    final v = this[k];
    if (v is num) return v;
    if (v is String) return num.tryParse(v) ?? fallback;
    return fallback;
  }

  num? nn(String k) {
    final v = this[k];
    if (v is num) return v;
    if (v is String) return num.tryParse(v);
    return null;
  }

  bool b(String k) => this[k] == true;

  DateTime? d(String k) {
    final v = this[k];
    return v is String ? DateTime.tryParse(v)?.toLocal() : null;
  }

  Json m(String k) {
    final v = this[k];
    return v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
  }

  Json? mn(String k) {
    final v = this[k];
    return v is Map ? Map<String, dynamic>.from(v) : null;
  }

  List<Json> l(String k) {
    final v = this[k];
    if (v is! List) return const [];
    return v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  List<String> ls(String k) {
    final v = this[k];
    if (v is! List) return const [];
    return v.map((e) => e.toString()).toList();
  }
}

List<Json> asJsonList(dynamic v) => v is List ? v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
Json asJson(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
