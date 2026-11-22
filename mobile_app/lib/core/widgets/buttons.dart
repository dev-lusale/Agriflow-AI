import 'package:material_ui/material_ui.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Coral primary button with the black offset shadow from the reference design.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({super.key, required this.label, required this.onPressed, this.loading = false, this.icon, this.expand = true, this.color = AppColors.coral, this.textColor = AppColors.white});

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final bool expand;
  final Color color;
  final Color textColor;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.loading;
    final child = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading)
          SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: widget.textColor))
        else ...[
          if (widget.icon != null) ...[Icon(widget.icon, color: widget.textColor, size: 20), const SizedBox(width: 8)],
          Flexible(
            child: Text(widget.label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontFamily: kFont, fontSize: 16, fontWeight: FontWeight.w800, color: widget.textColor)),
          ),
        ],
      ],
    );
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapCancel: () => setState(() => _down = false),
        onTapUp: enabled ? (_) => setState(() => _down = false) : null,
        onTap: enabled ? widget.onPressed : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 90),
          transform: Matrix4.translationValues(_down ? 2 : 0, _down ? 3 : 0, 0),
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: enabled || widget.loading ? widget.color : widget.color.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(kRadius),
            border: Border.all(color: AppColors.ink, width: kBorderWidth),
            boxShadow: _down ? hardShadow(1, 1) : hardShadow(),
          ),
          alignment: Alignment.center,
          child: child,
        ),
      ),
    );
  }
}

/// White outlined button with the same offset shadow (secondary actions).
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({super.key, required this.label, required this.onPressed, this.icon, this.loading = false, this.expand = true});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) =>
      PrimaryButton(label: label, onPressed: onPressed, icon: icon, loading: loading, expand: expand, color: AppColors.white, textColor: AppColors.ink);
}

/// Square outlined tile used for social sign-in (and other icon actions).
class SquareIconButton extends StatelessWidget {
  const SquareIconButton({super.key, required this.child, required this.onTap, required this.semanticLabel, this.size = 64});
  final Widget child;
  final VoidCallback? onTap;
  final String semanticLabel;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(kRadius),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(kRadius),
            border: Border.all(color: AppColors.ink, width: kBorderWidth),
            boxShadow: hardShadow(3, 3),
          ),
          child: Opacity(opacity: onTap == null ? 0.45 : 1, child: child),
        ),
      ),
    );
  }
}

/// Coral text link ("Forgot Password?", "Sign up").
class LinkText extends StatelessWidget {
  const LinkText(this.text, {super.key, required this.onTap, this.size = 14.5});
  final String text;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Text(text, style: TextStyle(fontFamily: kFont, color: AppColors.coral, fontWeight: FontWeight.w800, fontSize: size)),
        ),
      );
}
