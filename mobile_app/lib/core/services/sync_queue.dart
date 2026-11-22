import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:hive_ce_flutter/hive_ce_flutter.dart';

import '../networking/api_client.dart';
import '../networking/api_exception.dart';

/// Records created without a connection (farm activities, tasks, notes).
/// Each operation has a unique id, so re-sending is safe: the server applies it once.
class QueuedOp {
  QueuedOp({required this.opId, required this.kind, required this.payload, required this.createdAt, this.status = 'pending', this.error, this.label = ''});
  final String opId;
  final String kind;
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  String status; // pending | failed | conflict
  String? error;
  final String label;

  Map<String, dynamic> toJson() => {'opId': opId, 'kind': kind, 'payload': payload, 'createdAt': createdAt.toIso8601String(), 'status': status, 'error': error, 'label': label};
  static QueuedOp fromJson(Map<String, dynamic> j) => QueuedOp(
        opId: j['opId'] as String,
        kind: j['kind'] as String,
        payload: Map<String, dynamic>.from(j['payload'] as Map),
        createdAt: DateTime.parse(j['createdAt'] as String),
        status: (j['status'] ?? 'pending') as String,
        error: j['error'] as String?,
        label: (j['label'] ?? '') as String,
      );
}

class SyncQueue extends ChangeNotifier {
  late Box<String> _box;
  String _scope = 'anon';
  bool _flushing = false;
  DateTime? lastSyncAt;

  Future<void> init() async => _box = await Hive.openBox<String>('af_outbox_v1');
  void setScope(String? userId) {
    _scope = userId ?? 'anon';
    notifyListeners();
  }

  List<QueuedOp> get ops => _box.keys
      .where((k) => '$k'.startsWith('$_scope|'))
      .map((k) => QueuedOp.fromJson(jsonDecode(_box.get(k)!) as Map<String, dynamic>))
      .toList()
    ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

  int get pendingCount => ops.where((o) => o.status == 'pending').length;
  int get problemCount => ops.where((o) => o.status != 'pending').length;

  static String newOpId() {
    final r = Random.secure();
    return 'm-${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-${List.generate(8, (_) => r.nextInt(36).toRadixString(36)).join()}';
  }

  Future<QueuedOp> enqueue(String kind, Map<String, dynamic> payload, {required String label}) async {
    final op = QueuedOp(opId: newOpId(), kind: kind, payload: payload, createdAt: DateTime.now(), label: label);
    await _box.put('$_scope|${op.opId}', jsonEncode(op.toJson()));
    notifyListeners();
    return op;
  }

  Future<void> remove(String opId) async {
    await _box.delete('$_scope|$opId');
    notifyListeners();
  }

  Future<void> retry(String opId) async {
    final raw = _box.get('$_scope|$opId');
    if (raw == null) return;
    final op = QueuedOp.fromJson(jsonDecode(raw) as Map<String, dynamic>)..status = 'pending'..error = null;
    await _box.put('$_scope|$opId', jsonEncode(op.toJson()));
    notifyListeners();
  }

  /// Sends pending operations. Returns how many were synchronised.
  Future<int> flush(ApiClient api) async {
    if (_flushing) return 0;
    final pending = ops.where((o) => o.status == 'pending').take(50).toList();
    if (pending.isEmpty) return 0;
    _flushing = true;
    var synced = 0;
    try {
      final res = await api.post('/sync', {'ops': pending.map((o) => {'opId': o.opId, 'kind': o.kind, 'payload': o.payload}).toList()});
      final results = (res as Map)['results'] as List;
      for (final r in results.whereType<Map>()) {
        final id = '${r['opId']}';
        final key = '$_scope|$id';
        final raw = _box.get(key);
        if (raw == null) continue;
        final op = QueuedOp.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        switch (r['status']) {
          case 'synced':
            await _box.delete(key);
            synced++;
          case 'conflict':
            op.status = 'conflict';
            op.error = 'Changed on another device. Review it on the website.';
            await _box.put(key, jsonEncode(op.toJson()));
          default:
            if (r['retryable'] != true) {
              op.status = 'failed';
              op.error = '${r['error'] ?? 'Could not be saved.'}';
              await _box.put(key, jsonEncode(op.toJson()));
            }
        }
      }
      lastSyncAt = DateTime.now();
    } on ApiException {
      // Still offline or server busy: keep everything pending for the next attempt.
    } finally {
      _flushing = false;
      notifyListeners();
    }
    return synced;
  }
}
