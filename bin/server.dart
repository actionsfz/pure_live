import 'dart:convert';
import 'dart:io';

import 'package:get/get.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_static/shelf_static.dart';

import 'package:pure_live/core/interface/app_settings.dart';
import 'package:pure_live/core/sites.dart';
import 'package:pure_live/server/server_settings.dart';

import 'package:pure_live/common/models/index.dart';

void main(List<String> args) async {
  // Initialize Settings
  final settings = ServerSettings();
  Get.put<AppSettings>(settings);
  Get.put(settings); // Verify if we can access ServerSettings specifically if needed

  // Initialize Router
  final router = Router();

  // API Routes
  router.get('/api/live/<platform>/<roomId>', _getLiveStream);
  router.get('/api/favorites', _getFavorites);
  router.post('/api/favorites', _addFavorite);
  router.delete('/api/favorites/<platform>/<roomId>', _removeFavorite);
  router.post('/api/settings/cookie', _updateCookie);

  // Serve Web Frontend
  // Assuming 'web' directory is in the root of the execution context
  var staticHandler = createStaticHandler('web', defaultDocument: 'index.html');
  router.mount('/', staticHandler);

  // Start Server
  final handler = Pipeline().addMiddleware(logRequests()).addHandler(router.call);

  final port = int.parse(Platform.environment['PORT'] ?? '8080');
  final server = await shelf_io.serve(handler, InternetAddress.anyIPv4, port);

  print('Serving at http://${server.address.host}:${server.port}');
}

Future<Response> _getLiveStream(Request request, String platform, String roomId) async {
  try {
    final site = Sites.of(platform);
    final room = await site.liveSite.getRoomDetail(roomId: roomId, platform: platform);
    // Get highest quality by default or check query params
    // Doing a basic fetch for now
    // We might need to handle PlayQualities logic
    // But Sites.of(platform).liveSite.getLiveStream is not standardized across all?
    // Let's check Sites.of(platform).liveSite interface.
    // It's LiveSite.
    
    // Actually, we probably want to return the raw stream URL or M3U8.
    // The web frontend will likely use hls.js or flv.js so we return the direct link.
    // However, some links expire or need refreshing.
    
    // For now, let's just get the room info which usually contains the stream url or call a specific method
    // Check LiveSite.getRoomDetail implementation in site classes.
    
    return Response.ok(jsonEncode(room.toJson()), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error fetching stream: $e');
  }
}

Future<Response> _getFavorites(Request request) async {
  final settings = Get.find<ServerSettings>();
  return Response.ok(jsonEncode(settings.favorites.map((e) => e.toJson()).toList()),
      headers: {'content-type': 'application/json'});
}

Future<Response> _addFavorite(Request request) async {
  try {
    final payload = await request.readAsString();
    final data = jsonDecode(payload);
    // We need to construct LiveRoom from data. 
    // Simplified for now, expecting full object or minimal
    /*
      roomId: string;
      platform: string;
      ...
    */
    // Ideally we fetch room info to populate details
    // For now, assume client sends valid LiveRoom structure
    final room = LiveRoom.fromJson(data);
    final settings = Get.find<ServerSettings>();
    settings.addFavorite(room);
    return Response.ok('Added');
  } catch (e) {
    return Response.badRequest(body: 'Invalid data');
  }
}

Future<Response> _removeFavorite(Request request, String platform, String roomId) async {
  final settings = Get.find<ServerSettings>();
  settings.removeFavorite(roomId, platform);
  return Response.ok('Removed');
}

Future<Response> _updateCookie(Request request) async {
  try {
    final payload = await request.readAsString();
    final data = jsonDecode(payload);
    final platform = data['platform'];
    final cookie = data['cookie'];
    final settings = Get.find<ServerSettings>();
    settings.updateCookie(platform, cookie);
    return Response.ok('Updated');
  } catch (e) {
    return Response.badRequest(body: 'Invalid data');
  }
}
