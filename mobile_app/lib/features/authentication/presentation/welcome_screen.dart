import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/buttons.dart';
import '../../../core/widgets/logo.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Spacer(flex: 2),
            const AppLogo(height: 96),
            const SizedBox(height: 28),
            Text.rich(
              const TextSpan(children: [
                TextSpan(text: 'Farm smarter with\n'),
                TextSpan(text: 'AgriFlow AI', style: TextStyle(color: AppColors.coral)),
              ]),
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontSize: 34),
            ),
            const SizedBox(height: 14),
            const Text(
              'Farm records, Grok-powered advice, crop health checks, local weather and a marketplace built for Zambian farmers and agribusinesses.',
              style: TextStyle(fontFamily: kFont, fontSize: 16, color: AppColors.muted, height: 1.5),
            ),
            const Spacer(flex: 3),
            PrimaryButton(label: 'Create an account', onPressed: () => context.push('/register')),
            const SizedBox(height: 16),
            SecondaryButton(label: 'Log in', onPressed: () => context.push('/login')),
            const SizedBox(height: 28),
          ]),
        ),
      ),
    );
  }
}
