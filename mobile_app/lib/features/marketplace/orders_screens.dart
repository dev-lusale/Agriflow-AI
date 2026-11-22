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
import 'market_providers.dart';

const actionLabels = {
  'ACCEPTED': 'Accept',
  'REJECTED': 'Decline',
  'CONFIRMED': 'Confirm order',
  'PROCESSING': 'Start preparing',
  'READY_FOR_PICKUP': 'Ready for pickup',
  'IN_TRANSIT': 'Mark in transit',
  'DELIVERED': 'Mark delivered',
  'COMPLETED': 'Complete (received)',
  'CANCELLED': 'Cancel order',
  'DISPUTED': 'Report a problem',
};

Color statusColor(String s) => switch (s) {
      'COMPLETED' || 'DELIVERED' => AppColors.leafSoft,
      'CANCELLED' || 'REJECTED' || 'DISPUTED' => AppColors.dangerSoft,
      'PENDING' || 'NEGOTIATING' => AppColors.amberSoft,
      _ => AppColors.skySoft,
    };

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(authControllerProvider).user!;
    final sells = u.isFarmer || u.isSeller;
    final buys = !u.isSeller || u.role.name == 'distributor';
    final tabs = [if (buys) ('Buying', 'buyer'), if (sells) ('Selling', 'seller')];
    if (u.isAdmin) return _OrdersList(as: '', title: embedded ? 'Orders' : null);
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Orders'),
          automaticallyImplyLeading: !embedded,
          bottom: tabs.length > 1 ? TabBar(tabs: [for (final t in tabs) Tab(text: t.$1)]) : null,
        ),
        body: tabs.length > 1 ? TabBarView(children: [for (final t in tabs) _OrdersList(as: t.$2)]) : _OrdersList(as: tabs.first.$2),
      ),
    );
  }
}

class _OrdersList extends ConsumerWidget {
  const _OrdersList({required this.as, this.title});
  final String as;
  final String? title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(ordersProvider(as));
    final body = CachedListView(
      value: v,
      onRefresh: () => ref.refresh(ordersProvider(as).future),
      builder: (raw) {
        final list = asJsonList(raw);
        if (list.isEmpty) {
          return [
            EmptyView(
              icon: Icons.receipt_long_outlined,
              title: 'No orders yet',
              message: as == 'seller' ? 'Requests from buyers will appear here.' : 'Find produce and farm inputs in the marketplace.',
              actionLabel: 'Open marketplace',
              onAction: () => context.go('/market'),
            ),
          ];
        }
        return [
          for (final o in list)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                onTap: () => context.push('/orders/${o.s('id')}'),
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(o.s('orderNumber'), style: const TextStyle(fontWeight: FontWeight.w800))),
                    Pill(labelize(o.s('status')), color: statusColor(o.s('status'))),
                  ]),
                  const SizedBox(height: 4),
                  Text(o.l('items').map((i) => i.s('description')).join(', '), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Row(children: [
                    Expanded(
                      child: Text(
                        as == 'seller' ? 'Buyer: ${o.m('buyer').m('buyerProfile').s('businessName', o.m('buyer').m('profile').s('fullName'))}' : 'Seller: ${o.m('seller').m('supplierProfile').s('businessName', o.m('seller').m('profile').s('fullName'))}',
                        style: const TextStyle(color: AppColors.muted, fontSize: 13),
                      ),
                    ),
                    Text(zmw(o.nn('total')), style: const TextStyle(fontWeight: FontWeight.w800)),
                  ]),
                ]),
              ),
            ),
        ];
      },
    );
    if (title == null) return body;
    return Scaffold(appBar: AppBar(title: Text(title!)), body: body);
  }
}

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  String? _busyAction;

  Future<void> _transition(String to) async {
    String? note;
    if (to == 'CANCELLED' || to == 'REJECTED' || to == 'DISPUTED') {
      final c = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (d) => AlertDialog(
          backgroundColor: AppColors.background,
          title: Text(actionLabels[to] ?? labelize(to)),
          content: TextField(controller: c, maxLines: 3, decoration: const InputDecoration(hintText: 'Reason (shared with the other party)')),
          actions: [TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Back')), TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Confirm'))],
        ),
      );
      if (ok != true) return;
      note = c.text.trim();
    }
    setState(() => _busyAction = to);
    try {
      await ref.read(apiClientProvider).post('/orders/${widget.id}/transition', {'to': to, if (note != null && note.isNotEmpty) 'note': note});
      ref.invalidate(orderProvider(widget.id));
      ref.invalidate(ordersProvider('buyer'));
      ref.invalidate(ordersProvider('seller'));
      if (mounted) showSnack(context, 'Order updated.');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<void> _counter(Json o) async {
    final price = TextEditingController();
    final qty = TextEditingController(text: o.l('items').isNotEmpty ? o.l('items').first.s('quantity') : '');
    final msg = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Make a counter-offer', style: Theme.of(c).textTheme.titleLarge),
          const SizedBox(height: 14),
          AppTextField(label: 'Price per unit (ZMW)', controller: price, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          const SizedBox(height: 12),
          AppTextField(label: 'Quantity', controller: qty, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          const SizedBox(height: 12),
          AppTextField(label: 'Message (optional)', controller: msg),
          const SizedBox(height: 18),
          PrimaryButton(label: 'Send offer', onPressed: () => Navigator.pop(c, true)),
        ]),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiClientProvider).post('/orders/${widget.id}/counter-offer', {'pricePerUnit': num.tryParse(price.text), 'quantity': num.tryParse(qty.text), if (msg.text.trim().isNotEmpty) 'message': msg.text.trim()});
      ref.invalidate(orderProvider(widget.id));
      if (mounted) showSnack(context, 'Offer sent.');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.fieldErrors.isEmpty ? e.message : e.fieldErrors.values.expand((x) => x).join(' '), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(orderProvider(widget.id));
    final me = ref.watch(authControllerProvider).user!;
    return PageScaffold(
      title: 'Order',
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(orderProvider(widget.id).future),
        builder: (raw) {
          final o = asJson(raw);
          final actions = o.ls('availableActions');
          final isBuyer = o.m('buyer').s('id') == me.id;
          final other = isBuyer ? o.m('seller') : o.m('buyer');
          final otherName = isBuyer ? other.m('supplierProfile').s('businessName', other.m('profile').s('fullName')) : other.m('buyerProfile').s('businessName', other.m('profile').s('fullName'));
          final openOffer = o.l('offers').where((x) => x.s('status') == 'OPEN').toList();
          final convo = o.l('conversations');
          return [
            Row(children: [
              Expanded(child: Text(o.s('orderNumber'), style: Theme.of(context).textTheme.headlineMedium)),
              Pill(labelize(o.s('status')), color: statusColor(o.s('status'))),
            ]),
            Text('${labelize(o.s('type'))} order · ${dateTimeFmt(o.d('createdAt'))}', style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 14),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final i in o.l('items'))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(children: [
                      Expanded(child: Text('${i.s('description')}\n${numFmt(i.nn('quantity'))} × ${zmw(i.nn('unitPrice'))} / ${unitLabel(i.s('unit'))}')),
                      Text(zmw(i.nn('lineTotal')), style: const TextStyle(fontWeight: FontWeight.w700)),
                    ]),
                  ),
                const Divider(),
                if (o.n('deliveryFee') > 0) Row(children: [const Expanded(child: Text('Delivery')), Text(zmw(o.nn('deliveryFee')))]),
                Row(children: [const Expanded(child: Text('Total', style: TextStyle(fontWeight: FontWeight.w800))), Text(zmw(o.nn('total')), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17))]),
                const SizedBox(height: 6),
                const Text('Payment is arranged directly between buyer and seller. AgriFlow does not take payments.', style: TextStyle(fontSize: 12, color: AppColors.muted)),
              ]),
            ),
            const SectionHeader('Other party'),
            AppCard(
              shadow: false,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${isBuyer ? 'Seller' : 'Buyer'}: $otherName', style: const TextStyle(fontWeight: FontWeight.w800)),
                if (other.m('profile').sn('district') != null) Text('${other.m('profile').s('district')}, ${labelize(other.m('profile').s('province'))}', style: const TextStyle(color: AppColors.muted)),
                if (['ACCEPTED', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].contains(o.s('status')) && other.sn('phone') != null)
                  Text('Phone: ${other.s('phone')}', style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 10),
                if (convo.isNotEmpty) SecondaryButton(label: 'Messages', icon: Icons.chat_outlined, onPressed: () => context.push('/conversations/${convo.first.s('id')}')),
              ]),
            ),
            if (openOffer.isNotEmpty) ...[
              const SectionHeader('Current offer'),
              AppCard(
                color: AppColors.amberSoft,
                shadow: false,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${openOffer.last.m('offeredBy').m('profile').s('fullName')} offers ${numFmt(openOffer.last.nn('quantity'))} at ${zmw(openOffer.last.nn('pricePerUnit'))} each', style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (openOffer.last.sn('message') != null) Text(openOffer.last.s('message')),
                  if (openOffer.last.m('offeredBy').s('id') != me.id) ...[
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: PrimaryButton(
                          label: 'Accept offer',
                          onPressed: () async {
                            try {
                              await ref.read(apiClientProvider).post('/orders/${widget.id}/accept-offer');
                              ref.invalidate(orderProvider(widget.id));
                            } on ApiException catch (e) {
                              if (context.mounted) showSnack(context, e.message, error: true);
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: SecondaryButton(label: 'Counter', onPressed: () => _counter(o))),
                    ]),
                  ],
                ]),
              ),
            ],
            if (actions.isNotEmpty || (o.s('type') == 'PRODUCE' && ['PENDING', 'NEGOTIATING'].contains(o.s('status')) && openOffer.isEmpty)) ...[
              const SectionHeader('Next steps'),
              for (final a in actions)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: ['CANCELLED', 'REJECTED', 'DISPUTED'].contains(a)
                      ? SecondaryButton(label: actionLabels[a] ?? labelize(a), loading: _busyAction == a, onPressed: _busyAction == null ? () => _transition(a) : null)
                      : PrimaryButton(label: actionLabels[a] ?? labelize(a), loading: _busyAction == a, onPressed: _busyAction == null ? () => _transition(a) : null),
                ),
              if (o.s('type') == 'PRODUCE' && ['PENDING', 'NEGOTIATING'].contains(o.s('status')) && openOffer.isEmpty)
                SecondaryButton(label: 'Make a counter-offer', icon: Icons.swap_horiz, onPressed: () => _counter(o)),
            ],
            if (['ACCEPTED', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP'].contains(o.s('status')) && me.role.name != 'transporter') ...[
              const SizedBox(height: 10),
              SecondaryButton(label: 'Request transport', icon: Icons.local_shipping_outlined, onPressed: () => context.push('/deliveries/new?orderId=${widget.id}')),
            ],
            if (o.l('deliveries').isNotEmpty) ...[
              const SectionHeader('Deliveries'),
              for (final d in o.l('deliveries'))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.local_shipping_outlined),
                  title: Text(labelize(d.s('status'))),
                  subtitle: Text(d.m('transporter').m('transporterProfile').s('businessName', 'Awaiting a transporter')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/deliveries/${d.s('id')}'),
                ),
            ],
            const SectionHeader('History'),
            for (final e in o.l('events'))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(padding: EdgeInsets.only(top: 4), child: Icon(Icons.circle, size: 10, color: AppColors.coral)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(labelize(e.s('toStatus', e.s('type'))), style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text('${e.m('actor').m('profile').s('fullName', 'System')} · ${dateTimeFmt(e.d('createdAt'))}', style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
                      if (e.sn('note') != null) Text(e.s('note')),
                    ]),
                  ),
                ]),
              ),
          ];
        },
      ),
    );
  }
}
