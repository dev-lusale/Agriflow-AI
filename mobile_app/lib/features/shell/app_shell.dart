import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../models/app_user.dart';
import '../authentication/application/auth_controller.dart';

class _Tab {
  const _Tab(this.label, this.icon, this.activeIcon);
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// Labels for the 5 tabs depend on the account type (same branches for everyone).
List<_Tab> tabsFor(AppUser? u) {
  final role = u?.role ?? UserRole.unknown;
  final second = switch (role) {
    UserRole.farmer => const _Tab('My Farm', Icons.agriculture_outlined, Icons.agriculture),
    UserRole.supplier => const _Tab('Business', Icons.storefront_outlined, Icons.storefront),
    UserRole.distributor => const _Tab('Business', Icons.local_shipping_outlined, Icons.local_shipping),
    UserRole.transporter => const _Tab('Deliveries', Icons.local_shipping_outlined, Icons.local_shipping),
    UserRole.expert => const _Tab('Cases', Icons.health_and_safety_outlined, Icons.health_and_safety),
    UserRole.buyer => const _Tab('Deliveries', Icons.local_shipping_outlined, Icons.local_shipping),
    UserRole.admin || UserRole.superAdmin => const _Tab('Admin', Icons.admin_panel_settings_outlined, Icons.admin_panel_settings),
    _ => const _Tab('Work', Icons.work_outline, Icons.work),
  };
  final third = role == UserRole.farmer
      ? const _Tab('AI Assistant', Icons.auto_awesome_outlined, Icons.auto_awesome)
      : const _Tab('Orders', Icons.receipt_outlined, Icons.receipt);
  return [
    const _Tab('Home', Icons.home_outlined, Icons.home),
    second,
    third,
    const _Tab('Marketplace', Icons.storefront_outlined, Icons.storefront),
    const _Tab('Profile', Icons.person_outline, Icons.person),
  ];
}

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;
  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  @override
  void initState() {
    super.initState();
    // Send records saved offline whenever the connection comes back.
    WidgetsBinding.instance.addPostFrameCallback((_) => _flush());
  }

  Future<void> _flush() async {
    final n = await ref.read(syncQueueProvider).flush(ref.read(apiClientProvider));
    if (n > 0 && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$n offline record${n == 1 ? '' : 's'} synced.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<bool>>(onlineProvider, (prev, next) {
      if (next.value == true && prev?.value != true) _flush();
    });
    final user = ref.watch(authControllerProvider).user;
    final online = ref.watch(onlineProvider).value ?? true;
    final tabs = tabsFor(user);
    return Scaffold(
      body: Column(children: [
        if (!online)
          Material(
            color: AppColors.ink,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(children: const [
                  Icon(Icons.cloud_off, color: AppColors.white, size: 16),
                  SizedBox(width: 8),
                  Expanded(child: Text('Offline — showing saved data. New farm records will sync later.', style: TextStyle(fontFamily: kFont, color: AppColors.white, fontSize: 12.5, fontWeight: FontWeight.w600))),
                ]),
              ),
            ),
          ),
        Expanded(child: MediaQuery.removePadding(context: context, removeTop: !online, child: widget.shell)),
      ]),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.ink, width: 1.2))),
        child: NavigationBar(
          selectedIndex: widget.shell.currentIndex,
          onDestinationSelected: (i) => widget.shell.goBranch(i, initialLocation: i == widget.shell.currentIndex),
          destinations: [for (final t in tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.activeIcon), label: t.label)],
        ),
      ),
    );
  }
}
