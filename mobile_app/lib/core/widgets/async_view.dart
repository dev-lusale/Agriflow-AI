import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../services/cache_store.dart';
import 'cards.dart';
import 'states.dart';

/// Standard list screen body: loading, error with retry, pull to refresh, and a clear
/// "offline copy" banner when the data came from this phone's cache.
class CachedListView extends StatelessWidget {
  const CachedListView({super.key, required this.value, required this.onRefresh, required this.builder, this.padding = const EdgeInsets.fromLTRB(20, 8, 20, 32)});
  final AsyncValue<Cached<dynamic>> value;
  final Future<void> Function() onRefresh;
  final List<Widget> Function(dynamic data) builder;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(error: e, onRetry: onRefresh),
      data: (c) => RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: padding,
          children: [
            if (c.fromCache) CachedBanner(savedAt: c.savedAt, onRetry: onRefresh),
            ...builder(c.data),
          ],
        ),
      ),
    );
  }
}

/// AppBar-style page scaffold used for pushed screens.
class PageScaffold extends StatelessWidget {
  const PageScaffold({super.key, required this.title, required this.body, this.actions, this.fab});
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? fab;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title), actions: actions),
        body: body,
        floatingActionButton: fab,
      );
}
