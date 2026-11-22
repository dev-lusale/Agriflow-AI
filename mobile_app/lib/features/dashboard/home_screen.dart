import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/config/env.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/cards.dart';
import '../../models/app_user.dart';
import '../authentication/application/auth_controller.dart';
import '../weather/weather_widgets.dart';

final dashboardProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/dashboard'));

class QuickAction {
  const QuickAction(this.label, this.icon, this.route, this.tint);
  final String label;
  final IconData icon;
  final String route;
  final Color tint;
}

List<QuickAction> quickActionsFor(AppUser u) {
  const market = QuickAction('Marketplace', Icons.storefront_outlined, '/market', AppColors.coralSoft);
  const prices = QuickAction('Market prices', Icons.trending_up, '/prices', AppColors.leafSoft);
  const weather = QuickAction('Weather', Icons.wb_sunny_outlined, '/weather', AppColors.skySoft);
  if (u.isFarmer) {
    return const [
      QuickAction('Ask AgriFlow AI', Icons.auto_awesome, '/ai', AppColors.coralSoft),
      QuickAction('Manage farm', Icons.agriculture_outlined, '/farm', AppColors.leafSoft),
      QuickAction('Crop disease', Icons.healing_outlined, '/crop-health/new', AppColors.dangerSoft),
      weather,
      market,
      prices,
      QuickAction('Inventory', Icons.inventory_2_outlined, '/inventory', AppColors.amberSoft),
      QuickAction('Finances', Icons.account_balance_wallet_outlined, '/finance', AppColors.surfaceAlt),
    ];
  }
  if (u.isAdmin) {
    return const [
      QuickAction('Users', Icons.people_outline, '/admin/users', AppColors.coralSoft),
      QuickAction('Moderation', Icons.flag_outlined, '/admin/listings', AppColors.dangerSoft),
      QuickAction('Add price', Icons.price_change_outlined, '/admin/prices/new', AppColors.leafSoft),
      QuickAction('AI usage', Icons.insights_outlined, '/admin', AppColors.skySoft),
      market,
      prices,
      weather,
      QuickAction('Orders', Icons.receipt_long_outlined, '/orders', AppColors.amberSoft),
    ];
  }
  return [
    if (u.isSeller) const QuickAction('My products', Icons.inventory_outlined, '/seller/products', AppColors.coralSoft),
    if (u.holdsStock) const QuickAction('Inventory', Icons.inventory_2_outlined, '/inventory', AppColors.amberSoft),
    if (u.isCarrier) const QuickAction('Delivery requests', Icons.local_shipping_outlined, '/deliveries/open', AppColors.skySoft),
    if (u.isCarrier) const QuickAction('Vehicles', Icons.fire_truck_outlined, '/vehicles', AppColors.surfaceAlt),
    if (u.isExpert) const QuickAction('Review cases', Icons.health_and_safety_outlined, '/expert', AppColors.dangerSoft),
    const QuickAction('Orders', Icons.receipt_long_outlined, '/orders', AppColors.amberSoft),
    const QuickAction('Deliveries', Icons.route_outlined, '/deliveries', AppColors.skySoft),
    market,
    prices,
    weather,
  ];
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user!;
    final dash = ref.watch(dashboardProvider);
    final api = ref.read(apiClientProvider);
    return Scaffold(
      body: SafeArea(
        child: CachedListView(
          value: dash,
          onRefresh: () => ref.refresh(dashboardProvider.future),
          builder: (raw) {
            final d = asJson(raw);
            final loc = d.mn('location');
            final farm = d.mn('farm');
            final avatar = d.sn('avatarUrl');
            final unread = d.n('unreadNotifications').toInt();
            return [
              Row(children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.coralSoft,
                  backgroundImage: avatar == null ? null : CachedNetworkImageProvider('${Env.apiBaseUrl}$avatar', headers: api.authHeaders),
                  child: avatar == null ? Text(initials(user.fullName), style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, color: AppColors.ink)) : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${_greeting()}, ${d.s('greetingName', user.firstName)}', style: Theme.of(context).textTheme.titleLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Row(children: [
                      const Icon(Icons.place_outlined, size: 14, color: AppColors.muted),
                      const SizedBox(width: 2),
                      Flexible(
                        child: Text(loc == null ? 'Set your location in Profile' : '${loc.s('district')}, ${labelize(loc.s('province'))}',
                            style: const TextStyle(color: AppColors.muted, fontSize: 13), overflow: TextOverflow.ellipsis),
                      ),
                    ]),
                  ]),
                ),
                IconButton(
                  tooltip: 'Notifications',
                  onPressed: () => context.push('/notifications'),
                  icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined, size: 28)),
                ),
              ]),
              const SizedBox(height: 18),
              if (!user.emailVerified)
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: AppCard(
                    color: AppColors.amberSoft,
                    shadow: false,
                    onTap: () => context.push('/verify-email'),
                    padding: const EdgeInsets.all(12),
                    child: const Row(children: [
                      Icon(Icons.mark_email_unread_outlined),
                      SizedBox(width: 10),
                      Expanded(child: Text('Verify your email to secure your account.', style: TextStyle(fontWeight: FontWeight.w700))),
                      Icon(Icons.chevron_right),
                    ]),
                  ),
                ),
              WeatherSummaryCard(weather: d.m('weather'), onTap: () => context.push('/weather')),
              const SectionHeader('Quick actions'),
              GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 10,
                childAspectRatio: 0.78,
                children: [for (final a in quickActionsFor(user)) _QuickTile(a)],
              ),
              if (farm != null) ..._farmSection(context, farm),
              ..._insights(context, d.m('weather')),
              if (d.l('marketPrices').isNotEmpty) ...[
                SectionHeader('Market prices', action: 'See all', onAction: () => context.push('/prices')),
                SizedBox(
                  height: 108,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: d.l('marketPrices').length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (_, i) {
                      final p = d.l('marketPrices')[i];
                      return SizedBox(
                        width: 168,
                        child: AppCard(
                          padding: const EdgeInsets.all(12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(p.s('crop'), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text('${zmw(p.nn('priceZmw'))} / ${unitLabel(p.s('unit'))}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.coralDark)),
                            const Spacer(),
                            Text('${labelize(p.s('province'))} · ${dateFmt(p.d('observedOn'))}', style: const TextStyle(fontSize: 11.5, color: AppColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
              ],
              if (d.l('recentTransactions').isNotEmpty) ...[
                SectionHeader('Recent transactions', action: 'Finances', onAction: () => context.push('/finance')),
                AppCard(
                  padding: EdgeInsets.zero,
                  child: Column(children: [
                    for (final t in d.l('recentTransactions'))
                      ListTile(
                        dense: true,
                        leading: Icon(t.s('type') == 'INCOME' ? Icons.south_west : Icons.north_east, color: t.s('type') == 'INCOME' ? AppColors.leaf : AppColors.danger),
                        title: Text(t.s('description', labelize(t.s('category'))), maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text(dateFmt(t.d('date'))),
                        trailing: Text('${t.s('type') == 'INCOME' ? '+' : '−'}${zmw(t.nn('amount'))}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      ),
                  ]),
                ),
              ],
              if (d.l('notifications').isNotEmpty) ...[
                SectionHeader('Notifications', action: 'All', onAction: () => context.push('/notifications')),
                for (final n in d.l('notifications').take(3))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      shadow: false,
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        Icon(n.sn('readAt') == null ? Icons.circle : Icons.circle_outlined, size: 10, color: AppColors.coral),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(n.s('title'), style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(n.s('body'), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                          ]),
                        ),
                      ]),
                    ),
                  ),
              ],
            ];
          },
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  List<Widget> _farmSection(BuildContext context, Json farm) {
    final crops = farm.l('activeCrops');
    final tasks = farm.l('upcomingTasks');
    return [
      SectionHeader('Farm overview', action: 'My farm', onAction: () => context.go('/farm')),
      Row(children: [
        Expanded(child: StatTile(label: 'Farms', value: '${farm.n('farmCount').toInt()}', icon: Icons.agriculture_outlined, tint: AppColors.leafSoft)),
        const SizedBox(width: 10),
        Expanded(child: StatTile(label: 'Hectares', value: numFmt(farm.nn('totalHectares')), icon: Icons.square_foot, tint: AppColors.amberSoft)),
        const SizedBox(width: 10),
        Expanded(child: StatTile(label: 'Active crops', value: '${crops.length}', icon: Icons.grass, tint: AppColors.coralSoft)),
      ]),
      const SectionHeader('My crops'),
      SizedBox(
        height: 112,
        child: ListView(scrollDirection: Axis.horizontal, children: [
          for (final c in crops)
            Padding(
              padding: const EdgeInsets.only(right: 14),
              child: InkWell(
                onTap: () => context.push('/farm'),
                borderRadius: BorderRadius.circular(40),
                child: Column(children: [
                  Container(
                    width: 68,
                    height: 68,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AppColors.leafSoft, shape: BoxShape.circle, border: Border.all(color: AppColors.ink, width: 1.4)),
                    child: Text(initials(c.s('crop')), style: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, fontSize: 20)),
                  ),
                  const SizedBox(height: 6),
                  SizedBox(width: 76, child: Text(c.s('crop'), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
                  Text(labelize(c.s('status')), style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
              ),
            ),
          InkWell(
            onTap: () => context.push('/crop-records/new'),
            borderRadius: BorderRadius.circular(40),
            child: Column(children: [
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.ink, width: 1.4)),
                child: const Icon(Icons.add, size: 30),
              ),
              const SizedBox(height: 6),
              const Text('Add crop', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            ]),
          ),
        ]),
      ),
      for (final c in crops.take(2)) _GrowthCard(c),
      if (tasks.isNotEmpty) ...[
        SectionHeader('Upcoming activities', action: 'All tasks', onAction: () => context.push('/tasks')),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (final t in tasks)
              ListTile(
                leading: const Icon(Icons.event_note_outlined),
                title: Text(t.s('title'), maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text('${dayFmt(t.d('dueDate'))}${t.mn('farm') != null ? ' · ${t.m('farm').s('name')}' : ''}'),
              ),
          ]),
        ),
      ],
    ];
  }

  List<Widget> _insights(BuildContext context, Json weather) {
    final advice = weatherAdvice(weather);
    return [
      const SectionHeader('Farming insights'),
      AppCard(
        color: AppColors.coralSoft,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (advice.isEmpty)
            const Text('No weather warnings for your area in the coming days.', style: TextStyle(fontWeight: FontWeight.w600))
          else
            for (final a in advice)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.tips_and_updates_outlined, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(a)),
                ]),
              ),
          const SizedBox(height: 4),
          const Text('Based on the weather forecast for your farm or district.', style: TextStyle(fontSize: 12, color: AppColors.muted)),
        ]),
      ),
    ];
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile(this.a);
  final QuickAction a;

  @override
  Widget build(BuildContext context) {
    final isTab = a.route == '/ai' || a.route == '/farm' || a.route == '/market';
    return Semantics(
      button: true,
      label: a.label,
      child: InkWell(
        onTap: () => isTab ? context.go(a.route) : context.push(a.route),
        borderRadius: BorderRadius.circular(14),
        child: Column(children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(color: a.tint, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.ink, width: 1.3), boxShadow: hardShadow(2, 2)),
            child: Icon(a.icon, color: AppColors.ink, size: 26),
          ),
          const SizedBox(height: 6),
          Text(a.label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: kFont, fontSize: 11.5, fontWeight: FontWeight.w700, height: 1.2)),
        ]),
      ),
    );
  }
}

class _GrowthCard extends StatelessWidget {
  const _GrowthCard(this.c);
  final Json c;

  @override
  Widget build(BuildContext context) {
    final planted = c.d('plantingDate');
    final harvest = c.d('expectedHarvestDate');
    double? progress;
    if (planted != null && harvest != null && harvest.isAfter(planted)) {
      progress = (DateTime.now().difference(planted).inDays / harvest.difference(planted).inDays).clamp(0.0, 1.0).toDouble();
    }
    final days = planted == null ? null : DateTime.now().difference(planted).inDays;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${c.s('crop')} · ${c.s('farm')}', style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(child: Text('Planted: ${dateFmt(planted)}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted))),
            Text('Est. harvest: ${dateFmt(harvest)}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
          ]),
          const SizedBox(height: 8),
          if (progress != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(value: progress, minHeight: 12, backgroundColor: AppColors.divider, color: AppColors.leaf),
            )
          else
            const Text('Add planting and harvest dates to track progress.', style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
          if (days != null && days >= 0) ...[
            const SizedBox(height: 6),
            Text('$days days since planting${progress != null ? ' · ${(progress * 100).round()}% of season' : ''}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
          ],
        ]),
      ),
    );
  }
}
