import 'dart:convert';
import 'dart:io';
import 'package:get/get.dart';

import 'package:pure_live/common/models/live_room.dart';
import 'package:pure_live/core/interface/app_settings.dart';

class ServerSettings implements AppSettings {
  static const String _settingsPath = 'data/settings.json';
  
  Map<String, dynamic> _data = {};
  List<LiveRoom> _favorites = [];

  ServerSettings() {
    _load();
  }

  void _load() {
    try {
      final file = File(_settingsPath);
      if (file.existsSync()) {
        final content = file.readAsStringSync();
        _data = jsonDecode(content);
        if (_data.containsKey('favorites')) {
          _favorites = (_data['favorites'] as List)
              .map((e) => LiveRoom.fromJson(e))
              .toList();
        }
      }
    } catch (e) {
      print('Error loading settings: $e');
    }
  }

  void save() {
    try {
      final file = File(_settingsPath);
      if (!file.existsSync()) {
        file.createSync(recursive: true);
      }
      _data['favorites'] = _favorites.map((e) => e.toJson()).toList();
      file.writeAsStringSync(jsonEncode(_data));
    } catch (e) {
      print('Error saving settings: $e');
    }
  }

  @override
  RxString get bilibiliCookie => RxString(_data['bilibiliCookie'] ?? '');

  @override
  RxString get huyaCookie => RxString(_data['huyaCookie'] ?? '');

  @override
  RxString get douyinCookie => RxString(_data['douyinCookie'] ?? '');

  @override
  List<String> get hotAreasList => List<String>.from(_data['hotAreasList'] ?? []);

  @override
  LiveRoom getLiveRoomByRoomId(String roomId, String platform) {
    return _favorites.firstWhere(
      (element) => element.roomId == roomId && element.platform == platform,
      orElse: () => LiveRoom(roomId: roomId, platform: platform, liveStatus: LiveStatus.unknown),
    );
  }

  // Server specific methods
  void addFavorite(LiveRoom room) {
    if (!_favorites.any((e) => e.roomId == room.roomId && e.platform == room.platform)) {
      _favorites.add(room);
      save();
    }
  }

  void removeFavorite(String roomId, String platform) {
    _favorites.removeWhere((e) => e.roomId == roomId && e.platform == platform);
    save();
  }

  List<LiveRoom> get favorites => _favorites;

  void updateCookie(String platform, String cookie) {
    _data['${platform}Cookie'] = cookie;
    save();
  }

  // Line preferences per platform
  Map<String, int> get preferredLines =>
      Map<String, int>.from(_data['preferredLines'] ?? {});

  void setPreferredLine(String platform, int lineIndex) {
    final lines = preferredLines;
    lines[platform] = lineIndex;
    _data['preferredLines'] = lines;
    save();
  }
}
