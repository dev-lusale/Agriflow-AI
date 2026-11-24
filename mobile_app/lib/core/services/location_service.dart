import 'package:geolocator/geolocator.dart';

class LocationResult {
  LocationResult({this.lat, this.lng, this.accuracy, this.error});
  final double? lat;
  final double? lng;
  final double? accuracy;
  final String? error;
  bool get ok => lat != null && lng != null;
}

/// Asks for location permission only when the user taps "Use my location".
class LocationService {
  Future<LocationResult> current() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return LocationResult(error: 'Turn on location (GPS) in your phone settings and try again.');
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) return LocationResult(error: 'Location permission was not given.');
      if (perm == LocationPermission.deniedForever) {
        return LocationResult(error: 'Location is blocked for AgriFlow AI. Allow it in Settings › Apps › AgriFlow AI › Permissions.');
      }
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 25)));
      return LocationResult(lat: p.latitude, lng: p.longitude, accuracy: p.accuracy);
    } catch (_) {
      return LocationResult(error: 'Could not get your location. Move to an open area and try again.');
    }
  }
}
