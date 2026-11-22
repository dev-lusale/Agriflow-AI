import 'package:material_ui/material_ui.dart';

import '../networking/api_exception.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import 'buttons.dart';

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message});
  final String? message;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const CircularProgressIndicator(),
            if (message != null) ...[const SizedBox(height: 14), Text(message!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted))],
          ]),
        ),
      );
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.icon, required this.title, this.message, this.actionLabel, this.onAction});
  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: AppColors.coralSoft, shape: BoxShape.circle, border: Border.all(color: AppColors.ink, width: 1.3)),
              child: Icon(icon, size: 30, color: AppColors.ink),
            ),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            if (message != null) ...[const SizedBox(height: 6), Text(message!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, height: 1.45))],
            if (actionLabel != null && onAction != null) ...[const SizedBox(height: 20), PrimaryButton(label: actionLabel!, onPressed: onAction, expand: false)],
          ]),
        ),
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final e = ApiException.from(error);
    final offline = e.isNetwork;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded, size: 42, color: offline ? AppColors.amber : AppColors.danger),
          const SizedBox(height: 12),
          Text(offline ? "You're offline" : 'Something went wrong', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(e.message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontFamily: kFont)),
          if (onRetry != null) ...[const SizedBox(height: 18), SecondaryButton(label: 'Try again', icon: Icons.refresh, onPressed: onRetry, expand: false)],
        ]),
      ),
    );
  }
}

void showSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? AppColors.danger : AppColors.ink));
}

Future<bool> confirmDialog(BuildContext context, {required String title, required String message, String confirm = 'Confirm', bool destructive = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      backgroundColor: AppColors.background,
      title: Text(title, style: Theme.of(c).textTheme.titleLarge),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(c, true),
          style: TextButton.styleFrom(foregroundColor: destructive ? AppColors.danger : AppColors.coral),
          child: Text(confirm, style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    ),
  );
  return r == true;
}
