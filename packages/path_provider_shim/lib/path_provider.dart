library path_provider;
import 'dart:io';

Future<Directory> getApplicationDocumentsDirectory() async {
  return Directory('./data');
}

Future<Directory> getApplicationSupportDirectory() async {
  return Directory('./data');
}

Future<Directory> getApplicationCacheDirectory() async {
  return Directory('./data/cache');
}

Future<Directory> getTemporaryDirectory() async {
  return Directory('./data/tmp');
}
