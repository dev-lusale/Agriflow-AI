import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/states.dart';
import '../marketplace/market_widgets.dart';

final expertStatusProvider = FutureProvider<Json>((ref) async => asJson(await ref.watch(apiClientProvider).get('/expert/status')));
final expertCasesProvider = FutureProvider<Json>((ref) async => asJson(await ref.watch(apiClientProvider).get('/expert/cases')));

class ExpertCasesScreen extends ConsumerWidget {
  const ExpertCasesScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(expertStatusProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Crop-health cases'),
          automaticallyImplyLeading: !embedded,
          bottom: status.value?.b('verified') == true ? const TabBar(tabs: [Tab(text: 'Open'), Tab(text: 'Answered by me')]) : null,
        ),
        body: status.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(expertStatusProvider)),
          data: (s) {
            if (!s.b('verified')) {
              return const EmptyView(
                icon: Icons.hourglass_top,
                title: 'Waiting for verification',
                message: "An AgriFlow administrator must verify your expert account before farmers' cases are shown to you. This protects farmers' data.",
              );
            }
            final cases = ref.watch(expertCasesProvider);
            return cases.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(expertCasesProvider)),
              data: (d) => TabBarView(children: [
                _list(context, ref, d.l('open'), true),
                _list(context, ref, d.l('answered'), false),
              ]),
            );
          },
        ),
      ),
    );
  }

  Widget _list(BuildContext context, WidgetRef ref, List<Json> list, bool open) {
    if (list.isEmpty) return EmptyView(icon: Icons.task_alt, title: open ? 'No cases waiting' : 'No answered cases yet');
    return RefreshIndicator(
      onRefresh: () => ref.refresh(expertCasesProvider.future),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        for (final c in list)
          AppCard(
            margin: const EdgeInsets.only(bottom: 14),
            padding: EdgeInsets.zero,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (c.sn('imageId') != null) UploadImage(uploadId: c.s('imageId'), height: 190),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${c.m('crop').s('name')}${c.sn('possibleIssue') != null ? ' · AI: ${c.s('possibleIssue')}' : ''}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  Text('${c.m('farm').sn('district') ?? 'District not given'} · ${relative(c.d('reviewRequestedAt') ?? c.d('createdAt'))}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                  const SizedBox(height: 8),
                  Text(c.s('symptoms')),
                  for (final p in c.m('result').l('possible_causes')) Text('• ${p.s('name')} (${labelize(p.s('likelihood'))})', style: const TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 10),
                  if (open)
                    PrimaryButton(label: 'Write second opinion', onPressed: () => _answer(context, ref, c))
                  else if (c.sn('expertNote') != null)
                    AppCard(color: AppColors.leafSoft, shadow: false, child: Text(c.s('expertNote'))),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }

  Future<void> _answer(BuildContext context, WidgetRef ref, Json c) async {
    final note = TextEditingController();
    String? error;
    bool busy = false;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (s) => StatefulBuilder(
        builder: (s, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(s).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Second opinion: ${c.m('crop').s('name')}', style: Theme.of(s).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(error!, style: const TextStyle(color: AppColors.danger))),
            AppTextField(label: 'Your assessment', controller: note, maxLines: 6, hint: 'What you think it is, how confident you are, and what the farmer should do next.'),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Send to farmer',
              loading: busy,
              onPressed: () async {
                set(() => busy = true);
                try {
                  await ref.read(apiClientProvider).post('/expert/cases/${c.s('id')}/review', {'note': note.text.trim()});
                  ref.invalidate(expertCasesProvider);
                  if (s.mounted) Navigator.pop(s);
                  if (context.mounted) showSnack(context, 'Sent. The farmer has been notified.');
                } on ApiException catch (e) {
                  set(() => error = e.field('note') ?? e.message);
                } finally {
                  set(() => busy = false);
                }
              },
            ),
          ]),
        ),
      ),
    );
  }
}
