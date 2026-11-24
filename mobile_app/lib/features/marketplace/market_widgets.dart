import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/providers/core_providers.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';

/// Product photo from the server, or a tidy placeholder tile (never a broken image).
class UploadImage extends ConsumerWidget {
  const UploadImage({super.key, required this.uploadId, this.height, this.fit = BoxFit.cover, this.label});
  final String? uploadId;
  final double? height;
  final BoxFit fit;
  final String? label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final placeholder = Container(
      height: height,
      color: AppColors.surfaceAlt,
      alignment: Alignment.center,
      child: Text(label == null ? '' : initials(label!), style: const TextStyle(fontFamily: kFont, fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.muted)),
    );
    if (uploadId == null) return placeholder;
    final api = ref.read(apiClientProvider);
    return CachedNetworkImage(
      imageUrl: api.uploadUrl(uploadId!),
      httpHeaders: api.authHeaders,
      height: height,
      width: double.infinity,
      fit: fit,
      placeholder: (_, _) => Container(height: height, color: AppColors.surfaceAlt),
      errorWidget: (_, _, _) => placeholder,
    );
  }
}

class MarketCard extends StatelessWidget {
  const MarketCard({super.key, required this.title, required this.price, required this.subtitle, required this.onTap, this.imageId, this.badge, this.verified = false});
  final String title;
  final String price;
  final String subtitle;
  final VoidCallback onTap;
  final String? imageId;
  final String? badge;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(color: AppColors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.ink, width: 1.3), boxShadow: hardShadow(2, 3)),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Stack(fit: StackFit.expand, children: [
              UploadImage(uploadId: imageId, label: title),
              if (badge != null)
                Positioned(
                  left: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: AppColors.ink, borderRadius: BorderRadius.circular(8)),
                    child: Text(badge!, style: const TextStyle(color: AppColors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(price, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.coralDark)),
              const SizedBox(height: 2),
              Row(children: [
                if (verified) const Padding(padding: EdgeInsets.only(right: 3), child: Icon(Icons.verified, size: 13, color: AppColors.leaf)),
                Expanded(child: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.muted))),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}
