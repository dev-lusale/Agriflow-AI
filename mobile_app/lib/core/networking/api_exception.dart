import 'package:dio/dio.dart';

/// One error type for the whole app. Messages are written for farmers, not developers.
class ApiException implements Exception {
  ApiException(this.message, {this.code = 'UNKNOWN', this.status, this.fieldErrors = const {}});

  final String message;
  final String code;
  final int? status;
  final Map<String, List<String>> fieldErrors;

  bool get isNetwork => code == 'NETWORK' || code == 'TIMEOUT';
  bool get isUnauthenticated => status == 401;
  String? field(String name) => fieldErrors[name]?.join(' ');

  static ApiException from(Object e) {
    if (e is ApiException) return e;
    if (e is DioException) {
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ApiException('The server took too long to answer. Check your connection and try again.', code: 'TIMEOUT');
        case DioExceptionType.connectionError:
          return ApiException('No internet connection. Your saved data is still available.', code: 'NETWORK');
        case DioExceptionType.cancel:
          return ApiException('Request cancelled.', code: 'CANCELLED');
        default:
          break;
      }
      final data = e.response?.data;
      final status = e.response?.statusCode;
      if (data is Map && data['error'] is Map) {
        final err = Map<String, dynamic>.from(data['error'] as Map);
        final fe = <String, List<String>>{};
        final raw = err['fieldErrors'];
        if (raw is Map) {
          raw.forEach((k, v) {
            if (v is List) fe['$k'] = v.map((x) => '$x').toList();
          });
        }
        return ApiException('${err['message'] ?? 'Something went wrong.'}', code: '${err['code'] ?? 'ERROR'}', status: status, fieldErrors: fe);
      }
      if (status == 401) return ApiException('Please sign in again.', code: 'UNAUTHENTICATED', status: 401);
      if (status != null && status >= 500) return ApiException('The AgriFlow server had a problem. Please try again shortly.', code: 'SERVER_ERROR', status: status);
      return ApiException('Something went wrong (${status ?? 'no response'}).', status: status);
    }
    return ApiException('Something went wrong. Please try again.');
  }

  @override
  String toString() => message;
}
