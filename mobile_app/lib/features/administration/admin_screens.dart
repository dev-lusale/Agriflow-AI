import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/states.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../authentication/presentation/auth_common.dart';
import '../farm_management/farm_providers.dart';

final adminOverviewProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/admin/overview'));
final adminUsersProvider = FutureProvider.family<Json, String>((ref, query) async => asJson(await userApi(ref).get('/admin/users', query: Uri.splitQueryString(query))));
final adminListingsProvider = FutureProvider.family<List<Json>, String>((ref, m) async => asJsonList(await userApi(ref).get('/admin/listings', query: m.isEmpty ? null : {'moderation': m})));
final adminReportsProvider = FutureProvider<List<Json>>((ref) async => asJsonList(await userApi(ref).get('/admin/reports')));

class AdminScreen extends ConsumerWidget {
  const AdminScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(adminOverviewProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Administration'), automaticallyImplyLeading: !embedded),
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(adminOverviewProvider.future),
        builder: (raw) {
          final d = asJson(raw);
          final s = d.m('stats');
          final ai = d.m('aiUsage');
          Widget stat(String l, Object v, IconData i, [Color tint = AppColors.coralSoft]) => StatTile(label: l, value: '$v', icon: i, tint: tint);
          return [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.6,
              children: [
                stat('Farmers', s.n('farmers').toInt(), Icons.agriculture_outlined, AppColors.leafSoft),
                stat('Buyers', s.n('buyers').toInt(), Icons.shopping_basket_outlined),
                stat('Suppliers', s.n('suppliers').toInt(), Icons.storefront_outlined),
                stat('Distributors', s.n('distributors').toInt(), Icons.local_shipping_outlined),
                stat('Transporters', s.n('transporters').toInt(), Icons.fire_truck_outlined, AppColors.skySoft),
                stat('Experts', s.n('experts').toInt(), Icons.school_outlined, AppColors.leafSoft),
                stat('Hectares registered', numFmt(s.nn('registeredHectares')), Icons.square_foot, AppColors.amberSoft),
                stat('Completed sales', zmw(s.nn('completedSalesValue')), Icons.payments_outlined, AppColors.leafSoft),
              ],
            ),
            const SectionHeader('Needs attention'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                ListTile(leading: const Icon(Icons.flag_outlined), title: Text('${s.n('listingsPendingReview').toInt()} listings to review'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/admin/listings')),
                ListTile(leading: const Icon(Icons.report_outlined), title: Text('${s.n('openContentReports').toInt()} open reports'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/admin/reports')),
                ListTile(leading: const Icon(Icons.gavel_outlined), title: Text('${s.n('disputedOrders').toInt()} disputed orders'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/orders')),
                ListTile(leading: const Icon(Icons.people_outline), title: const Text('Users and verification'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/admin/users')),
                ListTile(leading: const Icon(Icons.price_change_outlined), title: const Text('Record a market price'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/admin/prices/new')),
              ]),
            ),
            const SectionHeader('AI usage (30 days)'),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final f in ai.l('byFeature')) Text('${labelize(f.s('feature').replaceAll('.', '_'))}: ${f.n('count').toInt()} calls'),
                const SizedBox(height: 6),
                for (final st in ai.l('byStatus')) Text('${labelize(st.s('status'))}: ${st.n('count').toInt()}', style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: 6),
                Text('Tokens: ${numFmt(ai.nn('inputTokens'))} in · ${numFmt(ai.nn('outputTokens'))} out · avg ${ai.n('avgLatencyMs').toInt()} ms', style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
            ),
            if (d.l('cropHealthConcerns').isNotEmpty) ...[
              const SectionHeader('Top crop-health concerns'),
              for (final c in d.l('cropHealthConcerns')) Text('• ${c.s('issue', c.s('possibleIssue'))} (${c.n('count', c.n('_count')).toInt()})'),
            ],
          ];
        },
      ),
    );
  }
}

class AdminUsersScreen extends ConsumerStatefulWidget {
  const AdminUsersScreen({super.key});
  @override
  ConsumerState<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends ConsumerState<AdminUsersScreen> {
  String? _role;
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final query = Uri(queryParameters: {'role': ?_role, if (_q.isNotEmpty) 'q': _q}).query;
    final v = ref.watch(adminUsersProvider(query));
    return PageScaffold(
      title: 'Users',
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search name or email'), onSubmitted: (t) => setState(() => _q = t.trim())),
        ),
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), children: [
            for (final r in [null, 'FARMER', 'BUYER', 'SUPPLIER', 'DISTRIBUTOR', 'TRANSPORTER', 'EXPERT', 'ADMIN'])
              Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(r == null ? 'All' : labelize(r)), selected: _role == r, onSelected: (_) => setState(() => _role = r))),
          ]),
        ),
        Expanded(
          child: v.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(adminUsersProvider(query))),
            data: (d) => ListView(padding: const EdgeInsets.symmetric(horizontal: 16), children: [
              Text('${d.n('total').toInt()} users', style: const TextStyle(color: AppColors.muted)),
              for (final u in d.l('users'))
                AppCard(
                  margin: const EdgeInsets.only(top: 10),
                  shadow: false,
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(u.m('profile').s('fullName', u.s('email')), style: const TextStyle(fontWeight: FontWeight.w800))),
                      Pill(labelize(u.s('role'))),
                    ]),
                    Text('${u.s('email')}${u.m('profile').sn('district') != null ? ' · ${u.m('profile').s('district')}' : ''}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                    Row(children: [
                      Pill(u.sn('verifiedAt') != null ? 'Verified' : 'Not verified', color: u.sn('verifiedAt') != null ? AppColors.leafSoft : AppColors.surfaceAlt),
                      const SizedBox(width: 6),
                      Pill(labelize(u.s('status')), color: u.s('status') == 'ACTIVE' ? AppColors.leafSoft : AppColors.dangerSoft),
                      const Spacer(),
                      PopupMenuButton<String>(
                        tooltip: 'Actions',
                        onSelected: (a) async {
                          final api = ref.read(apiClientProvider);
                          try {
                            if (a == 'verify' || a == 'unverify') await api.post('/admin/users/${u.s('id')}/verify', {'verified': a == 'verify'});
                            if (a == 'suspend' || a == 'activate') {
                              if (!context.mounted) return;
                              if (a == 'suspend' && !await confirmDialog(context, title: 'Suspend this account?', message: 'They will be signed out and cannot log in until reactivated.', confirm: 'Suspend', destructive: true)) return;
                              await api.post('/admin/users/${u.s('id')}/status', {'status': a == 'suspend' ? 'SUSPENDED' : 'ACTIVE'});
                            }
                            ref.invalidate(adminUsersProvider(query));
                          } on ApiException catch (e) {
                            if (context.mounted) showSnack(context, e.message, error: true);
                          }
                        },
                        itemBuilder: (_) => [
                          PopupMenuItem(value: u.sn('verifiedAt') != null ? 'unverify' : 'verify', child: Text(u.sn('verifiedAt') != null ? 'Remove verification' : 'Verify')),
                          PopupMenuItem(value: u.s('status') == 'ACTIVE' ? 'suspend' : 'activate', child: Text(u.s('status') == 'ACTIVE' ? 'Suspend' : 'Reactivate')),
                        ],
                      ),
                    ]),
                  ]),
                ),
              const SizedBox(height: 24),
            ]),
          ),
        ),
      ]),
    );
  }
}

class AdminListingsScreen extends ConsumerStatefulWidget {
  const AdminListingsScreen({super.key});
  @override
  ConsumerState<AdminListingsScreen> createState() => _AdminListingsScreenState();
}

class _AdminListingsScreenState extends ConsumerState<AdminListingsScreen> {
  String _m = 'PENDING_REVIEW';

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(adminListingsProvider(_m));
    return PageScaffold(
      title: 'Listing moderation',
      body: Column(children: [
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), children: [
            for (final m in ['PENDING_REVIEW', 'FLAGGED', 'APPROVED', 'REMOVED'])
              Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(labelize(m)), selected: _m == m, onSelected: (_) => setState(() => _m = m))),
          ]),
        ),
        Expanded(
          child: v.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(adminListingsProvider(_m))),
            data: (list) => list.isEmpty
                ? const EmptyView(icon: Icons.task_alt, title: 'Nothing to review')
                : ListView(padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                    for (final l in list)
                      AppCard(
                        margin: const EdgeInsets.only(bottom: 10),
                        shadow: false,
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(l.s('title'), style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text('${l.m('crop').s('name')} · ${zmw(l.nn('pricePerUnit'))}/${unitLabel(l.s('unit'))} · ${l.m('farmer').m('profile').s('fullName')}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                          Row(children: [
                            TextButton(onPressed: () => context.push('/market/listing/${l.s('id')}'), child: const Text('View')),
                            const Spacer(),
                            for (final dec in ['APPROVED', 'FLAGGED', 'REMOVED'])
                              if (dec != _m)
                                TextButton(
                                  onPressed: () async {
                                    try {
                                      await ref.read(apiClientProvider).post('/admin/listings/${l.s('id')}/moderate', {'decision': dec});
                                      ref.invalidate(adminListingsProvider(_m));
                                    } on ApiException catch (e) {
                                      if (context.mounted) showSnack(context, e.message, error: true);
                                    }
                                  },
                                  child: Text(dec == 'APPROVED' ? 'Approve' : dec == 'FLAGGED' ? 'Flag' : 'Remove', style: TextStyle(color: dec == 'REMOVED' ? AppColors.danger : null)),
                                ),
                          ]),
                        ]),
                      ),
                  ]),
          ),
        ),
      ]),
    );
  }
}

class AdminReportsScreen extends ConsumerWidget {
  const AdminReportsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(adminReportsProvider);
    return PageScaffold(
      title: 'Reported content',
      body: v.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(adminReportsProvider)),
        data: (list) => list.isEmpty
            ? const EmptyView(icon: Icons.task_alt, title: 'No open reports')
            : ListView(padding: const EdgeInsets.all(16), children: [
                for (final r in list)
                  AppCard(
                    margin: const EdgeInsets.only(bottom: 10),
                    shadow: false,
                    padding: const EdgeInsets.all(12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${labelize(r.s('entityType'))} reported', style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(r.s('reason', 'No reason given')),
                      Text(dateTimeFmt(r.d('createdAt')), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                        for (final st in ['DISMISSED', 'RESOLVED'])
                          TextButton(
                            onPressed: () async {
                              try {
                                await ref.read(apiClientProvider).post('/admin/reports/${r.s('id')}/resolve', {'status': st});
                                ref.invalidate(adminReportsProvider);
                              } on ApiException catch (e) {
                                if (context.mounted) showSnack(context, e.message, error: true);
                              }
                            },
                            child: Text(st == 'RESOLVED' ? 'Resolve' : 'Dismiss'),
                          ),
                      ]),
                    ]),
                  ),
              ]),
      ),
    );
  }
}

class AdminPriceFormScreen extends ConsumerStatefulWidget {
  const AdminPriceFormScreen({super.key});
  @override
  ConsumerState<AdminPriceFormScreen> createState() => _AdminPriceFormScreenState();
}

class _AdminPriceFormScreenState extends ConsumerState<AdminPriceFormScreen> {
  String? _cropId;
  String? _province;
  String _unit = 'BAG_50KG';
  String _sourceType = 'VERIFIED_OBSERVATION';
  DateTime _date = DateTime.now();
  final _price = TextEditingController();
  final _market = TextEditingController();
  final _source = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_price, _market, _source, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final crops = asJsonList(ref.watch(cropCatalogProvider).value?.data);
    final provinces = ref.watch(regionsProvider).value?.l('provinces') ?? const <Json>[];
    const gap = SizedBox(height: 14);
    return Scaffold(
      appBar: AppBar(title: const Text('Record market price')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Only record prices you observed or took from a named source. Each price is shown with its source and date.', style: TextStyle(color: AppColors.muted)),
          gap,
          FormErrorBox(_error),
          AppDropdown<String>(label: 'Crop', value: _cropId, hint: 'Select', items: [for (final c in crops) DropdownMenuItem(value: c.s('id'), child: Text(c.s('name')))], onChanged: (v) => setState(() => _cropId = v)),
          gap,
          AppDropdown<String>(label: 'Province', value: _province, hint: 'Select', items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))], onChanged: (v) => setState(() => _province = v)),
          gap,
          AppTextField(label: 'Market (optional)', controller: _market, hint: 'e.g. Soweto Market, Lusaka'),
          gap,
          Row(children: [
            Expanded(child: AppTextField(label: 'Price (ZMW)', controller: _price, keyboardType: const TextInputType.numberWithOptions(decimal: true))),
            const SizedBox(width: 12),
            Expanded(child: AppDropdown<String>(label: 'Per', value: _unit, items: [for (final u in quantityUnits) DropdownMenuItem(value: u, child: Text(unitLabel(u)))], onChanged: (v) => setState(() => _unit = v ?? _unit))),
          ]),
          gap,
          AppDateField(label: 'Observed on', value: _date, lastDate: DateTime.now(), onChanged: (d) => setState(() => _date = d ?? _date)),
          gap,
          AppDropdown<String>(
            label: 'Source type',
            value: _sourceType,
            items: const [DropdownMenuItem(value: 'VERIFIED_OBSERVATION', child: Text('Verified observation')), DropdownMenuItem(value: 'HISTORICAL_RECORD', child: Text('Historical record'))],
            onChanged: (v) => setState(() => _sourceType = v ?? _sourceType),
          ),
          gap,
          AppTextField(label: 'Source', controller: _source, hint: 'e.g. FRA floor price announcement, market survey by …'),
          gap,
          AppTextField(label: 'Notes (optional)', controller: _notes),
          const SizedBox(height: 22),
          PrimaryButton(
            label: 'Save price',
            loading: _busy,
            onPressed: () async {
              setState(() {
                _busy = true;
                _error = null;
              });
              try {
                await ref.read(apiClientProvider).post('/admin/market-prices', {
                  'cropId': _cropId,
                  'province': _province,
                  if (_market.text.trim().isNotEmpty) 'marketName': _market.text.trim(),
                  'unit': _unit,
                  'price': num.tryParse(_price.text),
                  'observedOn': isoDate(_date),
                  'sourceType': _sourceType,
                  'sourceName': _source.text.trim(),
                  if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
                });
                if (context.mounted) {
                  showSnack(context, 'Price recorded.');
                  context.pop();
                }
              } on ApiException catch (e) {
                setState(() => _error = e.fieldErrors.isEmpty ? e.message : e.fieldErrors.entries.map((x) => '${x.key}: ${x.value.join(' ')}').join('\n'));
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
        ]),
      ),
    );
  }
}
