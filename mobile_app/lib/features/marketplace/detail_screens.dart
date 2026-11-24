import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../authentication/presentation/auth_common.dart';
import 'market_providers.dart';
import 'market_widgets.dart';

const _noPayments = 'AgriFlow does not process payments. Buyer and seller agree on payment directly (e.g. mobile money or cash on delivery) once the order is accepted.';

class ListingDetailScreen extends ConsumerWidget {
  const ListingDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(listingProvider(id));
    final me = ref.watch(authControllerProvider).user!;
    return PageScaffold(
      title: 'Produce',
      actions: [IconButton(tooltip: 'Report listing', icon: const Icon(Icons.flag_outlined), onPressed: () => reportDialog(context, ref, 'LISTING', id))],
      body: CachedListView(
        padding: const EdgeInsets.fromLTRB(0, 0, 0, 32),
        value: v,
        onRefresh: () => ref.refresh(listingProvider(id).future),
        builder: (raw) {
          final l = asJson(raw);
          if (l.sn('id') == null) return [const EmptyView(icon: Icons.search_off, title: 'Listing not available', message: 'It may have been sold or removed.')];
          final images = l.l('images');
          final farmer = l.m('farmer');
          final mine = farmer.s('id') == me.id;
          return [
            SizedBox(
              height: 260,
              child: images.isEmpty
                  ? UploadImage(uploadId: null, label: l.s('title'), height: 260)
                  : PageView(children: [for (final im in images) UploadImage(uploadId: im.s('uploadId'), height: 260)]),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l.s('title'), style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 4),
                Text('${zmw(l.nn('pricePerUnit'))} per ${unitLabel(l.s('unit'))}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.coralDark)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  Pill('${numFmt(l.nn('quantityAvailable'))} ${unitLabel(l.s('unit'))} available'),
                  if (l.nn('minOrderQuantity') != null) Pill('Min. order ${numFmt(l.nn('minOrderQuantity'))}'),
                  Pill(labelize(l.s('qualityGrade'))),
                  Pill('${l.s('district')}, ${labelize(l.s('province'))}', icon: Icons.place_outlined),
                ]),
                if (l.sn('description') != null) ...[const SizedBox(height: 14), Text(l.s('description'))],
                if (l.sn('harvestDate') != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Harvested ${dateFmt(l.d('harvestDate'))}', style: const TextStyle(color: AppColors.muted))),
                if (l.sn('pickupLocation') != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Pickup: ${l.s('pickupLocation')}', style: const TextStyle(color: AppColors.muted))),
                const SectionHeader('Seller'),
                AppCard(
                  shadow: false,
                  child: Row(children: [
                    CircleAvatar(backgroundColor: AppColors.coralSoft, child: Text(initials(farmer.m('profile').s('fullName', '?')), style: const TextStyle(color: AppColors.ink, fontWeight: FontWeight.w800))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Flexible(child: Text(farmer.m('profile').s('fullName', 'Farmer'), style: const TextStyle(fontWeight: FontWeight.w800))),
                          if (farmer.sn('verifiedAt') != null) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 16, color: AppColors.leaf)),
                        ]),
                        Text('${farmer.m('_count').n('ordersAsSeller').toInt()} completed sales · member since ${farmer.d('createdAt')?.year ?? '—'}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 20),
                if (mine)
                  const Text('This is your listing. Manage it from My listings.', style: TextStyle(fontWeight: FontWeight.w700))
                else
                  PrimaryButton(label: 'Request to buy', icon: Icons.shopping_basket_outlined, onPressed: () => _buySheet(context, ref, l)),
                const SizedBox(height: 10),
                const Text(_noPayments, style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
              ]),
            ),
          ];
        },
      ),
    );
  }

  Future<void> _buySheet(BuildContext context, WidgetRef ref, Json l) async {
    final qty = TextEditingController(text: l.sn('minOrderQuantity') ?? '');
    final offer = TextEditingController();
    final address = TextEditingController();
    final msg = TextEditingController();
    String? error;
    bool busy = false;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Request ${l.s('title')}', style: Theme.of(c).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text('Asking ${zmw(l.nn('pricePerUnit'))} per ${unitLabel(l.s('unit'))}', style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 14),
              FormErrorBox(error),
              AppTextField(label: 'Quantity (${unitLabel(l.s('unit'))})', controller: qty, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
              const SizedBox(height: 12),
              AppTextField(label: 'Your offer per unit, ZMW (optional)', controller: offer, keyboardType: const TextInputType.numberWithOptions(decimal: true), helper: 'Leave empty to accept the asking price, or propose a price to negotiate.'),
              const SizedBox(height: 12),
              AppTextField(label: 'Delivery address (optional)', controller: address),
              const SizedBox(height: 12),
              AppTextField(label: 'Message to seller (optional)', controller: msg, maxLines: 2),
              const SizedBox(height: 18),
              PrimaryButton(
                label: 'Send request',
                loading: busy,
                onPressed: () async {
                  set(() {
                    busy = true;
                    error = null;
                  });
                  try {
                    final r = asJson(await ref.read(apiClientProvider).post('/orders/purchase-request', {
                      'listingId': l.s('id'),
                      'quantity': num.tryParse(qty.text),
                      if (num.tryParse(offer.text) != null) 'offerPrice': num.tryParse(offer.text),
                      if (address.text.trim().isNotEmpty) 'deliveryAddress': address.text.trim(),
                      if (msg.text.trim().isNotEmpty) 'message': msg.text.trim(),
                    }));
                    ref.invalidate(ordersProvider(''));
                    if (c.mounted) Navigator.pop(c);
                    if (context.mounted) {
                      showSnack(context, 'Request sent. The seller will accept, counter or decline.');
                      context.push('/orders/${r.s('id')}');
                    }
                  } on ApiException catch (e) {
                    set(() => error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
                  } finally {
                    set(() => busy = false);
                  }
                },
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class ProductDetailScreen extends ConsumerWidget {
  const ProductDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(productProvider(id));
    final me = ref.watch(authControllerProvider).user!;
    return PageScaffold(
      title: 'Farm input',
      actions: [IconButton(tooltip: 'Report product', icon: const Icon(Icons.flag_outlined), onPressed: () => reportDialog(context, ref, 'PRODUCT', id))],
      body: CachedListView(
        padding: const EdgeInsets.fromLTRB(0, 0, 0, 32),
        value: v,
        onRefresh: () => ref.refresh(productProvider(id).future),
        builder: (raw) {
          final p = asJson(raw);
          if (p.sn('id') == null) return [const EmptyView(icon: Icons.search_off, title: 'Product not available')];
          final sp = p.m('supplier');
          final stock = p.m('inventoryItem').nn('quantity') ?? p.nn('stock');
          final canOrder = me.isFarmer || me.role.name == 'buyer';
          return [
            UploadImage(uploadId: p.sn('imageId'), height: 240, label: p.s('name')),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.s('name'), style: Theme.of(context).textTheme.headlineMedium),
                if (p.sn('brand') != null) Text(p.s('brand'), style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: 6),
                Text('${zmw(p.nn('price'))} per ${unitLabel(p.s('unit'))}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.coralDark)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  Pill(p.m('category').s('name')),
                  Pill(stock == null ? 'Stock unknown' : stock <= 0 ? 'Out of stock' : '${numFmt(stock)} in stock', color: stock != null && stock <= 0 ? AppColors.dangerSoft : AppColors.leafSoft),
                  if (p.sn('registrationNumber') != null) Pill('Reg. ${p.s('registrationNumber')}'),
                ]),
                if (p.sn('description') != null) ...[const SizedBox(height: 14), Text(p.s('description'))],
                if (p.sn('safetyInfo') != null) ...[const SizedBox(height: 12), AppCard(color: AppColors.amberSoft, shadow: false, child: Text('Safety: ${p.s('safetyInfo')}'))],
                const SectionHeader('Supplier'),
                AppCard(
                  shadow: false,
                  child: Row(children: [
                    const Icon(Icons.storefront_outlined),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Flexible(child: Text(sp.m('supplierProfile').s('businessName', 'Supplier'), style: const TextStyle(fontWeight: FontWeight.w800))),
                          if (sp.sn('verifiedAt') != null) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 16, color: AppColors.leaf)),
                        ]),
                        Text('${sp.m('profile').s('district')}, ${labelize(sp.m('profile').s('province'))}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 20),
                if (canOrder && (stock == null || stock > 0)) PrimaryButton(label: 'Order', icon: Icons.add_shopping_cart, onPressed: () => _orderSheet(context, ref, p)),
                if (!canOrder) const Text('Input orders are placed by farmer and buyer accounts.', style: TextStyle(color: AppColors.muted)),
                const SizedBox(height: 10),
                const Text(_noPayments, style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
              ]),
            ),
          ];
        },
      ),
    );
  }

  Future<void> _orderSheet(BuildContext context, WidgetRef ref, Json p) async {
    final qty = TextEditingController(text: '1');
    final address = TextEditingController();
    final notes = TextEditingController();
    String? error;
    bool busy = false;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(builder: (c, set) {
        final q = num.tryParse(qty.text) ?? 0;
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Order ${p.s('name')}', style: Theme.of(c).textTheme.titleLarge),
            const SizedBox(height: 14),
            FormErrorBox(error),
            AppTextField(label: 'Quantity (${unitLabel(p.s('unit'))})', controller: qty, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => set(() {})),
            const SizedBox(height: 12),
            AppTextField(label: 'Delivery address (optional)', controller: address),
            const SizedBox(height: 12),
            AppTextField(label: 'Notes (optional)', controller: notes),
            const SizedBox(height: 14),
            Text('Estimated total: ${zmw(q * p.n('price'))}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 14),
            PrimaryButton(
              label: 'Place order',
              loading: busy,
              onPressed: () async {
                set(() {
                  busy = true;
                  error = null;
                });
                try {
                  final r = asJson(await ref.read(apiClientProvider).post('/orders/input-order', {
                    'productId': p.s('id'),
                    'quantity': num.tryParse(qty.text),
                    if (address.text.trim().isNotEmpty) 'deliveryAddress': address.text.trim(),
                    if (notes.text.trim().isNotEmpty) 'notes': notes.text.trim(),
                  }));
                  ref.invalidate(ordersProvider(''));
                  if (c.mounted) Navigator.pop(c);
                  if (context.mounted) {
                    showSnack(context, 'Order sent to the supplier.');
                    context.push('/orders/${r.s('id')}');
                  }
                } on ApiException catch (e) {
                  set(() => error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '));
                } finally {
                  set(() => busy = false);
                }
              },
            ),
          ]),
        );
      }),
    );
  }
}

Future<void> reportDialog(BuildContext context, WidgetRef ref, String type, String id) async {
  final reason = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      backgroundColor: AppColors.background,
      title: const Text('Report'),
      content: TextField(controller: reason, maxLines: 3, decoration: const InputDecoration(hintText: 'What is wrong? (e.g. fake product, wrong price, offensive)')),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Send report'))],
    ),
  );
  if (ok != true) return;
  try {
    await ref.read(apiClientProvider).post('/marketplace/report', {'entityType': type, 'entityId': id, 'reason': reason.text.trim()});
    if (context.mounted) showSnack(context, 'Thank you. An administrator will review it.');
  } on ApiException catch (e) {
    if (context.mounted) showSnack(context, e.message, error: true);
  }
}
