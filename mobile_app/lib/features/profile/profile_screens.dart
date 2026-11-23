import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/env.dart';
import '../../core/networking/api_exception.dart';
import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/json.dart';
import '../../core/widgets/buttons.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/inputs.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../authentication/application/auth_controller.dart';
import '../authentication/presentation/auth_common.dart';

final appVersionProvider = FutureProvider<String>((ref) async {
  final i = await PackageInfo.fromPlatform();
  return '${i.version} (${i.buildNumber})';
});

/// Language preference kept on the phone. Only English is complete today; the app is
/// structured so Bemba, Nyanja, Tonga and Lozi translations can be added.
const languages = {'en': 'English', 'bem': 'Icibemba (coming soon)', 'nya': 'Chinyanja (coming soon)', 'toi': 'Chitonga (coming soon)', 'loz': 'Silozi (coming soon)'};

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _uploading = false;

  Future<void> _photo() async {
    final p = await pickPhoto(context);
    if (p == null) return;
    setState(() => _uploading = true);
    try {
      await ref.read(apiClientProvider).multipart('/me/avatar', FormData.fromMap({'image': await photoPart(p)}));
      await ref.read(authControllerProvider.notifier).refreshMe();
      if (mounted) showSnack(context, 'Profile photo updated.');
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _open(String path) => launchUrl(Uri.parse('${Env.websiteUrl}$path'), mode: LaunchMode.externalApplication);

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final u = auth.user!;
    final api = ref.read(apiClientProvider);
    final queue = ref.watch(syncQueueProvider);
    final lang = ref.read(prefsProvider).getString('language') ?? 'en';
    Widget tile(IconData i, String t, VoidCallback onTap, {String? sub, Widget? trailing}) => ListTile(
          leading: Icon(i, color: AppColors.ink),
          title: Text(t, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: sub == null ? null : Text(sub),
          trailing: trailing ?? const Icon(Icons.chevron_right),
          onTap: onTap,
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 32), children: [
        Center(
          child: Stack(children: [
            CircleAvatar(
              radius: 48,
              backgroundColor: AppColors.coralSoft,
              backgroundImage: u.avatarUrl == null ? null : CachedNetworkImageProvider('${api.serverUrl}${u.avatarUrl}', headers: api.authHeaders),
              child: u.avatarUrl == null ? Text(initials(u.fullName), style: const TextStyle(fontFamily: kFont, fontSize: 30, fontWeight: FontWeight.w800, color: AppColors.ink)) : null,
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: InkWell(
                onTap: _uploading ? null : _photo,
                child: CircleAvatar(
                  radius: 17,
                  backgroundColor: AppColors.coral,
                  child: _uploading ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.white)) : const Icon(Icons.photo_camera, size: 17, color: AppColors.white),
                ),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Text(u.fullName, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
        Text(u.email, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 8),
        Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
          Pill(u.roleLabel, color: AppColors.coralSoft),
          Pill(u.emailVerified ? 'Email verified' : 'Email not verified', color: u.emailVerified ? AppColors.leafSoft : AppColors.amberSoft),
          if (u.adminVerified) const Pill('Verified by AgriFlow', color: AppColors.leafSoft, icon: Icons.verified),
          if (auth.offline) const Pill('Offline', color: AppColors.amberSoft),
        ]),
        const SizedBox(height: 18),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            tile(Icons.person_outline, 'Personal details', () => context.push('/profile/edit'), sub: [u.phone, if (u.district != null) '${u.district}, ${labelize(u.province)}'].whereType<String>().join(' · ')),
            if (!u.emailVerified) tile(Icons.mark_email_unread_outlined, 'Verify email', () => context.push('/verify-email')),
            if (u.isFarmer) tile(Icons.agriculture_outlined, 'My farms', () => context.go('/farm')),
            tile(Icons.notifications_outlined, 'Notification settings', () => context.push('/notification-settings')),
            tile(Icons.translate, 'Language', () => _language(context), sub: languages[lang]),
            tile(Icons.lock_outline, 'Change password', () => context.push('/profile/password')),
            tile(Icons.cloud_sync_outlined, 'Offline records', () => context.push('/sync'), sub: queue.pendingCount + queue.problemCount == 0 ? 'Everything is synced' : '${queue.pendingCount} waiting · ${queue.problemCount} need attention'),
          ]),
        ),
        const SizedBox(height: 14),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(children: [
            tile(Icons.help_outline, 'Help and support', () => _open('/contact')),
            tile(Icons.privacy_tip_outlined, 'Privacy policy', () => _open('/privacy')),
            tile(Icons.description_outlined, 'Terms and conditions', () => _open('/terms')),
            tile(Icons.info_outline, 'About AgriFlow AI', () => _open('/about'), sub: 'Version ${ref.watch(appVersionProvider).value ?? '…'}'),
          ]),
        ),
        const SizedBox(height: 20),
        SecondaryButton(
          label: 'Log out',
          icon: Icons.logout,
          onPressed: () async {
            if (await confirmDialog(context, title: 'Log out?', message: queue.pendingCount > 0 ? 'You have ${queue.pendingCount} offline record(s) not yet synced. They stay on this phone and sync after you log in again.' : 'You can log back in any time.', confirm: 'Log out')) {
              await ref.read(authControllerProvider.notifier).logout();
            }
          },
        ),
        const SizedBox(height: 8),
        Center(
          child: TextButton(
            onPressed: () async {
              if (await confirmDialog(context, title: 'Log out on all devices?', message: 'Every phone and browser signed in to your account will be signed out.', confirm: 'Log out everywhere', destructive: true)) {
                await ref.read(authControllerProvider.notifier).logout(everywhere: true);
              }
            },
            child: const Text('Log out on all devices'),
          ),
        ),
      ]),
    );
  }

  Future<void> _language(BuildContext context) async {
    final prefs = ref.read(prefsProvider);
    final chosen = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final l in languages.entries)
            ListTile(
              title: Text(l.value),
              enabled: l.key == 'en',
              trailing: (prefs.getString('language') ?? 'en') == l.key ? const Icon(Icons.check, color: AppColors.coral) : null,
              onTap: () => Navigator.pop(c, l.key),
            ),
          const Padding(padding: EdgeInsets.all(16), child: Text('Zambian language translations are being prepared. AgriFlow AI can already answer questions asked in Bemba or Nyanja.', style: TextStyle(color: AppColors.muted))),
        ]),
      ),
    );
    if (chosen != null) {
      await prefs.setString('language', chosen);
      setState(() {});
    }
  }
}

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});
  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late final u = ref.read(authControllerProvider).user!;
  late final _name = TextEditingController(text: u.fullName);
  late final _phone = TextEditingController(text: u.phone ?? '');
  late String? _province = u.province;
  late String? _district = u.district;
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    try {
      await ref.read(authRepositoryProvider).updateProfile({
        'fullName': _name.text.trim(),
        if (_phone.text.trim().isNotEmpty && _phone.text.trim() != u.phone) 'phone': _phone.text.trim(),
        'province': ?_province,
        'district': ?_district,
      });
      await ref.read(authControllerProvider.notifier).refreshMe();
      if (mounted) {
        showSnack(context, 'Profile saved.');
        context.pop();
      }
    } on ApiException catch (e) {
      setState(() {
        _fe = e;
        _error = e.message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provinces = ref.watch(regionsProvider).value?.l('provinces') ?? const <Json>[];
    final districts = provinces.firstWhere((p) => p.s('value') == _province, orElse: () => <String, dynamic>{}).ls('districts');
    return Scaffold(
      appBar: AppBar(title: const Text('Personal details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          FormErrorBox(_error),
          AppTextField(label: 'Full name', controller: _name, textCapitalization: TextCapitalization.words, errorText: _fe?.field('fullName')),
          const SizedBox(height: 16),
          AppTextField(label: 'Phone number', controller: _phone, keyboardType: TextInputType.phone, errorText: _fe?.field('phone')),
          const SizedBox(height: 16),
          AppDropdown<String>(
            label: 'Province',
            value: _province,
            items: [for (final p in provinces) DropdownMenuItem(value: p.s('value'), child: Text(p.s('label')))],
            onChanged: (v) => setState(() {
              _province = v;
              _district = null;
            }),
          ),
          const SizedBox(height: 16),
          AppDropdown<String>(
            label: 'District',
            value: districts.contains(_district) ? _district : null,
            hint: 'Select district',
            items: [for (final d in districts) DropdownMenuItem(value: d, child: Text(d))],
            onChanged: (v) => setState(() => _district = v),
            errorText: _fe?.field('district'),
          ),
          const SizedBox(height: 16),
          AppTextField(label: 'Email', initialValue: u.email, enabled: false, helper: 'Contact support to change your email address.'),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Save', loading: _busy, onPressed: _save),
        ]),
      ),
    );
  }
}

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;
  ApiException? _fe;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _fe = null;
    });
    try {
      await ref.read(authRepositoryProvider).changePassword({'currentPassword': _current.text, 'newPassword': _new.text, 'confirmPassword': _confirm.text});
      if (mounted) {
        showSnack(context, 'Password changed. Website sessions were signed out.');
        context.pop();
      }
    } on ApiException catch (e) {
      setState(() {
        _fe = e;
        _error = e.field('currentPassword') ?? e.message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change password')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FormErrorBox(_error),
            AppTextField(label: 'Current password', controller: _current, obscure: true, validator: (v) => (v ?? '').isEmpty ? 'Enter your current password' : null),
            const SizedBox(height: 16),
            StatefulBuilder(builder: (c, set) {
              return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                AppTextField(label: 'New password', controller: _new, obscure: true, validator: validatePassword, onChanged: (_) => set(() {}), errorText: _fe?.field('newPassword')),
                PasswordStrengthMeter(password: _new.text),
              ]);
            }),
            const SizedBox(height: 16),
            AppTextField(label: 'Confirm new password', controller: _confirm, obscure: true, validator: (v) => v != _new.text ? 'Passwords do not match' : null),
            const SizedBox(height: 24),
            PrimaryButton(label: 'Change password', loading: _busy, onPressed: _save),
          ]),
        ),
      ),
    );
  }
}

class SyncQueueScreen extends ConsumerWidget {
  const SyncQueueScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = ref.watch(syncQueueProvider);
    return ListenableBuilder(
      listenable: q,
      builder: (context, _) {
        final ops = q.ops;
        return Scaffold(
          appBar: AppBar(title: const Text('Offline records')),
          body: ListView(padding: const EdgeInsets.all(20), children: [
            const Text('Farm activities, tasks and notes you record without a connection are kept here and sent automatically when you are back online.', style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 12),
            if (q.lastSyncAt != null) Text('Last sync: ${dateTimeFmt(q.lastSyncAt)}', style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            PrimaryButton(
              label: 'Sync now',
              icon: Icons.sync,
              onPressed: ops.isEmpty
                  ? null
                  : () async {
                      final n = await q.flush(ref.read(apiClientProvider));
                      if (context.mounted) showSnack(context, n > 0 ? '$n record(s) synced.' : 'Nothing could be synced yet. Check your connection.');
                    },
            ),
            const SizedBox(height: 16),
            if (ops.isEmpty) const EmptyView(icon: Icons.cloud_done_outlined, title: 'Everything is synced'),
            for (final o in ops)
              AppCard(
                margin: const EdgeInsets.only(bottom: 10),
                shadow: false,
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(o.label.isEmpty ? labelize(o.kind.replaceAll('.', '_')) : o.label, style: const TextStyle(fontWeight: FontWeight.w800))),
                    Pill(o.status == 'pending' ? 'Waiting' : o.status == 'conflict' ? 'Conflict' : 'Failed', color: o.status == 'pending' ? AppColors.skySoft : AppColors.dangerSoft),
                  ]),
                  Text('Saved ${dateTimeFmt(o.createdAt)}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                  if (o.error != null) Text(o.error!, style: const TextStyle(color: AppColors.danger)),
                  if (o.status != 'pending')
                    Row(children: [
                      TextButton(onPressed: () => q.retry(o.opId), child: const Text('Try again')),
                      TextButton(
                        onPressed: () async {
                          if (await confirmDialog(context, title: 'Discard this record?', message: 'It has not been saved on the server and will be lost.', confirm: 'Discard', destructive: true)) {
                            await q.remove(o.opId);
                          }
                        },
                        child: const Text('Discard'),
                      ),
                    ]),
                ]),
              ),
          ]),
        );
      },
    );
  }
}
