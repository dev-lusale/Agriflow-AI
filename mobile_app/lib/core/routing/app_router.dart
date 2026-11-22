import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../features/administration/admin_screens.dart';
import '../../features/ai_assistant/ai_chat_screen.dart';
import '../../features/authentication/application/auth_controller.dart';
import '../../features/authentication/presentation/login_screen.dart';
import '../../features/authentication/presentation/onboarding_screen.dart';
import '../../features/authentication/presentation/password_screens.dart';
import '../../features/authentication/presentation/register_screen.dart';
import '../../features/authentication/presentation/verify_email_screen.dart';
import '../../features/authentication/presentation/welcome_screen.dart';
import '../../features/dashboard/home_screen.dart';
import '../../features/disease_detection/crop_health_screens.dart';
import '../../features/expert/expert_screens.dart';
import '../../features/farm_management/farm_detail_screen.dart';
import '../../features/farm_management/farm_form_screen.dart';
import '../../features/farm_management/my_farm_screen.dart';
import '../../features/farm_management/record_forms.dart';
import '../../features/finance/finance_screens.dart';
import '../../features/inventory/inventory_screens.dart';
import '../../features/logistics/logistics_screens.dart';
import '../../features/market_prices/prices_screens.dart';
import '../../features/marketplace/detail_screens.dart';
import '../../features/marketplace/market_screen.dart';
import '../../features/marketplace/orders_screens.dart';
import '../../features/marketplace/sell_screens.dart';
import '../../features/notifications/notification_screens.dart';
import '../../features/profile/profile_screens.dart';
import '../../features/seller/seller_screens.dart';
import '../../features/shell/app_shell.dart';
import '../../features/weather/weather_screen.dart';
import '../../models/app_user.dart';
import '../utils/json.dart';
import '../widgets/logo.dart';

const publicRoutes = {'/welcome', '/login', '/register', '/forgot-password', '/reset-password'};

/// Decides where a navigation may go. Pure function so it can be unit-tested.
@visibleForTesting
String? authRedirect(AuthState auth, String location) {
  if (auth.status == AuthStatus.unknown) return location == '/splash' ? null : '/splash';
  if (auth.status == AuthStatus.signedOut) return publicRoutes.contains(location) ? null : '/welcome';
  final u = auth.user!;
  if (location == '/verify-email') return null;
  if (!u.onboardingCompleted && !u.isAdmin) return location == '/onboarding' ? null : '/onboarding';
  if (location == '/splash' || location == '/onboarding' || publicRoutes.contains(location)) return '/home';
  return null;
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: AppLogo(height: 110)));
}

/// Role-specific second / third tab content.
class _WorkTab extends ConsumerWidget {
  const _WorkTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(authControllerProvider).user;
    return switch (u?.role) {
      UserRole.farmer => const MyFarmScreen(),
      UserRole.supplier || UserRole.distributor => const BusinessScreen(),
      UserRole.transporter || UserRole.buyer => const DeliveriesScreen(embedded: true),
      UserRole.expert => const ExpertCasesScreen(embedded: true),
      UserRole.admin || UserRole.superAdmin => const AdminScreen(embedded: true),
      _ => const SizedBox.shrink(),
    };
  }
}

class _AiOrOrdersTab extends ConsumerWidget {
  const _AiOrOrdersTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(authControllerProvider).user;
    return u?.isFarmer == true ? const AiChatScreen() : const OrdersScreen(embedded: true);
  }
}

final _rootKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ValueNotifier<AuthState>(ref.read(authControllerProvider));
  ref.listen<AuthState>(authControllerProvider, (_, next) => auth.value = next);
  ref.onDispose(auth.dispose);

  GoRoute page(String path, Widget Function(GoRouterState s) build) => GoRoute(path: path, parentNavigatorKey: _rootKey, builder: (_, s) => build(s));

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/splash',
    refreshListenable: auth,
    redirect: (_, state) => authRedirect(auth.value, state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const _Splash()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/reset-password', builder: (_, s) => ResetPasswordScreen(info: asJson(s.extra))),
      GoRoute(path: '/verify-email', builder: (_, s) => VerifyEmailScreen(initialDelivery: s.extra is Map ? asJson(s.extra) : null)),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/farm', builder: (_, _) => const _WorkTab())]),
          StatefulShellBranch(routes: [GoRoute(path: '/ai', builder: (_, _) => const _AiOrOrdersTab())]),
          StatefulShellBranch(routes: [GoRoute(path: '/market', builder: (_, _) => const MarketScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      // Farm management
      page('/farms/new', (_) => const FarmFormScreen()),
      page('/farms/:id', (s) => FarmDetailScreen(id: s.pathParameters['id']!)),
      page('/farms/:id/edit', (s) => FarmFormScreen(existing: asJson(s.extra))),
      page('/crop-records/new', (s) => CropRecordFormScreen(farmId: s.uri.queryParameters['farmId'])),
      page('/crop-records/:id', (s) => CropRecordFormScreen(existing: asJson(s.extra))),
      page('/activities/new', (s) => ActivityFormScreen(farmId: s.uri.queryParameters['farmId'], type: s.uri.queryParameters['type'])),
      page('/tasks', (_) => const TasksScreen()),
      page('/tasks/new', (_) => const TaskFormScreen()),
      // AI & crop health
      page('/ai/chat/:id', (s) => AiChatScreen(conversationId: s.pathParameters['id'])),
      page('/ai/advice/:id', (s) => CropAdviceScreen(cropRecordId: s.pathParameters['id']!, title: s.extra as String?)),
      page('/crop-health', (_) => const CropHealthHistoryScreen()),
      page('/crop-health/new', (_) => const CropHealthNewScreen()),
      page('/crop-health/:id', (s) => CropHealthResultScreen(id: s.pathParameters['id']!)),
      page('/expert', (_) => const ExpertCasesScreen()),
      // Weather & prices
      page('/weather', (s) => WeatherScreen(farmId: s.uri.queryParameters['farmId'])),
      page('/prices', (_) => const PricesScreen()),
      page('/prices/:cropId', (s) => PriceHistoryScreen(cropId: s.pathParameters['cropId']!, province: s.uri.queryParameters['province'], name: s.uri.queryParameters['name'])),
      // Marketplace & orders
      page('/market/listing/:id', (s) => ListingDetailScreen(id: s.pathParameters['id']!)),
      page('/market/product/:id', (s) => ProductDetailScreen(id: s.pathParameters['id']!)),
      page('/market/sell', (_) => const SellListingScreen()),
      page('/market/my-listings', (_) => const MyListingsScreen()),
      page('/orders', (_) => const OrdersScreen()),
      page('/orders/:id', (s) => OrderDetailScreen(id: s.pathParameters['id']!)),
      page('/conversations', (_) => const ConversationsScreen()),
      page('/conversations/:id', (s) => ConversationScreen(id: s.pathParameters['id']!)),
      page('/seller/products', (_) => const MyProductsScreen()),
      page('/seller/products/new', (_) => const ProductFormScreen()),
      // Operations
      page('/inventory', (_) => const InventoryScreen()),
      page('/deliveries', (_) => const DeliveriesScreen()),
      page('/deliveries/open', (_) => const OpenRequestsScreen()),
      page('/deliveries/new', (s) => DeliveryRequestScreen(orderId: s.uri.queryParameters['orderId'])),
      page('/deliveries/:id', (s) => DeliveryDetailScreen(id: s.pathParameters['id']!)),
      page('/vehicles', (_) => const VehiclesScreen()),
      page('/finance', (_) => const FinanceScreen()),
      // Account
      page('/notifications', (_) => const NotificationsScreen()),
      page('/notification-settings', (_) => const NotificationSettingsScreen()),
      page('/profile/edit', (_) => const EditProfileScreen()),
      page('/profile/password', (_) => const ChangePasswordScreen()),
      page('/sync', (_) => const SyncQueueScreen()),
      // Administration
      page('/admin', (_) => const AdminScreen()),
      page('/admin/users', (_) => const AdminUsersScreen()),
      page('/admin/listings', (_) => const AdminListingsScreen()),
      page('/admin/reports', (_) => const AdminReportsScreen()),
      page('/admin/prices/new', (_) => const AdminPriceFormScreen()),
    ],
  );
});
