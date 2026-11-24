import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/services/cache_store.dart';
import '../../core/services/data.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/logo.dart';
import '../../core/widgets/states.dart';
import '../farm_management/farm_providers.dart';

final aiStatusProvider = FutureProvider<bool>((ref) async => asJson(await userApi(ref).get('/ai/status')).b('configured'));
final conversationsProvider = FutureProvider<Cached<dynamic>>((ref) => cachedGet(ref, '/ai/conversations'));

const greeting = "Hello! I'm AgriFlow AI, your intelligent agricultural assistant. How can I help improve your farming today?";

const suggestedQuestions = [
  'When should I plant maize in my district this season?',
  'How much basal and top-dressing fertiliser does maize need per hectare?',
  'How do I control fall armyworm without harming beneficial insects?',
  'What is a good crop rotation after soybeans?',
  'How should I store harvested maize to avoid weevils and aflatoxin?',
  'Is growing groundnuts profitable compared with soybeans?',
];

class _Msg {
  _Msg({required this.role, required this.text, this.meta = const {}, this.id, this.pending = false, this.error});
  final String role; // USER | ASSISTANT
  final String text;
  final Json meta;
  final String? id;
  final bool pending;
  final String? error;
}

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key, this.conversationId});
  final String? conversationId;
  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _speech = SpeechToText();
  bool _speechReady = false;
  bool _listening = false;
  String? _conversationId;
  final List<_Msg> _msgs = [];
  bool _sending = false;
  bool _loadingHistory = false;
  bool _fromCache = false;

  @override
  void initState() {
    super.initState();
    _conversationId = widget.conversationId;
    if (_conversationId != null) _open(_conversationId!);
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    _speech.stop();
    super.dispose();
  }

  Future<void> _open(String id) async {
    setState(() {
      _loadingHistory = true;
      _conversationId = id;
      _msgs.clear();
    });
    try {
      final c = await fetchCached(ref.read(apiClientProvider), ref.read(cacheStoreProvider), '/ai/conversations/$id');
      final conv = asJson(c.data);
      setState(() {
        _fromCache = c.fromCache;
        for (final m in conv.l('messages')) {
          _msgs.add(_Msg(role: m.s('role'), text: m.s('content'), meta: m.m('meta'), id: m.s('id')));
        }
      });
      _toBottom();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  void _new() => setState(() {
        _conversationId = null;
        _msgs.clear();
        _fromCache = false;
      });

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent + 200, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      });

  Future<void> _send([String? text]) async {
    final q = (text ?? _input.text).trim();
    if (q.isEmpty || _sending) return;
    if (!(ref.read(onlineProvider).value ?? true)) {
      showSnack(context, 'AgriFlow AI needs an internet connection. Your saved conversations are still readable.', error: true);
      return;
    }
    _input.clear();
    setState(() {
      _sending = true;
      _msgs.add(_Msg(role: 'USER', text: q));
      _msgs.add(_Msg(role: 'ASSISTANT', text: '', pending: true));
    });
    _toBottom();
    try {
      final r = asJson(await ref.read(apiClientProvider).post('/ai/chat', {'message': q, 'conversationId': _conversationId}..removeWhere((k, v) => v == null)));
      final answer = r.m('answer');
      setState(() {
        _conversationId = r.s('conversationId');
        _msgs.removeLast();
        _msgs.add(_Msg(role: 'ASSISTANT', text: answer.s('answer'), id: r.s('messageId'), meta: {...answer, 'mode': r.s('mode'), 'notice': r.sn('notice')}));
      });
      ref.invalidate(conversationsProvider);
    } on ApiException catch (e) {
      setState(() {
        _msgs.removeLast();
        _msgs.add(_Msg(role: 'ASSISTANT', text: '', error: e.message));
      });
    } finally {
      if (mounted) setState(() => _sending = false);
      _toBottom();
    }
  }

  /// Ask the last question again (the server keeps both answers in history).
  void _regenerate() {
    final lastUser = _msgs.lastWhere((m) => m.role == 'USER', orElse: () => _Msg(role: 'USER', text: ''));
    if (lastUser.text.isNotEmpty) _send(lastUser.text);
  }

  Future<void> _mic() async {
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
      return;
    }
    if (!_speechReady) {
      _speechReady = await _speech.initialize(onStatus: (s) {
        if (s == 'done' || s == 'notListening') {
          if (mounted) setState(() => _listening = false);
        }
      });
      if (!_speechReady) {
        if (mounted) showSnack(context, 'Voice input is not available on this phone (or microphone permission was refused).', error: true);
        return;
      }
    }
    setState(() => _listening = true);
    await _speech.listen(
      onResult: (SpeechRecognitionResult r) => setState(() => _input.text = r.recognizedWords),
      listenOptions: SpeechListenOptions(partialResults: true, cancelOnError: true),
    );
  }

  void _history() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => Consumer(builder: (c, ref, _) {
        final v = ref.watch(conversationsProvider);
        return SizedBox(
          height: MediaQuery.of(c).size.height * 0.7,
          child: v.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(conversationsProvider)),
            data: (cached) {
              final list = asJsonList(cached.data);
              if (list.isEmpty) return const EmptyView(icon: Icons.forum_outlined, title: 'No conversations yet');
              return ListView(padding: const EdgeInsets.symmetric(horizontal: 12), children: [
                if (cached.fromCache) CachedBanner(savedAt: cached.savedAt),
                for (final conv in list)
                  ListTile(
                    leading: const Icon(Icons.chat_bubble_outline),
                    title: Text(conv.s('title', 'Conversation'), maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(relative(conv.d('updatedAt'))),
                    onTap: () {
                      Navigator.pop(c);
                      _open(conv.s('id'));
                    },
                    trailing: IconButton(
                      tooltip: 'Delete conversation',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        if (!await confirmDialog(c, title: 'Delete conversation?', message: 'This permanently deletes the messages.', confirm: 'Delete', destructive: true)) return;
                        try {
                          await ref.read(apiClientProvider).delete('/ai/conversations/${conv.s('id')}');
                          ref.invalidate(conversationsProvider);
                          if (_conversationId == conv.s('id')) _new();
                        } on ApiException catch (e) {
                          if (c.mounted) showSnack(c, e.message, error: true);
                        }
                      },
                    ),
                  ),
              ]);
            },
          ),
        );
      }),
    );
  }

  Future<void> _addTask(String messageId, int index, Json task) async {
    final farms = asJsonList(ref.read(farmsProvider).value?.data);
    try {
      await ref.read(apiClientProvider).post('/ai/messages/$messageId/suggested-tasks/$index', {if (farms.length == 1) 'farmId': farms.first.s('id')});
      ref.invalidate(tasksProvider);
      if (mounted) showSnack(context, 'Added to your tasks: ${task.s('title')}');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(children: [AppLogo(height: 28), SizedBox(width: 10), Text('AgriFlow AI')]),
        actions: [
          IconButton(tooltip: 'Conversation history', onPressed: _history, icon: const Icon(Icons.history)),
          IconButton(tooltip: 'New conversation', onPressed: _new, icon: const Icon(Icons.add_comment_outlined)),
        ],
      ),
      body: Column(children: [
        if (_fromCache) const Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text('Saved copy of this conversation (offline).', style: TextStyle(color: AppColors.amber, fontWeight: FontWeight.w700))),
        Expanded(
          child: _loadingHistory
              ? const LoadingView()
              : ListView(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  children: [
                    if (_msgs.isEmpty) ...[
                      const _Bubble(role: 'ASSISTANT', child: Text(greeting, style: TextStyle(fontSize: 15.5, height: 1.45))),
                      const SizedBox(height: 14),
                      const Text('Try asking', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      Wrap(spacing: 8, runSpacing: 8, children: [for (final q in suggestedQuestions) ActionChip(label: Text(q), onPressed: () => _send(q))]),
                      const SizedBox(height: 14),
                      AppCard(
                        shadow: false,
                        color: AppColors.leafSoft,
                        onTap: () => context.push('/crop-health/new'),
                        padding: const EdgeInsets.all(12),
                        child: const Row(children: [
                          Icon(Icons.photo_camera_outlined),
                          SizedBox(width: 10),
                          Expanded(child: Text('Have a sick plant? Take a photo for a crop-health check.', style: TextStyle(fontWeight: FontWeight.w700))),
                          Icon(Icons.chevron_right),
                        ]),
                      ),
                    ],
                    for (var i = 0; i < _msgs.length; i++) _buildMsg(_msgs[i], i == _msgs.length - 1),
                  ],
                ),
        ),
        _composer(),
      ]),
    );
  }

  Widget _buildMsg(_Msg m, bool isLast) {
    if (m.role == 'USER') return _Bubble(role: 'USER', child: Text(m.text, style: const TextStyle(color: AppColors.white, fontSize: 15.5, height: 1.4)));
    if (m.pending) return const _Bubble(role: 'ASSISTANT', child: _Typing());
    if (m.error != null) {
      return _Bubble(
        role: 'ASSISTANT',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(m.error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
          TextButton.icon(onPressed: _regenerate, icon: const Icon(Icons.refresh), label: const Text('Try again')),
        ]),
      );
    }
    final mode = m.meta.s('mode', 'grok');
    final tasks = m.meta.l('suggested_tasks');
    return _Bubble(
      role: 'ASSISTANT',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        MarkdownBody(
          data: m.text,
          selectable: true,
          styleSheet: MarkdownStyleSheet(p: const TextStyle(fontFamily: kFont, fontSize: 15.5, height: 1.45, color: AppColors.ink), strong: const TextStyle(fontWeight: FontWeight.w800)),
        ),
        if (m.meta.sn('clarifying_question') != null) ...[const SizedBox(height: 8), Text('❓ ${m.meta.s('clarifying_question')}', style: const TextStyle(fontWeight: FontWeight.w700))],
        if (m.meta.sn('uncertainty_note') != null) ...[const SizedBox(height: 8), Text(m.meta.s('uncertainty_note'), style: const TextStyle(fontSize: 12.5, color: AppColors.muted))],
        for (var i = 0; i < tasks.length; i++)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: OutlinedButton.icon(
              onPressed: m.id == null ? null : () => _addTask(m.id!, i, tasks[i]),
              icon: const Icon(Icons.add_task, size: 18),
              label: Text('Add task: ${tasks[i].s('title')} (in ${tasks[i].n('due_in_days').toInt()} days)', maxLines: 2),
            ),
          ),
        const SizedBox(height: 6),
        Row(children: [
          Pill(mode == 'grok' ? 'AgriFlow AI' : 'Built-in guidance', color: mode == 'grok' ? AppColors.coralSoft : AppColors.amberSoft, icon: mode == 'grok' ? Icons.auto_awesome : Icons.menu_book_outlined),
          if (m.meta.b('used_farm_data')) const Padding(padding: EdgeInsets.only(left: 6), child: Pill('Used your farm records', icon: Icons.agriculture_outlined)),
          const Spacer(),
          IconButton(
            tooltip: 'Copy',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.copy, size: 18),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: m.text));
              showSnack(context, 'Copied.');
            },
          ),
          if (isLast) IconButton(tooltip: 'Regenerate', visualDensity: VisualDensity.compact, icon: const Icon(Icons.refresh, size: 18), onPressed: _sending ? null : _regenerate),
        ]),
      ]),
    );
  }

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
        decoration: const BoxDecoration(color: AppColors.background, border: Border(top: BorderSide(color: AppColors.divider))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          IconButton(tooltip: 'Attach a crop photo', onPressed: () => context.push('/crop-health/new'), icon: const Icon(Icons.add_photo_alternate_outlined)),
          Expanded(
            child: TextField(
              controller: _input,
              minLines: 1,
              maxLines: 5,
              maxLength: 2000,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: _listening ? 'Listening…' : 'Ask about crops, soil, pests, prices…',
                counterText: '',
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                suffixIcon: IconButton(
                  tooltip: _listening ? 'Stop voice input' : 'Voice input',
                  onPressed: _mic,
                  icon: Icon(_listening ? Icons.stop_circle_outlined : Icons.mic_none, color: _listening ? AppColors.coral : AppColors.muted),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: 'Send',
            child: InkWell(
              onTap: _sending ? null : () => _send(),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(color: AppColors.coral, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.ink, width: 1.4), boxShadow: hardShadow(2, 2)),
                child: _sending
                    ? const Padding(padding: EdgeInsets.all(14), child: CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.white))
                    : const Icon(Icons.send_rounded, color: AppColors.white),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.role, required this.child});
  final String role;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final me = role == 'USER';
    return Align(
      alignment: me ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.86),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: me ? AppColors.ink : AppColors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(me ? 16 : 4),
            bottomRight: Radius.circular(me ? 4 : 16),
          ),
          border: Border.all(color: AppColors.ink, width: 1.2),
        ),
        child: child,
      ),
    );
  }
}

class _Typing extends StatefulWidget {
  const _Typing();
  @override
  State<_Typing> createState() => _TypingState();
}

class _TypingState extends State<_Typing> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'AgriFlow AI is typing',
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, _) => Row(mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < 3; i++)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.coral.withValues(alpha: 0.3 + 0.7 * (((_c.value * 3) - i) % 3 < 1 ? 1 : 0)),
                  shape: BoxShape.circle,
                ),
              ),
            const SizedBox(width: 8),
            const Text('Thinking…', style: TextStyle(color: AppColors.muted)),
          ]),
        ),
      );
}

/// AI advice for one crop record ("Ask AgriFlow AI about this crop").
final cropAdviceProvider = FutureProvider.family<Json, String>((ref, id) async => asJson(await userApi(ref).post('/crop-records/$id/advice')));

class CropAdviceScreen extends ConsumerWidget {
  const CropAdviceScreen({super.key, required this.cropRecordId, this.title});
  final String cropRecordId;
  final String? title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(cropAdviceProvider(cropRecordId));
    return Scaffold(
      appBar: AppBar(title: Text(title ?? 'Crop advice')),
      body: v.when(
        loading: () => const LoadingView(message: 'AgriFlow AI is reviewing your crop, records and forecast…'),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(cropAdviceProvider(cropRecordId))),
        data: (r) {
          final a = r.mn('advice');
          if (a == null) {
            return EmptyView(icon: Icons.cloud_off_outlined, title: 'Advice unavailable', message: r.s('notice', 'AI advice is not available right now.'), actionLabel: 'Try again', onAction: () => ref.invalidate(cropAdviceProvider(cropRecordId)));
          }
          return ListView(padding: const EdgeInsets.all(20), children: [
            AppCard(child: Text(a.s('summary'), style: const TextStyle(fontSize: 15.5, height: 1.45))),
            const SectionHeader('Recommendations'),
            for (final rec in a.l('recommendations'))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  shadow: false,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(rec.s('title'), style: const TextStyle(fontWeight: FontWeight.w800))),
                      Pill(labelize(rec.s('priority')), color: rec.s('priority') == 'HIGH' ? AppColors.dangerSoft : AppColors.surfaceAlt),
                    ]),
                    const SizedBox(height: 6),
                    Text(rec.s('detail')),
                    const SizedBox(height: 4),
                    Text('When: ${rec.s('timing')}', style: const TextStyle(color: AppColors.muted, fontSize: 13)),
                  ]),
                ),
              ),
            if (a.ls('weather_considerations').isNotEmpty) ...[
              const SectionHeader('Weather'),
              for (final w in a.ls('weather_considerations')) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('• $w')),
            ],
            if (a.sn('uncertainty_note') != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(a.s('uncertainty_note'), style: const TextStyle(color: AppColors.muted, fontSize: 13))),
            const SizedBox(height: 8),
            const Text('AI-generated advice. Check product labels and ask your extension officer when unsure.', style: TextStyle(color: AppColors.muted, fontSize: 12)),
          ]);
        },
      ),
    );
  }
}
