import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../authentication/presentation/auth_common.dart';
import '../marketplace/market_widgets.dart';

final deliveriesProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/deliveries'));
final openDeliveriesProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/deliveries/open'));
final deliveryProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/deliveries/$id'));
final vehiclesProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/vehicles'));

const deliveryStatusLabel = {
  'REQUESTED': 'Pending',
  'ACCEPTED': 'Accepted',
  'PICKUP_SCHEDULED': 'Processing (pickup scheduled)',
  'PICKED_UP': 'Dispatched (picked up)',
  'IN_TRANSIT': 'In transit',
  'DELIVERED': 'Delivered',
  'CANCELLED': 'Cancelled',
};

/// Carrier's next steps (the server enforces the same rules).
const carrierNext = {
  'ACCEPTED': ['PICKUP_SCHEDULED', 'PICKED_UP', 'CANCELLED'],
  'PICKUP_SCHEDULED': ['PICKED_UP', 'CANCELLED'],
  'PICKED_UP': ['IN_TRANSIT', 'DELIVERED'],
  'IN_TRANSIT': ['DELIVERED'],
};

Color deliveryColor(String s) => s == 'DELIVERED' ? AppColors.leafSoft : s == 'CANCELLED' ? AppColors.dangerSoft : s == 'REQUESTED' ? AppColors.amberSoft : AppColors.skySoft;

Widget deliveryCard(BuildContext context, Json d) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: () => context.push('/deliveries/${d.s('id')}'),
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(d.s('deliveryNumber'), style: const TextStyle(fontWeight: FontWeight.w800))),
            Pill(deliveryStatusLabel[d.s('status')] ?? labelize(d.s('status')), color: deliveryColor(d.s('status'))),
          ]),
          const SizedBox(height: 4),
          Text(d.s('cargoDescription'), maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('${d.s('pickupDistrict')} → ${d.s('dropoffDistrict')}${d.nn('weightKg') != null ? ' · ${numFmt(d.nn('weightKg'))} kg' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          if (d.nn('fee') != null) Text('Fee ${zmw(d.nn('fee'))}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        ]),
      ),
    );

class DeliveriesScreen extends ConsumerWidget {
  const DeliveriesScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(authControllerProvider).user!;
    final mine = CachedListView(
      value: ref.watch(deliveriesProvider),
      onRefresh: () => ref.refresh(deliveriesProvider.future),
      builder: (raw) {
        final list = asJsonList(raw);
        if (list.isEmpty) return [const EmptyView(icon: Icons.local_shipping_outlined, title: 'No deliveries yet', message: 'Deliveries you request or carry appear here.')];
        return [for (final d in list) deliveryCard(context, d)];
      },
    );
    if (!u.isCarrier) {
      return Scaffold(
        appBar: AppBar(title: const Text('Deliveries'), automaticallyImplyLeading: !embedded),
        floatingActionButton: FloatingActionButton.extended(
          heroTag: 'del',
          backgroundColor: AppColors.coral,
          foregroundColor: AppColors.white,
          onPressed: () => context.push('/deliveries/new'),
          icon: const Icon(Icons.add),
          label: const Text('Request transport', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
        body: mine,
      );
    }
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Deliveries'),
          automaticallyImplyLeading: !embedded,
          actions: [IconButton(tooltip: 'Vehicles', onPressed: () => context.push('/vehicles'), icon: const Icon(Icons.fire_truck_outlined))],
          bottom: const TabBar(tabs: [Tab(text: 'Open requests'), Tab(text: 'My deliveries')]),
        ),
        body: TabBarView(children: [const OpenRequestsList(), mine]),
      ),
    );
  }
}

class OpenRequestsList extends ConsumerWidget {
  const OpenRequestsList({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => CachedListView(
        value: ref.watch(openDeliveriesProvider),
        onRefresh: () => ref.refresh(openDeliveriesProvider.future),
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) return [const EmptyView(icon: Icons.inbox_outlined, title: 'No open requests', message: 'New transport requests in your provinces will appear here.')];
          return [for (final d in list) deliveryCard(context, d)];
        },
      );
}

class OpenRequestsScreen extends StatelessWidget {
  const OpenRequestsScreen({super.key});
  @override
  Widget build(BuildContext context) => const PageScaffold(title: 'Delivery requests', body: OpenRequestsList());
}

class DeliveryDetailScreen extends ConsumerStatefulWidget {
  const DeliveryDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<DeliveryDetailScreen> createState() => _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends ConsumerState<DeliveryDetailScreen> {
  bool _busy = false;

  Future<void> _update(Json d, String status) async {
    final fee = TextEditingController(text: d.sn('fee') ?? '');
    final note = TextEditingController();
    final recipient = TextEditingController();
    String? vehicleId;
    XFile? proof;
    final vehicles = asJsonList(ref.read(vehiclesProvider).value?.data).where((v) => v.b('isActive')).toList();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(deliveryStatusLabel[status] ?? labelize(status), style: Theme.of(c).textTheme.titleLarge),
              const SizedBox(height: 14),
              if (status == 'ACCEPTED') ...[
                AppTextField(label: 'Your fee (ZMW)', controller: fee, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
                const SizedBox(height: 12),
                if (vehicles.isNotEmpty)
                  AppDropdown<String?>(
                    label: 'Vehicle',
                    value: vehicleId,
                    items: [const DropdownMenuItem<String?>(value: null, child: Text('Choose later')), for (final v in vehicles) DropdownMenuItem<String?>(value: v.s('id'), child: Text('${labelize(v.s('type'))} ${v.s('registration')}'))],
                    onChanged: (v) => set(() => vehicleId = v),
                  ),
                const SizedBox(height: 12),
              ],
              if (status == 'DELIVERED') ...[
                AppTextField(label: 'Received by', controller: recipient),
                const SizedBox(height: 12),
                SecondaryButton(
                  label: proof == null ? 'Add proof-of-delivery photo' : 'Photo added ✓',
                  icon: Icons.photo_camera_outlined,
                  onPressed: () async {
                    final p = await pickPhoto(c);
                    if (p != null) set(() => proof = p);
                  },
                ),
                const SizedBox(height: 12),
              ],
              AppTextField(label: 'Note (optional)', controller: note),
              const SizedBox(height: 18),
              PrimaryButton(label: 'Confirm', onPressed: () => Navigator.pop(c, true)),
            ]),
          ),
        ),
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final fields = <String, dynamic>{
        'status': status,
        if (num.tryParse(fee.text) != null && status == 'ACCEPTED') 'fee': num.tryParse(fee.text),
        'vehicleId': ?vehicleId,
        if (note.text.trim().isNotEmpty) 'note': note.text.trim(),
        if (recipient.text.trim().isNotEmpty) 'proofRecipient': recipient.text.trim(),
      };
      final api = ref.read(apiClientProvider);
      if (proof != null) {
        final form = FormData();
        fields.forEach((k, v) => form.fields.add(MapEntry(k, '$v')));
        form.files.add(MapEntry('proof', await photoPart(proof!)));
        await api.multipart('/deliveries/${widget.id}/update', form);
      } else {
        await api.post('/deliveries/${widget.id}/update', fields);
      }
      ref.invalidate(deliveryProvider(widget.id));
      ref.invalidate(deliveriesProvider);
      ref.invalidate(openDeliveriesProvider);
      if (mounted) showSnack(context, 'Delivery updated.');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authControllerProvider).user!;
    if (me.isCarrier) ref.watch(vehiclesProvider);
    final v = ref.watch(deliveryProvider(widget.id));
    return PageScaffold(
      title: 'Delivery',
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(deliveryProvider(widget.id).future),
        builder: (raw) {
          final d = asJson(raw);
          final status = d.s('status');
          final isCarrier = d.sn('transporterId') == me.id || (me.isCarrier && d.sn('transporterId') == null);
          final isRequester = d.s('requestedById') == me.id;
          final t = d.m('transporter');
          return [
            Row(children: [
              Expanded(child: Text(d.s('deliveryNumber'), style: Theme.of(context).textTheme.headlineMedium)),
              Pill(deliveryStatusLabel[status] ?? labelize(status), color: deliveryColor(status)),
            ]),
            const SizedBox(height: 12),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(d.s('cargoDescription'), style: const TextStyle(fontWeight: FontWeight.w800)),
                if (d.nn('weightKg') != null) Text('${numFmt(d.nn('weightKg'))} kg'),
                const SizedBox(height: 10),
                _stop(Icons.trip_origin, 'Pickup', '${d.s('pickupLocation')}\n${d.s('pickupDistrict')}, ${labelize(d.s('pickupProvince'))}'),
                _stop(Icons.place, 'Destination', '${d.s('dropoffLocation')}\n${d.s('dropoffDistrict')}, ${labelize(d.s('dropoffProvince'))}'),
                if (d.sn('expectedDate') != null) Text('Expected: ${dateFmt(d.d('expectedDate'))}', style: const TextStyle(color: AppColors.muted)),
                if (d.nn('fee') != null) Text('Fee: ${zmw(d.nn('fee'))}', style: const TextStyle(fontWeight: FontWeight.w800)),
                if (d.sn('notes') != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(d.s('notes'))),
              ]),
            ),
            const SectionHeader('Driver / transporter'),
            AppCard(
              shadow: false,
              child: d.sn('transporterId') == null
                  ? const Text('Waiting for a transporter to accept.', style: TextStyle(color: AppColors.muted))
                  : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t.m('transporterProfile').s('businessName', t.m('profile').s('fullName')), style: const TextStyle(fontWeight: FontWeight.w800)),
                      if (t.m('transporterProfile').sn('contactPhone') != null || t.sn('phone') != null) Text('Phone: ${t.m('transporterProfile').sn('contactPhone') ?? t.s('phone')}'),
                      if (d.mn('vehicle') != null) Text('${labelize(d.m('vehicle').s('type'))} ${d.m('vehicle').s('registration')}', style: const TextStyle(color: AppColors.muted)),
                    ]),
            ),
            const SizedBox(height: 6),
            const Text('Live GPS tracking is not available; status updates come from the transporter.', style: TextStyle(fontSize: 12, color: AppColors.muted)),
            if (d.sn('proofUploadId') != null) ...[
              const SectionHeader('Proof of delivery'),
              ClipRRect(borderRadius: BorderRadius.circular(14), child: UploadImage(uploadId: d.s('proofUploadId'), height: 200)),
              if (d.sn('proofRecipient') != null) Text('Received by ${d.s('proofRecipient')}'),
            ],
            const SectionHeader('Updates'),
            for (final e in d.l('events'))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(padding: EdgeInsets.only(top: 4), child: Icon(Icons.circle, size: 10, color: AppColors.coral)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(deliveryStatusLabel[e.s('status')] ?? labelize(e.s('status')), style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text('${e.m('actor').m('profile').s('fullName', 'System')} · ${dateTimeFmt(e.d('createdAt'))}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                      if (e.sn('note') != null) Text(e.s('note')),
                    ]),
                  ),
                ]),
              ),
            const SizedBox(height: 10),
            if (isCarrier && status == 'REQUESTED') ...[
              PrimaryButton(label: 'Accept this job', loading: _busy, onPressed: () => _update(d, 'ACCEPTED')),
              const SizedBox(height: 10),
              SecondaryButton(
                label: 'Decline',
                onPressed: () async {
                  try {
                    await ref.read(apiClientProvider).post('/deliveries/${widget.id}/decline', {});
                    ref.invalidate(openDeliveriesProvider);
                    if (context.mounted) context.pop();
                  } on ApiException catch (e) {
                    if (context.mounted) showSnack(context, e.message, error: true);
                  }
                },
              ),
            ],
            if (d.sn('transporterId') == me.id)
              for (final s in carrierNext[status] ?? const <String>[])
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: s == 'CANCELLED'
                      ? SecondaryButton(label: 'Cancel delivery', onPressed: _busy ? null : () => _update(d, s))
                      : PrimaryButton(label: 'Mark: ${deliveryStatusLabel[s]}', loading: _busy, onPressed: () => _update(d, s)),
                ),
            if (isRequester && (status == 'REQUESTED' || status == 'ACCEPTED' || status == 'PICKUP_SCHEDULED'))
              SecondaryButton(label: 'Cancel request', onPressed: _busy ? null : () => _update(d, 'CANCELLED')),
          ];
        },
      ),
    );
  }

  Widget _stop(IconData i, String label, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(i, size: 18, color: AppColors.coral),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)), Text(text)])),
        ]),
      );
}

class DeliveryRequestScreen extends ConsumerStatefulWidget {
  const DeliveryRequestScreen({super.key, this.orderId});
  final String? orderId;
  @override
  ConsumerState<DeliveryRequestScreen> createState() => _DeliveryRequestScreenState();
}

class _DeliveryRequestScreenState extends ConsumerState<DeliveryRequestScreen> {
  final _cargo = TextEditingController();
  final _weight = TextEditingController();
  final _pickup = TextEditingController();
  final _drop = TextEditingController();
  final _notes = TextEditingController();
  String? _pProv, _pDist, _dProv, _dDist;
  DateTime? _date;
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void initState() {
    super.initState();
    final u = ref.read(authControllerProvider).user;
    _pProv = u?.province;
    _pDist = u?.district;
  }

  @override
  void dispose() {
    for (final c in [_cargo, _weight, _pickup, _drop, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    try {
      final r = asJson(await ref.read(apiClientProvider).post('/deliveries', {
        'orderId': ?widget.orderId,
        'cargoDescription': _cargo.text.trim(),
        if (int.tryParse(_weight.text) != null) 'weightKg': int.parse(_weight.text),
        'pickupLocation': _pickup.text.trim(),
        'pickupProvince': _pProv,
        'pickupDistrict': _pDist,
        'dropoffLocation': _drop.text.trim(),
        'dropoffProvince': _dProv,
        'dropoffDistrict': _dDist,
        if (_date != null) 'expectedDate': isoDate(_date!),
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
      }));
      ref.invalidate(deliveriesProvider);
      if (!mounted) return;
      showSnack(context, 'Transport requested. Transporters in the area are notified.');
      context.pushReplacement('/deliveries/${r.s('id')}');
    } on ApiException catch (e) {
      setState(() {
        _fe = e;
        _error = e.fieldErrors.isEmpty ? e.message : 'Please check the highlighted fields.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _place(String title, List<Json> provinces, String? prov, String? dist, ValueChanged<String?> onProv, ValueChanged<String?> onDist, String fieldPrefix) {
    final districts = provinces.firstWhere((p) => p.s('value') == prov, orElse: () => <String, dynamic>{}).ls('districts');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppDropdown<String>(label: '$title province', value: prov, hint: 'Select', items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))], onChanged: onProv),
      const SizedBox(height: 12),
      AppDropdown<String>(
        label: '$title district',
        value: districts.contains(dist) ? dist : null,
        hint: 'Select',
        items: [for (final d in districts) DropdownMenuItem(value: d, child: Text(d))],
        onChanged: onDist,
        errorText: _fe?.field('${fieldPrefix}District'),
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final provinces = ref.watch(regionsProvider).value?.l('provinces') ?? const <Json>[];
    const gap = SizedBox(height: 16);
    return Scaffold(
      appBar: AppBar(title: const Text('Request transport')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FormErrorBox(_error),
          AppTextField(label: 'What needs moving?', controller: _cargo, hint: 'e.g. 40 × 50 kg bags of maize', errorText: _fe?.field('cargoDescription')),
          gap,
          AppTextField(label: 'Approximate weight (kg, optional)', controller: _weight, keyboardType: TextInputType.number),
          gap,
          AppTextField(label: 'Pickup location', controller: _pickup, hint: 'Farm, village or landmark', errorText: _fe?.field('pickupLocation')),
          gap,
          _place('Pickup', provinces, _pProv, _pDist, (v) => setState(() {
                _pProv = v;
                _pDist = null;
              }), (v) => setState(() => _pDist = v), 'pickup'),
          gap,
          AppTextField(label: 'Delivery location', controller: _drop, errorText: _fe?.field('dropoffLocation')),
          gap,
          _place('Delivery', provinces, _dProv, _dDist, (v) => setState(() {
                _dProv = v;
                _dDist = null;
              }), (v) => setState(() => _dDist = v), 'dropoff'),
          gap,
          AppDateField(label: 'Needed by (optional)', value: _date, optional: true, firstDate: DateTime.now(), onChanged: (d) => setState(() => _date = d)),
          gap,
          AppTextField(label: 'Notes (optional)', controller: _notes, maxLines: 3),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Request transport', loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}

class VehiclesScreen extends ConsumerWidget {
  const VehiclesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PageScaffold(
      title: 'Vehicles',
      fab: FloatingActionButton(backgroundColor: AppColors.coral, foregroundColor: AppColors.white, tooltip: 'Add vehicle', onPressed: () => _add(context, ref), child: const Icon(Icons.add)),
      body: CachedListView(
        value: ref.watch(vehiclesProvider),
        onRefresh: () => ref.refresh(vehiclesProvider.future),
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) return [const EmptyView(icon: Icons.fire_truck_outlined, title: 'No vehicles yet', message: 'Add your trucks so you can assign them to jobs.')];
          return [
            for (final v in list)
              ListTile(
                leading: const Icon(Icons.local_shipping_outlined),
                title: Text('${labelize(v.s('type'))} ${v.s('registration')}'),
                subtitle: Text('${numFmt(v.nn('capacityKg'))} kg capacity${v.b('isActive') ? '' : ' · inactive'}'),
              ),
          ];
        },
      ),
    );
  }

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final reg = TextEditingController();
    final cap = TextEditingController();
    String type = 'LIGHT_TRUCK';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AppDropdown<String>(
              label: 'Type',
              value: type,
              items: [for (final t in ['PICKUP', 'LIGHT_TRUCK', 'MEDIUM_TRUCK', 'HEAVY_TRUCK', 'REFRIGERATED_TRUCK', 'TRACTOR_TRAILER', 'MOTORBIKE']) DropdownMenuItem(value: t, child: Text(labelize(t)))],
              onChanged: (v) => set(() => type = v ?? type),
            ),
            const SizedBox(height: 12),
            AppTextField(label: 'Registration', controller: reg, textCapitalization: TextCapitalization.characters),
            const SizedBox(height: 12),
            AppTextField(label: 'Capacity (kg)', controller: cap, keyboardType: TextInputType.number),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Add vehicle',
              onPressed: () async {
                try {
                  await ref.read(apiClientProvider).post('/vehicles', {'type': type, 'registration': reg.text.trim(), 'capacityKg': int.tryParse(cap.text)});
                  ref.invalidate(vehiclesProvider);
                  if (c.mounted) Navigator.pop(c);
                } on ApiException catch (e) {
                  if (c.mounted) showSnack(c, e.message, error: true);
                }
              },
            ),
          ]),
        ),
      ),
    );
  }
}
