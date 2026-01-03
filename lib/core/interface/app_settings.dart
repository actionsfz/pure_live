import 'package:pure_live/common/models/live_room.dart';
import 'package:get/get.dart';

abstract class AppSettings {
  // Cookies
  RxString get bilibiliCookie;
  RxString get huyaCookie;
  RxString get douyinCookie;

  // Favorites/History
  LiveRoom getLiveRoomByRoomId(String roomId, String platform);
  
  // Browsing
  List<String> get hotAreasList;
}
