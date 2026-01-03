import 'dart:convert';
import 'dart:io';

import 'package:get/get.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_static/shelf_static.dart';
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:pure_live/core/interface/app_settings.dart';
import 'package:pure_live/core/sites.dart';
import 'package:pure_live/core/site/bilibili_site.dart';
import 'package:pure_live/server/server_settings.dart';

import 'package:pure_live/common/models/index.dart';

void main(List<String> args) async {
  // Initialize Settings
  final settings = ServerSettings();
  Get.put<AppSettings>(settings);
  Get.put(settings); // Verify if we can access ServerSettings specifically if needed

  // Apply saved cookies to site instances
  _initializeSiteCookies(settings);

  // Initialize Router
  final router = Router();

  // API Routes
  router.get('/api/live/<platform>/<roomId>', _getLiveStream);
  router.get('/api/stream/<platform>/<roomId>', _getStreamUrls);
  router.get('/api/popular/<platform>', _getPopularRooms);
  router.get('/api/categories/<platform>', _getCategories);
  router.get('/api/category/<platform>/<areaType>/<areaId>', _getCategoryRooms);
  router.get('/api/favorites', _getFavorites);
  router.get('/api/favorites/check/<platform>/<roomId>', _checkFavorite);
  router.post('/api/favorites', _addFavorite);
  router.delete('/api/favorites/<platform>/<roomId>', _removeFavorite);
  router.post('/api/settings/cookie', _updateCookie);
  router.get('/api/platforms', _getPlatforms);
  router.get('/api/image', _proxyImage);
  router.get('/api/reset-cache/<platform>', _resetPlatformCache);
  
  // Bilibili QR Login
  router.get('/api/bilibili/qr/generate', _generateBiliBiliQR);
  router.get('/api/bilibili/qr/poll', _pollBiliBiliQR);
  
  // WebSocket for danmaku
  router.get('/ws/danmaku/<platform>/<roomId>', _handleDanmakuWebSocket);

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
    
    // Sync cookie to site instance
    if (platform == 'bilibili') {
      final biliSite = Sites.of('bilibili').liveSite as BiliBiliSite;
      biliSite.cookie = cookie;
      // Reset WBI keys to force refresh
      BiliBiliSite.kImgKey = '';
      BiliBiliSite.kSubKey = '';
    }
    
    return Response.ok(jsonEncode({'success': true}), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.badRequest(body: 'Invalid data');
  }
}

/// Get stream URLs with quality options
Future<Response> _getStreamUrls(Request request, String platform, String roomId) async {
  try {
    final site = Sites.of(platform);
    final room = await site.liveSite.getRoomDetail(roomId: roomId, platform: platform);
    
    if (room.liveStatus != LiveStatus.live && room.liveStatus != LiveStatus.replay && !(room.isRecord ?? false)) {
      return Response.ok(jsonEncode({
        'success': false,
        'message': 'Stream is offline',
        'room': room.toJson(),
      }), headers: {'content-type': 'application/json'});
    }
    
    // Get available qualities
    final qualities = await site.liveSite.getPlayQualites(detail: room);
    
    if (qualities.isEmpty) {
      return Response.ok(jsonEncode({
        'success': false,
        'message': 'No stream qualities available',
        'room': room.toJson(),
      }), headers: {'content-type': 'application/json'});
    }
    
    // Get quality index from query param or default to first (highest)
    final qualityIndex = int.tryParse(request.url.queryParameters['quality'] ?? '0') ?? 0;
    final selectedQuality = qualityIndex < qualities.length ? qualities[qualityIndex] : qualities[0];
    
    // Get play URLs for selected quality
    final urls = await site.liveSite.getPlayUrls(detail: room, quality: selectedQuality);
    
    return Response.ok(jsonEncode({
      'success': true,
      'room': room.toJson(),
      'qualities': qualities.map((q) => {'name': q.quality, 'sort': q.sort}).toList(),
      'selectedQuality': qualityIndex,
      'urls': urls,
    }), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error fetching stream: $e');
  }
}

/// Get popular/recommended rooms for a platform with pagination
Future<Response> _getPopularRooms(Request request, String platform) async {
  try {
    final page = int.tryParse(request.url.queryParameters['page'] ?? '1') ?? 1;
    final site = Sites.of(platform);
    final result = await site.liveSite.getRecommendRooms(page: page, nick: '热门');
    
    return Response.ok(jsonEncode({
      'items': result.items.map((r) => r.toJson()).toList(),
      'hasMore': result.hasMore,
      'page': page,
    }), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error fetching popular rooms: $e');
  }
}

/// Get categories for a platform
Future<Response> _getCategories(Request request, String platform) async {
  try {
    final site = Sites.of(platform);
    final categories = await site.liveSite.getCategores(1, 100);
    
    final categoryList = <Map<String, dynamic>>[];
    for (var c in categories) {
      categoryList.add({
        'id': c.id,
        'name': c.name,
        'children': c.children.map((a) => a.toJson()).toList(),
      });
    }
    
    return Response.ok(jsonEncode({
      'categories': categoryList,
    }), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error fetching categories: $e');
  }
}

/// Get rooms in a specific category/area
Future<Response> _getCategoryRooms(Request request, String platform, String areaType, String areaId) async {
  try {
    final page = int.tryParse(request.url.queryParameters['page'] ?? '1') ?? 1;
    final areaName = request.url.queryParameters['areaName'] ?? '';
    final site = Sites.of(platform);
    
    final area = LiveArea(
      platform: platform,
      areaType: areaType,
      areaId: areaId,
      areaName: areaName,
    );
    
    final result = await site.liveSite.getCategoryRooms(area, page: page);
    
    return Response.ok(jsonEncode({
      'items': result.items.map((r) => r.toJson()).toList(),
      'hasMore': result.hasMore,
      'page': page,
    }), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error fetching category rooms: $e');
  }
}

/// Check if a room is in favorites
Future<Response> _checkFavorite(Request request, String platform, String roomId) async {
  final settings = Get.find<ServerSettings>();
  final isFavorite = settings.favorites.any((r) => r.roomId == roomId && r.platform == platform);
  return Response.ok(jsonEncode({'isFavorite': isFavorite}), headers: {'content-type': 'application/json'});
}

/// Get list of available platforms
Future<Response> _getPlatforms(Request request) async {
  final platforms = Sites.supportSites
      .where((s) => s.id != 'iptv') // Exclude IPTV for web
      .map((s) => {'id': s.id, 'name': s.name})
      .toList();
  return Response.ok(jsonEncode({'platforms': platforms}), headers: {'content-type': 'application/json'});
}

/// Proxy image to bypass referrer restrictions
Future<Response> _proxyImage(Request request) async {
  try {
    final imageUrl = request.url.queryParameters['url'];
    if (imageUrl == null || imageUrl.isEmpty) {
      return Response.badRequest(body: 'Missing url parameter');
    }
    
    final uri = Uri.parse(imageUrl);
    final client = HttpClient();
    final httpRequest = await client.getUrl(uri);
    
    // Set headers to bypass referrer checks
    httpRequest.headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    httpRequest.headers.set('Referer', '${uri.scheme}://${uri.host}/');
    
    final httpResponse = await httpRequest.close();
    final bytes = await httpResponse.fold<List<int>>([], (prev, curr) => prev..addAll(curr));
    
    // Determine content type
    var contentType = httpResponse.headers.contentType?.mimeType ?? 'image/jpeg';
    
    return Response.ok(
      bytes,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=86400', // Cache for 1 day
      },
    );
  } catch (e) {
    return Response.internalServerError(body: 'Error proxying image: $e');
  }
}

/// Reset platform cache (for Bilibili WBI key refresh)
Future<Response> _resetPlatformCache(Request request, String platform) async {
  try {
    if (platform == 'bilibili') {
      // Reset static WBI keys
      BiliBiliSite.kImgKey = '';
      BiliBiliSite.kSubKey = '';
      return Response.ok(jsonEncode({'success': true, 'message': 'Bilibili cache reset'}), 
        headers: {'content-type': 'application/json'});
    }
    return Response.ok(jsonEncode({'success': true, 'message': 'No cache to reset for $platform'}), 
      headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error: $e');
  }
}

/// WebSocket handler for danmaku
Future<Response> _handleDanmakuWebSocket(Request request, String platform, String roomId) async {
  return webSocketHandler((WebSocketChannel webSocket) async {
    try {
      final site = Sites.of(platform);
      final danmaku = site.liveSite.getDanmaku();
      
      // Get room detail for danmaku args
      final room = await site.liveSite.getRoomDetail(roomId: roomId, platform: platform);
      
      if (room.danmakuData == null) {
        webSocket.sink.add(jsonEncode({'type': 'error', 'message': '无法获取弹幕信息'}));
        await webSocket.sink.close();
        return;
      }
      
      // Set up message handler
      danmaku.onMessage = (msg) {
        try {
          webSocket.sink.add(jsonEncode({
            'type': msg.type.toString().split('.').last,
            'userName': msg.userName,
            'message': msg.message,
            'color': msg.color.toString(),
          }));
        } catch (e) {
          // Client disconnected
        }
      };
      
      danmaku.onClose = (msg) {
        try {
          webSocket.sink.add(jsonEncode({'type': 'close', 'message': msg}));
        } catch (e) {
          // Ignore
        }
      };
      
      danmaku.onReady = () {
        try {
          webSocket.sink.add(jsonEncode({'type': 'ready', 'message': '弹幕已连接'}));
        } catch (e) {
          // Ignore
        }
      };
      
      // Start receiving danmaku
      await danmaku.start(room.danmakuData);
      
      // Handle client disconnect
      webSocket.stream.listen(
        (message) {
          // Handle any client messages if needed
        },
        onDone: () {
          danmaku.stop();
        },
        onError: (e) {
          danmaku.stop();
        },
      );
    } catch (e) {
      webSocket.sink.add(jsonEncode({'type': 'error', 'message': '弹幕连接失败: $e'}));
      await webSocket.sink.close();
    }
  })(request);
}

/// Initialize site cookies from saved settings
void _initializeSiteCookies(ServerSettings settings) {
  // Apply bilibili cookie
  final biliCookie = settings.bilibiliCookie.value;
  if (biliCookie.isNotEmpty) {
    final biliSite = Sites.of('bilibili').liveSite as BiliBiliSite;
    biliSite.cookie = biliCookie;
    print('Bilibili cookie loaded');
  }
}

/// Generate Bilibili QR code for login
Future<Response> _generateBiliBiliQR(Request request) async {
  try {
    final httpClient = HttpClient();
    final uri = Uri.parse('https://passport.bilibili.com/x/passport-login/web/qrcode/generate');
    final httpRequest = await httpClient.getUrl(uri);
    httpRequest.headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    final httpResponse = await httpRequest.close();
    final responseBody = await httpResponse.transform(utf8.decoder).join();
    final data = jsonDecode(responseBody);
    
    if (data['code'] != 0) {
      return Response.ok(jsonEncode({
        'success': false,
        'message': data['message'] ?? 'Failed to generate QR code',
      }), headers: {'content-type': 'application/json'});
    }
    
    return Response.ok(jsonEncode({
      'success': true,
      'qrcodeKey': data['data']['qrcode_key'],
      'qrcodeUrl': data['data']['url'],
    }), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error generating QR code: $e');
  }
}

/// Poll Bilibili QR code login status
Future<Response> _pollBiliBiliQR(Request request) async {
  try {
    final qrcodeKey = request.url.queryParameters['qrcode_key'];
    if (qrcodeKey == null || qrcodeKey.isEmpty) {
      return Response.badRequest(body: 'Missing qrcode_key parameter');
    }
    
    final httpClient = HttpClient();
    final uri = Uri.parse('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=$qrcodeKey');
    final httpRequest = await httpClient.getUrl(uri);
    httpRequest.headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    final httpResponse = await httpRequest.close();
    final responseBody = await httpResponse.transform(utf8.decoder).join();
    final data = jsonDecode(responseBody);
    
    if (data['code'] != 0) {
      return Response.ok(jsonEncode({
        'success': false,
        'message': data['message'] ?? 'Poll failed',
      }), headers: {'content-type': 'application/json'});
    }
    
    final code = data['data']['code'];
    String status;
    String? cookie;
    
    switch (code) {
      case 0:
        // Login successful - extract cookies from response
        status = 'success';
        final cookies = <String>[];
        httpResponse.cookies.forEach((c) {
          cookies.add('${c.name}=${c.value}');
        });
        if (cookies.isNotEmpty) {
          cookie = cookies.join('; ');
          // Save and apply cookie
          final settings = Get.find<ServerSettings>();
          settings.updateCookie('bilibili', cookie);
          final biliSite = Sites.of('bilibili').liveSite as BiliBiliSite;
          biliSite.cookie = cookie;
          BiliBiliSite.kImgKey = '';
          BiliBiliSite.kSubKey = '';
        }
        break;
      case 86038:
        status = 'expired';
        break;
      case 86090:
        status = 'scanned';
        break;
      case 86101:
        status = 'waiting';
        break;
      default:
        status = 'unknown';
    }
    
    return Response.ok(jsonEncode({
      'success': true,
      'status': status,
      'cookie': cookie,
    }), headers: {'content-type': 'application/json'});
  } catch (e) {
    return Response.internalServerError(body: 'Error polling QR status: $e');
  }
}
