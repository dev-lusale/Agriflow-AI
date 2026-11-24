import 'package:material_ui/material_ui.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// White card with the black outline and a small offset shadow.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color = AppColors.white, this.shadow = true, this.margin});
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color color;
  final bool shadow;
  final EdgeInsets? margin;

  @override
  Widget build(BuildContext context) {
    final box = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.ink, width: 1.3),
        boxShadow: shadow ? hardShadow(2, 3) : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
    return box;
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 22, 0, 10),
        child: Row(
          children: [
            Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
            if (action != null && onAction != null)
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(foregroundColor: AppColors.coral, textStyle: const TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800)),
                child: Text(action!),
              ),
          ],
        ),
      );
}

/// Small rounded status pill.
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color = AppColors.surfaceAlt, this.textColor = AppColors.ink, this.icon});
  final String text;
  final Color color;
  final Color textColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 14, color: textColor), const SizedBox(width: 4)],
          Text(text, style: TextStyle(fontFamily: kFont, fontSize: 12, fontWeight: FontWeight.w700, color: textColor)),
        ]),
      );
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.icon, this.tint = AppColors.coralSoft});
  final String label;
  final String value;
  final IconData? icon;
  final Color tint;

  @override
  Widget build(BuildContext context) => AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (icon != null)
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: AppColors.ink),
            ),
          if (icon != null) const SizedBox(height: 10),
          Text(value, style: const TextStyle(fontFamily: kFont, fontSize: 20, fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontFamily: kFont, fontSize: 12.5, color: AppColors.muted, fontWeight: FontWeight.w600), maxLines: 2),
        ]),
      );
}

/// "Saved on this phone" banner, so cached data is never mistaken for live data.
class CachedBanner extends StatelessWidget {
  const CachedBanner({super.key, required this.savedAt, this.onRetry});
  final DateTime savedAt;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final mins = DateTime.now().difference(savedAt).inMinutes;
    final ago = mins < 1 ? 'just now' : mins < 60 ? '$mins min ago' : mins < 1440 ? '${mins ~/ 60} h ago' : '${mins ~/ 1440} d ago';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.amber.withValues(alpha: 0.4))),
      child: Row(children: [
        const Icon(Icons.cloud_off_outlined, size: 18, color: AppColors.amber),
        const SizedBox(width: 8),
        Expanded(child: Text('Offline copy saved $ago — not live data.', style: const TextStyle(fontFamily: kFont, fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.ink))),
        if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Retry')),
      ]),
    );
  }
}
