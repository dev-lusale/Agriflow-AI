import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';

final listingsProvider = FutureProvider.family<Cached<dynamic>, String>((ref, query) {
  final q = Uri.splitQueryString(query);
  return cachedGet(ref, '/marketplace/listings', query: q.isEmpty ? null : q);
});
final productsProvider = FutureProvider.family<Cached<dynamic>, String>((ref, query) {
  final q = Uri.splitQueryString(query);
  return cachedGet(ref, '/marketplace/products', query: q.isEmpty ? null : q);
});
final listingProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/marketplace/listings/$id'));
final productProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/marketplace/products/$id'));
final myListingsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/marketplace/my-listings'));
final categoriesProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/meta/product-categories'));
final ordersProvider = FutureProvider.family<Cached<dynamic>, String>((ref, as) => cachedGet(ref, '/orders', query: as.isEmpty ? null : {'as': as}));
final orderProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/orders/$id'));
