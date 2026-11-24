import 'package:material_ui/material_ui.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.height = 56, this.withWordmark = false});
  final double height;
  final bool withWordmark;

  @override
  Widget build(BuildContext context) {
    final mark = Image.asset('assets/brand/mark.png', height: height, fit: BoxFit.contain, semanticLabel: 'AgriFlow AI logo');
    if (!withWordmark) return mark;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      mark,
      const SizedBox(width: 10),
      Text.rich(
        TextSpan(children: [
          TextSpan(text: 'AgriFlow ', style: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, fontSize: height * 0.42, color: AppColors.ink)),
          TextSpan(text: 'AI', style: TextStyle(fontFamily: kFont, fontWeight: FontWeight.w800, fontSize: height * 0.42, color: AppColors.coral)),
        ]),
      ),
    ]);
  }
}
