import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import 'buttons.dart';
import 'states.dart';

/// Camera or gallery. Photos are re-encoded as JPEG and resized so uploads stay
/// under the server's 4 MB limit on slow networks.
Future<XFile?> pickPhoto(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    showDragHandle: true,
    builder: (c) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          PrimaryButton(label: 'Take a photo', icon: Icons.photo_camera_outlined, onPressed: () => Navigator.pop(c, ImageSource.camera)),
          const SizedBox(height: 12),
          SecondaryButton(label: 'Choose from gallery', icon: Icons.photo_library_outlined, onPressed: () => Navigator.pop(c, ImageSource.gallery)),
        ]),
      ),
    ),
  );
  if (source == null) return null;
  try {
    return await ImagePicker().pickImage(source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 82, requestFullMetadata: false);
  } catch (_) {
    if (context.mounted) showSnack(context, source == ImageSource.camera ? 'Could not open the camera.' : 'Could not open your photos.', error: true);
    return null;
  }
}

Future<MultipartFile> photoPart(XFile f) async {
  final name = f.name.toLowerCase();
  final png = name.endsWith('.png');
  return MultipartFile.fromFile(f.path, filename: png ? 'photo.png' : 'photo.jpg', contentType: DioMediaType('image', png ? 'png' : 'jpeg'));
}
