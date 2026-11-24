import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/utils/json.dart';

final farmsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/farms'));
final farmDetailProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/farms/$id'));
final cropRecordsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/crop-records'));
final activitiesProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/activities', query: {'take': 100}));
final tasksProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/tasks'));
final cropCatalogProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/crops'));

List<Json> farmsOf(WidgetRef ref) => asJsonList(ref.watch(farmsProvider).value?.data);

/// Saves a record online, or queues it for later when there is no connection.
/// Returns true when it was saved on the server immediately.
Future<bool> saveOrQueue(WidgetRef ref, {required String path, required String kind, required Json body, required String label}) async {
  final online = ref.read(onlineProvider).value ?? true;
  if (online) {
    try {
      await ref.read(apiClientProvider).post(path, body);
      return true;
    } on ApiException catch (e) {
      if (!e.isNetwork) rethrow;
    }
  }
  await ref.read(syncQueueProvider).enqueue(kind, body, label: label);
  return false;
}

const activityTypes = {
  'LAND_PREPARATION': 'Land preparation',
  'PLANTING': 'Planting',
  'FERTILIZER_APPLICATION': 'Fertiliser application',
  'IRRIGATION': 'Irrigation',
  'WEED_MANAGEMENT': 'Weeding',
  'PEST_MANAGEMENT': 'Pesticide / pest control',
  'DISEASE_TREATMENT': 'Disease treatment',
  'HARVESTING': 'Harvest',
  'STORAGE': 'Storage',
  'INSPECTION': 'Field inspection',
  'OTHER': 'Other',
};

const growthStages = {
  'PLANNED': 'Planned',
  'GERMINATION': 'Germination',
  'VEGETATIVE': 'Vegetative',
  'FLOWERING': 'Flowering',
  'GRAIN_FILL': 'Grain fill',
  'MATURITY': 'Maturity',
  'HARVESTED': 'Harvested',
};

const quantityUnits = ['KG', 'TONNE', 'BAG_50KG', 'BAG_25KG', 'BAG_10KG', 'CRATE', 'LITRE', 'BALE', 'UNIT', 'BOX'];
