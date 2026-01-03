library get;

/// A minimal implementation of Get for pure Dart usage (Server side)
class Get {
  static final Get _instance = Get._internal();
  final Map<Type, dynamic> _dependencies = {};

  factory Get() => _instance;
  Get._internal();

  static S put<S>(S dependency, {String? tag, bool permanent = false, S Function()? builder}) {
    _instance._dependencies[S] = dependency;
    return dependency;
  }

  static S find<S>({String? tag}) {
    if (_instance._dependencies.containsKey(S)) {
      return _instance._dependencies[S];
    }
    throw 'Dependency $S not found';
  }
}

/// Minimal Rx types shim if needed
class Rx<T> {
  T value;
  Rx(this.value);
}

class RxBool extends Rx<bool> {
  RxBool(bool initial) : super(initial);
}

class RxString extends Rx<String> {
  RxString(String initial) : super(initial);
}

class RxInt extends Rx<int> {
  RxInt(int initial) : super(initial);
}

class RxList<T> extends Rx<List<T>> {
  RxList(List<T> initial) : super(initial);
}

class RxMap<K, V> extends Rx<Map<K, V>> {
  RxMap(Map<K, V> initial) : super(initial);
}

extension StringExtension on String {
  RxString get obs => RxString(this);
}

extension IntExtension on int {
  RxInt get obs => RxInt(this);
}

extension BoolExtension on bool {
  RxBool get obs => RxBool(this);
}
