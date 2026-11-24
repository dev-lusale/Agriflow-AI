import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';

final notificationsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/notifications'));
final preferencesProvider = FutureProvider<Json>((ref) async => asJson(await ref.watch(userApiProvider).get('/notification-preferences')));
final conversationsListProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/conversations'));
final conversationProvider = FutureProvider.family<Cached<dynamic>, String>((ref, id) => cachedGet(ref, '/conversations/$id'));

IconData notificationIcon(String type) => switch (type) {
      'WEATHER_ALERT' => Icons.thunderstorm_outlined,
      'TASK_REMINDER' || 'HARVEST_REMINDER' => Icons.event_note_outlined,
      'AI_REPORT' => Icons.auto_awesome_outlined,
      'DELIVERY_UPDATE' || 'DELIVERY_REQUEST' => Icons.local_shipping_outlined,
      'LOW_INVENTORY' => Icons.inventory_2_outlined,
      'NEW_MESSAGE' => Icons.chat_bubble_outline,
      'MODERATION' => Icons.flag_outlined,
      'ACCOUNT' => Icons.person_outline,
      _ => Icons.receipt_long_outlined,
    };

/// Website links in notifications → screens in the app.
String? appRouteFor(String? link) {
  if (link == null || link.isEmpty) return null;
  final m = RegExp(r'/orders/([\w-]+)').firstMatch(link);
  if (m != null) return '/orders/${m.group(1)}';
  final d = RegExp(r'/deliveries/([\w-]+)').firstMatch(link);
  if (d != null) return '/deliveries/${d.group(1)}';
  final c = RegExp(r'/messages/([\w-]+)').firstMatch(link);
  if (c != null) return '/conversations/${c.group(1)}';
  final ch = RegExp(r'crop-health/([\w-]+)').firstMatch(link);
  if (ch != null) return '/crop-health/${ch.group(1)}';
  if (link.contains('crop-health')) return '/crop-health';
  if (link.contains('/expert')) return '/expert';
  if (link.contains('inventory')) return '/inventory';
  if (link.contains('tasks') || link.contains('calendar')) return '/tasks';
  if (link.contains('weather')) return '/weather';
  return null;
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(notificationsProvider);
    return PageScaffold(
      title: 'Notifications',
      actions: [
        IconButton(tooltip: 'Messages', onPressed: () => context.push('/conversations'), icon: const Icon(Icons.chat_outlined)),
        IconButton(tooltip: 'Notification settings', onPressed: () => context.push('/notification-settings'), icon: const Icon(Icons.tune)),
      ],
      body: CachedListView(
        value: v,
        onRefresh: () => ref.refresh(notificationsProvider.future),
        builder: (raw) {
          final d = asJson(raw);
          final items = d.l('items');
          if (items.isEmpty) return [const EmptyView(icon: Icons.notifications_none, title: 'All caught up', message: 'Weather alerts, reminders, orders and deliveries will appear here.')];
          return [
            if (d.n('unread') > 0)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () async {
                    await ref.read(apiClientProvider).post('/notifications/read-all');
                    ref.invalidate(notificationsProvider);
                  },
                  child: const Text('Mark all as read'),
                ),
              ),
            for (final n in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  shadow: n.sn('readAt') == null,
                  color: n.sn('readAt') == null ? AppColors.white : AppColors.background,
                  padding: const EdgeInsets.all(12),
                  onTap: () async {
                    if (n.sn('readAt') == null) {
                      ref.read(apiClientProvider).post('/notifications/${n.s('id')}/read').then((_) => ref.invalidate(notificationsProvider)).catchError((_) => null);
                    }
                    final r = appRouteFor(n.sn('link'));
                    if (r != null && context.mounted) context.push(r);
                  },
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(notificationIcon(n.s('type')), color: n.sn('readAt') == null ? AppColors.coral : AppColors.muted),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(n.s('title'), style: TextStyle(fontWeight: n.sn('readAt') == null ? FontWeight.w800 : FontWeight.w600)),
                        if (n.sn('body') != null) Text(n.s('body'), style: const TextStyle(color: AppColors.muted, fontSize: 13.5)),
                        Text(relative(n.d('createdAt')), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                      ]),
                    ),
                  ]),
                ),
              ),
          ];
        },
      ),
    );
  }
}

class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(preferencesProvider);
    final push = ref.read(pushServiceProvider);
    return PageScaffold(
      title: 'Notification settings',
      body: v.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(preferencesProvider)),
        data: (d) => ListView(padding: const EdgeInsets.all(16), children: [
          AppCard(
            color: push.configured ? AppColors.leafSoft : AppColors.amberSoft,
            shadow: false,
            child: Text(push.configured
                ? (push.ready ? 'Push notifications are on for this phone.' : 'Push notifications are set up; allow notifications for AgriFlow AI in Android settings.')
                : 'Push notifications are not set up on this build yet. You will still see everything in the notification centre.'),
          ),
          const SizedBox(height: 12),
          for (final p in d.l('preferences'))
            AppCard(
              shadow: false,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 8), child: Text(p.s('label', labelize(p.s('type'))), style: const TextStyle(fontWeight: FontWeight.w800))),
                SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, title: const Text('In the app'), value: p.b('inApp'), onChanged: (val) => _save(context, ref, p, inApp: val)),
                SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, title: const Text('Email'), value: p.b('email'), onChanged: (val) => _save(context, ref, p, email: val)),
              ]),
            ),
        ]),
      ),
    );
  }

  Future<void> _save(BuildContext context, WidgetRef ref, Json p, {bool? inApp, bool? email}) async {
    try {
      await ref.read(apiClientProvider).put('/notification-preferences/${p.s('type')}', {'inApp': inApp ?? p.b('inApp'), 'email': email ?? p.b('email'), 'sms': p.b('sms'), 'whatsapp': p.b('whatsapp')});
      ref.invalidate(preferencesProvider);
    } on ApiException catch (e) {
      if (context.mounted) showSnack(context, e.message, error: true);
    }
  }
}

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meId = ref.watch(authControllerProvider).user?.id;
    return PageScaffold(
      title: 'Messages',
      body: CachedListView(
        value: ref.watch(conversationsListProvider),
        onRefresh: () => ref.refresh(conversationsListProvider.future),
        builder: (raw) {
          final list = asJsonList(raw);
          if (list.isEmpty) return [const EmptyView(icon: Icons.chat_bubble_outline, title: 'No messages yet', message: 'Conversations start from marketplace orders.')];
          return [
            for (final c in list)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(backgroundColor: AppColors.coralSoft, child: Icon(c.b('unread') ? Icons.mark_chat_unread_outlined : Icons.chat_bubble_outline, color: AppColors.ink)),
                title: Text(c.s('subject', c.l('participants').where((p) => p.m('user').s('id') != meId).map((p) => p.m('user').m('profile').s('fullName')).join(', ')), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: c.b('unread') ? FontWeight.w800 : FontWeight.w600)),
                subtitle: Text(c.l('messages').isNotEmpty ? c.l('messages').first.s('body') : '', maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Text(relative(c.d('updatedAt')), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                onTap: () => context.push('/conversations/${c.s('id')}'),
              ),
          ];
        },
      ),
    );
  }
}

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _text = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final t = _text.text.trim();
    if (t.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiClientProvider).post('/messages', {'conversationId': widget.id, 'body': t});
      _text.clear();
      ref.invalidate(conversationProvider(widget.id));
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = ref.watch(conversationProvider(widget.id));
    final myId = ref.watch(authControllerProvider).user?.id;
    final conv = asJson(v.value?.data);
    return Scaffold(
      appBar: AppBar(
        title: Text(conv.mn('order') != null ? 'Order ${conv.m('order').s('orderNumber')}' : conv.s('subject', 'Messages')),
        actions: [if (conv.mn('order') != null) IconButton(tooltip: 'Open order', onPressed: () => context.push('/orders/${conv.m('order').s('id')}'), icon: const Icon(Icons.receipt_long_outlined))],
      ),
      body: Column(children: [
        Expanded(
          child: CachedListView(
            value: v,
            onRefresh: () => ref.refresh(conversationProvider(widget.id).future),
            builder: (raw) => [
              for (final m in asJson(raw).l('messages'))
                Align(
                  alignment: m.m('sender').s('id') == myId ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: m.m('sender').s('id') == myId ? AppColors.ink : AppColors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.ink, width: 1.1),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (m.m('sender').s('id') != myId) Text(m.m('sender').m('profile').s('fullName'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
                      Text(m.s('body'), style: TextStyle(color: m.m('sender').s('id') == myId ? AppColors.white : AppColors.ink)),
                      Text(dateTimeFmt(m.d('createdAt')), style: TextStyle(fontSize: 11, color: m.m('sender').s('id') == myId ? AppColors.divider : AppColors.muted)),
                    ]),
                  ),
                ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(children: [
              Expanded(child: TextField(controller: _text, minLines: 1, maxLines: 4, decoration: const InputDecoration(hintText: 'Write a message'))),
              const SizedBox(width: 8),
              SizedBox(width: 56, child: PrimaryButton(label: '', icon: Icons.send_rounded, loading: _sending, onPressed: _send)),
            ]),
          ),
        ),
      ]),
    );
  }
}

