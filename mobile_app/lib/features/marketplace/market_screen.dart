import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../farm_management/farm_providers.dart';
import 'market_providers.dart';
import 'market_widgets.dart';

class MarketScreen extends ConsumerStatefulWidget {
  const MarketScreen({super.key});
  @override
  ConsumerState<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends ConsumerState<MarketScreen> {
  String _q = '';
  String? _crop;
  String? _category;
  String _sort = 'newest';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user!;
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Marketplace'),
          actions: [
            IconButton(tooltip: 'My orders', onPressed: () => context.push('/orders'), icon: const Icon(Icons.receipt_long_outlined)),
            if (user.isFarmer) IconButton(tooltip: 'My listings', onPressed: () => context.push('/market/my-listings'), icon: const Icon(Icons.sell_outlined)),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(112),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
                child: TextField(
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search produce, inputs, districts…', contentPadding: EdgeInsets.symmetric(vertical: 12)),
                  onChanged: (t) {
                    _debounce?.cancel();
                    _debounce = Timer(const Duration(milliseconds: 450), () => setState(() => _q = t.trim()));
                  },
                ),
              ),
              const TabBar(tabs: [Tab(text: 'Harvested produce'), Tab(text: 'Farm inputs')]),
            ]),
          ),
        ),
        floatingActionButton: user.isFarmer || user.isSeller
            ? FloatingActionButton.extended(
                heroTag: 'sell',
                backgroundColor: AppColors.coral,
                foregroundColor: AppColors.white,
                onPressed: () => context.push(user.isFarmer ? '/market/sell' : '/seller/products/new'),
                icon: const Icon(Icons.add),
                label: Text(user.isFarmer ? 'Sell produce' : 'Add product', style: const TextStyle(fontWeight: FontWeight.w800)),
              )
            : null,
        body: TabBarView(children: [_produce(), _inputs()]),
      ),
    );
  }

  Widget _produce() {
    final crops = asJsonList(ref.watch(cropCatalogProvider).value?.data);
    final query = Uri(queryParameters: {if (_q.isNotEmpty) 'q': _q, 'crop': ?_crop, 'sort': _sort}).query;
    final v = ref.watch(listingsProvider(query));
    return Column(children: [
      SizedBox(
        height: 52,
        child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(16, 8, 16, 4), children: [
          Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: const Text('All'), selected: _crop == null, onSelected: (_) => setState(() => _crop = null))),
          for (final c in crops)
            Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(c.s('name')), selected: _crop == c.s('name'), onSelected: (_) => setState(() => _crop = c.s('name')))),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          const Text('Sort', style: TextStyle(color: AppColors.muted)),
          const SizedBox(width: 8),
          DropdownButton<String>(
            value: _sort,
            underline: const SizedBox.shrink(),
            items: const [
              DropdownMenuItem(value: 'newest', child: Text('Newest')),
              DropdownMenuItem(value: 'price_asc', child: Text('Lowest price')),
              DropdownMenuItem(value: 'price_desc', child: Text('Highest price')),
              DropdownMenuItem(value: 'qty_desc', child: Text('Most available')),
            ],
            onChanged: (s) => setState(() => _sort = s ?? 'newest'),
          ),
        ]),
      ),
      Expanded(
        child: v.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(listingsProvider(query))),
          data: (c) {
            final items = asJson(c.data).l('items');
            final grid = RefreshIndicator(
              onRefresh: () => ref.refresh(listingsProvider(query).future),
              child: items.isEmpty
                  ? ListView(children: const [EmptyView(icon: Icons.storefront_outlined, title: 'No produce found', message: 'Try another crop or search term.')])
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 240, mainAxisSpacing: 14, crossAxisSpacing: 12, childAspectRatio: 0.72),
                      itemCount: items.length,
                      itemBuilder: (_, i) {
                        final l = items[i];
                        final img = l.l('images').isNotEmpty ? l.l('images').first.s('uploadId') : null;
                        return MarketCard(
                          title: l.s('title'),
                          price: '${zmw(l.nn('pricePerUnit'))} / ${unitLabel(l.s('unit'))}',
                          subtitle: '${l.s('district')} · ${numFmt(l.nn('quantityAvailable'))} available',
                          imageId: img,
                          badge: l.s('qualityGrade') == 'UNGRADED' ? null : labelize(l.s('qualityGrade')),
                          verified: l.m('farmer').sn('verifiedAt') != null,
                          onTap: () => context.push('/market/listing/${l.s('id')}'),
                        );
                      },
                    ),
            );
            if (!c.fromCache) return grid;
            return Column(children: [Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: CachedBanner(savedAt: c.savedAt)), Expanded(child: grid)]);
          },
        ),
      ),
    ]);
  }

  Widget _inputs() {
    final cats = asJsonList(ref.watch(categoriesProvider).value?.data);
    final query = Uri(queryParameters: {if (_q.isNotEmpty) 'q': _q, 'category': ?_category}).query;
    final v = ref.watch(productsProvider(query));
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Category rail, as in the reference design
      Container(
        width: 96,
        decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppColors.divider))),
        child: ListView(children: [
          _rail('All', Icons.apps, _category == null, () => setState(() => _category = null)),
          for (final c in cats) _rail(c.s('name'), _iconFor(c.s('slug')), _category == c.s('slug'), () => setState(() => _category = c.s('slug'))),
        ]),
      ),
      Expanded(
        child: v.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(productsProvider(query))),
          data: (c) {
            final items = asJsonList(c.data);
            return RefreshIndicator(
              onRefresh: () => ref.refresh(productsProvider(query).future),
              child: items.isEmpty
                  ? ListView(children: const [EmptyView(icon: Icons.inventory_2_outlined, title: 'No products found', message: 'No supplier is selling this category yet.')])
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 200, mainAxisSpacing: 12, crossAxisSpacing: 10, childAspectRatio: 0.66),
                      itemCount: items.length,
                      itemBuilder: (_, i) {
                        final p = items[i];
                        final sp = p.m('supplier');
                        return MarketCard(
                          title: p.s('name'),
                          price: '${zmw(p.nn('price'))} / ${unitLabel(p.s('unit'))}',
                          subtitle: sp.m('supplierProfile').s('businessName', 'Supplier'),
                          imageId: p.sn('imageId'),
                          verified: sp.sn('verifiedAt') != null,
                          badge: p.m('inventoryItem').nn('quantity') != null && p.m('inventoryItem').n('quantity') <= 0 ? 'Out of stock' : null,
                          onTap: () => context.push('/market/product/${p.s('id')}'),
                        );
                      },
                    ),
            );
          },
        ),
      ),
    ]);
  }

  IconData _iconFor(String slug) {
    if (slug.contains('seed')) return Icons.spa_outlined;
    if (slug.contains('fert')) return Icons.science_outlined;
    if (slug.contains('protect') || slug.contains('pest') || slug.contains('chem')) return Icons.bug_report_outlined;
    if (slug.contains('equip') || slug.contains('machin') || slug.contains('tool')) return Icons.handyman_outlined;
    if (slug.contains('irrig')) return Icons.water_drop_outlined;
    if (slug.contains('feed') || slug.contains('livestock') || slug.contains('vet')) return Icons.pets_outlined;
    return Icons.category_outlined;
  }

  Widget _rail(String label, IconData icon, bool selected, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
          decoration: BoxDecoration(
            color: selected ? AppColors.white : null,
            border: Border(left: BorderSide(color: selected ? AppColors.coral : Colors.transparent, width: 4)),
          ),
          child: Column(children: [
            Icon(icon, color: selected ? AppColors.coral : AppColors.muted),
            const SizedBox(height: 4),
            Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 11.5, fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: selected ? AppColors.ink : AppColors.muted)),
          ]),
        ),
      );
}
