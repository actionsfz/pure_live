library services;

class MethodChannel {
  const MethodChannel(String name);
}

class AssetBundle {
  Future<String> loadString(String key, {bool cache = true}) async {
    // In server environment, we might just return empty or try to read file
    // For now, return empty to satisfy compiler
    return ""; 
  }
}

final AssetBundle rootBundle = AssetBundle();
