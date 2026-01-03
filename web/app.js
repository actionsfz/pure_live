const apiBase = '/api';

// State management
const state = {
    currentPlatform: 'bilibili',
    popularPage: 1,
    popularTotalPages: 1,
    popularData: [],
    popularLoading: false,
    popularRetried: false,
    popularHasMore: true,
    categoryPlatform: 'bilibili',
    categoryPage: 1,
    categoryTotalPages: 1,
    categoryData: [],
    categoryLoading: false,
    categoryRetried: false,
    currentArea: null,
    currentRoom: null,
    currentStreamData: null,
    platforms: [],
    hlsPlayer: null,
    flvPlayer: null,
    volume: parseFloat(localStorage.getItem('playerVolume') || '1'),
    isWebFullscreen: false,
    controlsTimeout: null,
    danmakuWs: null,
    danmakuEnabled: true,
    itemsPerPage: 12, // 3 rows x 4 columns
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initPlayerControls();
    initVolumeControls();
    initScrollHandlers();
    initPagination();
    loadPlatforms();
    
    // Apply saved volume
    document.getElementById('videoElement').volume = state.volume;
    
    // Event listeners
    document.getElementById('play-btn').onclick = playStream;
    document.getElementById('close-player').onclick = closePlayer;
    document.getElementById('back-to-categories').onclick = showCategoryList;
    document.getElementById('favorite-btn').onclick = toggleFavorite;
    document.getElementById('quality-select').onchange = changeQuality;
    document.getElementById('line-select').onchange = changeLine;
    document.getElementById('pip-btn').onclick = togglePictureInPicture;
    document.getElementById('webfullscreen-btn').onclick = toggleWebFullscreen;
    document.getElementById('back-to-top').onclick = scrollToTop;
    document.getElementById('toggle-danmaku').onclick = toggleDanmaku;
    
    // Load popular by default
    setTimeout(() => loadPopularRooms(), 100);
});

// Navigation
function initNavigation() {
    const sections = {
        popular: document.getElementById('popular-section'),
        categories: document.getElementById('categories-section'),
        favorites: document.getElementById('favorites-section'),
        home: document.getElementById('input-section'),
        settings: document.getElementById('settings-section')
    };

    function showSection(name) {
        Object.values(sections).forEach(el => el.classList.add('hidden'));
        sections[name].classList.remove('hidden');
        
        document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`nav-${name}`).classList.add('active');

        if (name === 'popular' && state.popularData.length === 0) {
            loadPopularRooms();
        }
        if (name === 'categories' && document.getElementById('category-list').children.length === 0) {
            loadCategories();
        }
        if (name === 'favorites') {
            loadFavorites();
        }
    }

    document.getElementById('nav-popular').onclick = () => showSection('popular');
    document.getElementById('nav-categories').onclick = () => showSection('categories');
    document.getElementById('nav-favorites').onclick = () => showSection('favorites');
    document.getElementById('nav-home').onclick = () => showSection('home');
    document.getElementById('nav-settings').onclick = () => showSection('settings');
}

// Player controls auto-hide
function initPlayerControls() {
    const playerWrapper = document.getElementById('player-wrapper');
    const overlay = document.getElementById('player-overlay');
    
    function showControls() {
        overlay.classList.remove('hidden-controls');
        clearTimeout(state.controlsTimeout);
        state.controlsTimeout = setTimeout(hideControls, 5000);
    }
    
    function hideControls() {
        overlay.classList.add('hidden-controls');
    }
    
    playerWrapper.addEventListener('mousemove', showControls);
    playerWrapper.addEventListener('mouseleave', () => {
        clearTimeout(state.controlsTimeout);
        state.controlsTimeout = setTimeout(hideControls, 2000);
    });
    playerWrapper.addEventListener('click', (e) => {
        if (e.target.tagName === 'VIDEO') showControls();
    });
    overlay.addEventListener('mouseenter', () => clearTimeout(state.controlsTimeout));
    overlay.addEventListener('mouseleave', () => {
        state.controlsTimeout = setTimeout(hideControls, 3000);
    });
}

// Volume Controls
function initVolumeControls() {
    const video = document.getElementById('videoElement');
    const indicator = document.getElementById('volume-indicator');
    const valueDisplay = document.getElementById('volume-value');
    let hideTimeout;

    function showVolumeIndicator(vol) {
        valueDisplay.textContent = Math.round(vol * 100) + '%';
        indicator.classList.remove('hidden');
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => indicator.classList.add('hidden'), 1000);
    }

    function adjustVolume(delta) {
        let newVol = Math.max(0, Math.min(1, video.volume + delta));
        video.volume = newVol;
        state.volume = newVol;
        localStorage.setItem('playerVolume', newVol.toString());
        showVolumeIndicator(newVol);
    }

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('player-container').classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            adjustVolume(0.05);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            adjustVolume(-0.05);
        } else if (e.key === 'Escape' && state.isWebFullscreen) {
            toggleWebFullscreen();
        }
    });

    const playerWrapper = document.getElementById('player-wrapper');
    if (playerWrapper) {
        playerWrapper.addEventListener('wheel', (e) => {
            if (document.getElementById('player-container').classList.contains('hidden')) return;
            e.preventDefault();
            adjustVolume(e.deltaY < 0 ? 0.05 : -0.05);
        }, { passive: false });
    }
    
    // Click capture layer for double-click web fullscreen
    const clickCapture = document.getElementById('click-capture');
    if (clickCapture) {
        let clickTimer = null;
        let clickCount = 0;
        
        clickCapture.addEventListener('click', (e) => {
            clickCount++;
            
            if (clickCount === 1) {
                // Wait to see if it's a double-click
                clickTimer = setTimeout(() => {
                    // Single click - toggle play/pause
                    const video = document.getElementById('videoElement');
                    if (video) {
                        if (video.paused) {
                            video.play();
                        } else {
                            video.pause();
                        }
                    }
                    clickCount = 0;
                }, 250);
            } else if (clickCount === 2) {
                // Double click - toggle web fullscreen
                clearTimeout(clickTimer);
                clickCount = 0;
                toggleWebFullscreen();
            }
        });
    }
}

// Web Fullscreen
function toggleWebFullscreen() {
    state.isWebFullscreen = !state.isWebFullscreen;
    document.getElementById('app-container').classList.toggle('webfullscreen', state.isWebFullscreen);
    document.getElementById('webfullscreen-btn').textContent = state.isWebFullscreen ? '⛶' : '⛶';
}

// Scroll handlers
function initScrollHandlers() {
    const backToTop = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        backToTop.classList.toggle('hidden', window.scrollY <= 500);
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Picture in Picture
async function togglePictureInPicture() {
    const video = document.getElementById('videoElement');
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            await video.requestPictureInPicture();
        }
    } catch (e) {
        console.error('PiP error:', e);
    }
}

// Pagination
function initPagination() {
    document.getElementById('popular-prev').onclick = () => { 
        if (state.popularPage > 1) { 
            state.popularPage--; 
            loadPopularRooms(); 
        } 
    };
    document.getElementById('popular-next').onclick = () => { 
        if (state.popularHasMore) { 
            state.popularPage++; 
            loadPopularRooms(); 
        } 
    };
    document.getElementById('category-prev').onclick = () => { if (state.categoryPage > 1) { state.categoryPage--; renderCategoryPage(); } };
    document.getElementById('category-next').onclick = () => { if (state.categoryPage < state.categoryTotalPages) { state.categoryPage++; renderCategoryPage(); } };
}

// Load platforms
async function loadPlatforms() {
    try {
        const res = await fetch(`${apiBase}/platforms`);
        const data = await res.json();
        state.platforms = data.platforms;
    } catch (e) {
        state.platforms = [
            { id: 'bilibili', name: '哔哩' },
            { id: 'douyu', name: '斗鱼' },
            { id: 'huya', name: '虎牙' },
            { id: 'douyin', name: '抖音' },
            { id: 'kuaishou', name: '快手' },
            { id: 'cc', name: '网易CC' }
        ];
    }
    renderPlatformTabs();
}

function renderPlatformTabs() {
    const popularTabs = document.getElementById('platform-tabs');
    const categoryTabs = document.getElementById('category-platform-tabs');
    
    const tabsHtml = state.platforms.map(p => 
        `<button class="platform-tab ${p.id === state.currentPlatform ? 'active' : ''}" data-platform="${p.id}">${p.name}</button>`
    ).join('');
    
    popularTabs.innerHTML = tabsHtml;
    categoryTabs.innerHTML = tabsHtml;
    
    popularTabs.querySelectorAll('.platform-tab').forEach(tab => {
        tab.onclick = () => {
            state.currentPlatform = tab.dataset.platform;
            state.popularPage = 1;
            state.popularData = [];
            state.popularRetried = false;
            state.popularHasMore = true;
            popularTabs.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadPopularRooms();
        };
    });
    
    categoryTabs.querySelectorAll('.platform-tab').forEach(tab => {
        tab.onclick = () => {
            state.categoryPlatform = tab.dataset.platform;
            categoryTabs.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('category-list').innerHTML = '';
            showCategoryList();
            loadCategories();
        };
    });
}

// Popular rooms with on-demand pagination
async function loadPopularRooms() {
    if (state.popularLoading) return;
    
    state.popularLoading = true;
    const loading = document.getElementById('popular-loading');
    const error = document.getElementById('popular-error');
    const grid = document.getElementById('popular-grid');
    
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    grid.innerHTML = '';
    
    try {
        const res = await fetch(`${apiBase}/popular/${state.currentPlatform}?page=${state.popularPage}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        
        state.popularData = data.items || [];
        state.popularHasMore = data.hasMore || false;
        
        renderPopularPage();
    } catch (e) {
        console.error('Failed to load popular rooms:', e);
        // If bilibili fails, try resetting cache and retry once
        if (state.currentPlatform === 'bilibili' && !state.popularRetried) {
            state.popularRetried = true;
            console.log('Resetting Bilibili cache and retrying...');
            await fetch(`${apiBase}/reset-cache/bilibili`);
            state.popularLoading = false;
            return loadPopularRooms();
        }
        state.popularRetried = false;
        error.classList.remove('hidden');
    } finally {
        state.popularLoading = false;
        loading.classList.add('hidden');
    }
}

function renderPopularPage() {
    const grid = document.getElementById('popular-grid');
    
    grid.innerHTML = '';
    state.popularData.forEach(room => grid.appendChild(createRoomCard(room)));
    
    // Update pagination
    document.getElementById('popular-page-info').textContent = `第 ${state.popularPage} 页`;
    document.getElementById('popular-prev').disabled = state.popularPage <= 1;
    document.getElementById('popular-next').disabled = !state.popularHasMore;
}

function retryLoadPopular() {
    document.getElementById('popular-error').classList.add('hidden');
    state.popularData = [];
    loadPopularRooms();
}

// Categories
async function loadCategories() {
    const list = document.getElementById('category-list');
    list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>加载中...</span></div>';
    
    try {
        const res = await fetch(`${apiBase}/categories/${state.categoryPlatform}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        
        list.innerHTML = '';
        
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach(category => {
                if (category.children && category.children.length > 0) {
                    const card = document.createElement('div');
                    card.className = 'category-card';
                    card.innerHTML = `<h4>${category.name}</h4><span>${category.children.length} 个子分类</span>`;
                    card.onclick = () => showSubCategories(category);
                    list.appendChild(card);
                }
            });
        }
        
        if (list.children.length === 0) {
            list.innerHTML = '<p class="empty-message">暂无分类</p>';
        }
    } catch (e) {
        list.innerHTML = '<div class="error-message"><span>加载失败</span><button onclick="loadCategories()">重试</button></div>';
    }
}

function showSubCategories(category) {
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    
    category.children.forEach(area => {
        const item = document.createElement('div');
        item.className = 'category-item';
        const imgSrc = area.areaPic ? getCoverUrl(area.areaPic, state.categoryPlatform) : '';
        item.innerHTML = `
            ${imgSrc ? `<img src="${imgSrc}" alt="" onerror="this.style.background='var(--surface-hover)'">` : '<div style="width:48px;height:48px;background:var(--surface-hover);border-radius:8px;"></div>'}
            <div class="category-item-info">
                <h4>${area.areaName || area.typeName || '未知分类'}</h4>
                <span>${category.name}</span>
            </div>
        `;
        item.onclick = () => loadCategoryRooms(area);
        list.appendChild(item);
    });
}

async function loadCategoryRooms(area) {
    state.currentArea = area;
    state.categoryPage = 1;
    state.categoryData = [];
    
    document.getElementById('category-list').classList.add('hidden');
    document.getElementById('category-rooms-container').classList.remove('hidden');
    document.getElementById('category-title').textContent = area.areaName || area.typeName || '';
    document.getElementById('category-rooms-grid').innerHTML = '';
    document.getElementById('category-error').classList.add('hidden');
    
    await fetchCategoryRooms();
}

async function fetchCategoryRooms() {
    if (state.categoryLoading || !state.currentArea) return;
    
    state.categoryLoading = true;
    const loading = document.getElementById('category-loading');
    const error = document.getElementById('category-error');
    
    loading.classList.remove('hidden');
    
    try {
        const area = state.currentArea;
        const allItems = [];
        let page = 1;
        let hasMore = true;
        
        while (hasMore && allItems.length < 100) {
            const url = `${apiBase}/category/${state.categoryPlatform}/${encodeURIComponent(area.areaType || '')}/${encodeURIComponent(area.areaId || '')}?page=${page}&areaName=${encodeURIComponent(area.areaName || '')}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            
            if (data.items && data.items.length > 0) {
                allItems.push(...data.items);
                hasMore = data.hasMore;
                page++;
            } else {
                hasMore = false;
            }
            
            if (page > 3) break;
        }
        
        state.categoryData = allItems;
        state.categoryTotalPages = Math.ceil(allItems.length / state.itemsPerPage);
        state.categoryPage = 1;
        
        renderCategoryPage();
    } catch (e) {
        error.classList.remove('hidden');
    } finally {
        state.categoryLoading = false;
        loading.classList.add('hidden');
    }
}

function renderCategoryPage() {
    const grid = document.getElementById('category-rooms-grid');
    const start = (state.categoryPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const pageItems = state.categoryData.slice(start, end);
    
    grid.innerHTML = '';
    pageItems.forEach(room => grid.appendChild(createRoomCard(room)));
    
    document.getElementById('category-page-info').textContent = `第 ${state.categoryPage} / ${state.categoryTotalPages} 页`;
    document.getElementById('category-prev').disabled = state.categoryPage <= 1;
    document.getElementById('category-next').disabled = state.categoryPage >= state.categoryTotalPages;
}

function retryLoadCategory() {
    document.getElementById('category-error').classList.add('hidden');
    state.categoryData = [];
    fetchCategoryRooms();
}

function showCategoryList() {
    state.currentArea = null;
    document.getElementById('category-rooms-container').classList.add('hidden');
    document.getElementById('category-list').classList.remove('hidden');
}

// Cover URL helper - use proxy for bilibili
function getCoverUrl(url, platform) {
    if (!url) return '';
    
    // Use image proxy for bilibili to bypass referrer restrictions
    if (platform === 'bilibili' && (url.includes('hdslb.com') || url.includes('bilibili'))) {
        return `${apiBase}/image?url=${encodeURIComponent(url)}`;
    }
    
    return url;
}

// Room card with fixed cover loading
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const isLive = room.liveStatus === 0 || room.status === true;
    const cover = getCoverUrl(room.cover, room.platform);
    
    card.innerHTML = `
        <div class="card-cover">
            ${cover ? `<img src="${cover}" alt="" loading="lazy">` : ''}
            ${isLive ? '<span class="live-badge">直播中</span>' : ''}
            ${room.watching ? `<span class="viewer-count">${formatViewers(room.watching)}</span>` : ''}
        </div>
        <div class="card-content">
            <div class="card-title" title="${room.title || ''}">${room.title || '无标题'}</div>
            <div class="card-subtitle">${room.nick || '未知主播'}</div>
            <div class="card-meta">
                <span class="platform-badge">${getPlatformName(room.platform)}</span>
                ${room.area ? `<span class="platform-badge">${room.area}</span>` : ''}
            </div>
        </div>
    `;
    
    card.onclick = () => openRoom(room);
    return card;
}

function formatViewers(count) {
    if (!count) return '';
    const num = parseInt(count);
    if (isNaN(num)) return count;
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toLocaleString();
}

function getPlatformName(id) {
    const platform = state.platforms.find(p => p.id === id);
    return platform ? platform.name : id || '未知';
}

// Open room and play
async function openRoom(room) {
    state.currentRoom = room;
    document.getElementById('platform-select').value = room.platform || 'bilibili';
    document.getElementById('room-id-input').value = room.roomId || '';
    await playStream();
}

async function playStream() {
    const platform = document.getElementById('platform-select').value;
    const roomId = document.getElementById('room-id-input').value.trim();

    if (!roomId) {
        alert('请输入房间号');
        return;
    }

    try {
        const response = await fetch(`${apiBase}/stream/${platform}/${roomId}`);
        if (!response.ok) throw new Error('获取直播流失败');
        const data = await response.json();
        
        if (!data.success) {
            alert(data.message || '直播间不可用');
            return;
        }
        
        state.currentRoom = data.room;
        state.currentStreamData = data;
        
        // Update player UI
        document.getElementById('player-title').textContent = data.room.title || '直播';
        document.getElementById('player-streamer').textContent = data.room.nick || '';
        
        // Populate quality selector
        const qualitySelect = document.getElementById('quality-select');
        qualitySelect.innerHTML = data.qualities.map((q, i) => 
            `<option value="${i}" ${i === data.selectedQuality ? 'selected' : ''}>${q.name}</option>`
        ).join('');
        
        // Populate line selector
        const lineSelect = document.getElementById('line-select');
        if (data.urls && data.urls.length > 1) {
            lineSelect.innerHTML = data.urls.map((_, i) => `<option value="${i}">线路 ${i + 1}</option>`).join('');
            lineSelect.style.display = 'block';
        } else {
            lineSelect.style.display = 'none';
        }
        
        // Check favorite status
        await updateFavoriteButton(platform, roomId);
        
        // Show player
        document.getElementById('player-container').classList.remove('hidden');
        scrollToTop();
        
        // Connect danmaku
        connectDanmaku(platform, roomId);
        
        // Play stream
        if (data.urls && data.urls.length > 0) {
            playVideoUrl(data.urls[0]);
        } else {
            alert('无可用播放地址');
        }

    } catch (e) {
        alert('错误: ' + e.message);
    }
}

function playVideoUrl(url) {
    const videoElement = document.getElementById('videoElement');
    
    if (state.hlsPlayer) { state.hlsPlayer.destroy(); state.hlsPlayer = null; }
    if (state.flvPlayer) { state.flvPlayer.destroy(); state.flvPlayer = null; }
    
    videoElement.src = '';
    videoElement.volume = state.volume;
    
    const isHls = url.includes('.m3u8') || url.includes('m3u8');
    const isFlv = url.includes('.flv') || url.includes('flv');
    
    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
        state.hlsPlayer = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
        state.hlsPlayer.loadSource(url);
        state.hlsPlayer.attachMedia(videoElement);
        state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => videoElement.play().catch(() => {}));
    } else if (isFlv && typeof flvjs !== 'undefined' && flvjs.isSupported()) {
        state.flvPlayer = flvjs.createPlayer({ type: 'flv', url: url, isLive: true });
        state.flvPlayer.attachMediaElement(videoElement);
        state.flvPlayer.load();
        state.flvPlayer.play();
    } else {
        videoElement.src = url;
        videoElement.play().catch(() => {});
    }
}

async function changeQuality() {
    const quality = document.getElementById('quality-select').value;
    const platform = document.getElementById('platform-select').value;
    const roomId = document.getElementById('room-id-input').value;
    
    try {
        const response = await fetch(`${apiBase}/stream/${platform}/${roomId}?quality=${quality}`);
        const data = await response.json();
        
        if (data.success && data.urls && data.urls.length > 0) {
            state.currentStreamData = data;
            const lineSelect = document.getElementById('line-select');
            if (data.urls.length > 1) {
                lineSelect.innerHTML = data.urls.map((_, i) => `<option value="${i}">线路 ${i + 1}</option>`).join('');
                lineSelect.style.display = 'block';
            } else {
                lineSelect.style.display = 'none';
            }
            playVideoUrl(data.urls[0]);
        }
    } catch (e) {
        console.error('切换画质失败:', e);
    }
}

function changeLine() {
    const lineIndex = parseInt(document.getElementById('line-select').value);
    if (state.currentStreamData?.urls?.[lineIndex]) {
        playVideoUrl(state.currentStreamData.urls[lineIndex]);
    }
}

function closePlayer() {
    document.getElementById('player-container').classList.add('hidden');
    document.getElementById('videoElement').pause();
    
    if (state.isWebFullscreen) toggleWebFullscreen();
    if (state.hlsPlayer) { state.hlsPlayer.destroy(); state.hlsPlayer = null; }
    if (state.flvPlayer) { state.flvPlayer.destroy(); state.flvPlayer = null; }
    
    disconnectDanmaku();
    
    document.getElementById('videoElement').src = '';
    state.currentRoom = null;
    state.currentStreamData = null;
}

// Danmaku
function connectDanmaku(platform, roomId) {
    disconnectDanmaku();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/danmaku/${platform}/${roomId}`;
    
    document.getElementById('danmaku-status').textContent = '连接中...';
    document.getElementById('danmaku-list').innerHTML = '';
    
    try {
        state.danmakuWs = new WebSocket(wsUrl);
        
        state.danmakuWs.onopen = () => {
            document.getElementById('danmaku-status').textContent = '已连接';
        };
        
        state.danmakuWs.onmessage = (event) => {
            if (!state.danmakuEnabled) return;
            try {
                const msg = JSON.parse(event.data);
                addDanmakuMessage(msg);
            } catch (e) {}
        };
        
        state.danmakuWs.onclose = () => {
            document.getElementById('danmaku-status').textContent = '连接已断开';
        };
        
        state.danmakuWs.onerror = () => {
            document.getElementById('danmaku-status').textContent = '弹幕暂不可用';
        };
    } catch (e) {
        document.getElementById('danmaku-status').textContent = '弹幕暂不可用';
    }
}

function disconnectDanmaku() {
    if (state.danmakuWs) {
        state.danmakuWs.close();
        state.danmakuWs = null;
    }
}

function addDanmakuMessage(msg) {
    const list = document.getElementById('danmaku-list');
    const item = document.createElement('div');
    item.className = 'danmaku-item';
    item.innerHTML = `<span class="username">${msg.userName || '匿名'}:</span><span class="message">${msg.message || ''}</span>`;
    list.appendChild(item);
    
    // Keep max 200 messages
    while (list.children.length > 200) {
        list.removeChild(list.firstChild);
    }
    
    // Auto scroll
    list.scrollTop = list.scrollHeight;
}

function toggleDanmaku() {
    state.danmakuEnabled = !state.danmakuEnabled;
    document.getElementById('toggle-danmaku').style.opacity = state.danmakuEnabled ? '1' : '0.5';
}

// Favorites
async function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    const emptyMsg = document.getElementById('favorites-empty');
    
    grid.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
    
    try {
        const res = await fetch(`${apiBase}/favorites`);
        const favorites = await res.json();
        
        grid.innerHTML = '';
        
        if (favorites.length === 0) {
            emptyMsg.classList.remove('hidden');
        } else {
            emptyMsg.classList.add('hidden');
            favorites.forEach(room => grid.appendChild(createRoomCard(room)));
        }
    } catch (e) {
        grid.innerHTML = '<div class="error-message"><span>加载失败</span><button onclick="loadFavorites()">重试</button></div>';
    }
}

async function updateFavoriteButton(platform, roomId) {
    try {
        const res = await fetch(`${apiBase}/favorites/check/${platform}/${roomId}`);
        const data = await res.json();
        
        const btn = document.getElementById('favorite-btn');
        if (data.isFavorite) {
            btn.classList.add('active');
            btn.querySelector('.heart-icon').textContent = '♥';
        } else {
            btn.classList.remove('active');
            btn.querySelector('.heart-icon').textContent = '♡';
        }
    } catch (e) {}
}

async function toggleFavorite() {
    if (!state.currentRoom) return;
    
    const btn = document.getElementById('favorite-btn');
    const isCurrentlyFavorite = btn.classList.contains('active');
    
    try {
        if (isCurrentlyFavorite) {
            await fetch(`${apiBase}/favorites/${state.currentRoom.platform}/${state.currentRoom.roomId}`, { method: 'DELETE' });
            btn.classList.remove('active');
            btn.querySelector('.heart-icon').textContent = '♡';
        } else {
            await fetch(`${apiBase}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.currentRoom)
            });
            btn.classList.add('active');
            btn.querySelector('.heart-icon').textContent = '♥';
        }
    } catch (e) {}
}

// Settings
async function saveCookie(platform) {
    const input = document.getElementById(`${platform}-cookie`);
    const cookie = input.value;
    
    try {
        await fetch(`${apiBase}/settings/cookie`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, cookie })
        });
        alert('保存成功！');
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

// Bilibili QR Login
let qrPollInterval = null;

async function startBiliBiliQRLogin() {
    const modal = document.getElementById('qr-modal');
    const loading = document.getElementById('qr-loading');
    const qrImage = document.getElementById('qr-image');
    const qrStatus = document.getElementById('qr-status');
    
    modal.classList.remove('hidden');
    loading.style.display = 'flex';
    qrImage.style.display = 'none';
    qrStatus.textContent = '';
    
    try {
        const res = await fetch(`${apiBase}/bilibili/qr/generate`);
        const data = await res.json();
        
        if (!data.success) {
            qrStatus.textContent = '获取二维码失败: ' + (data.message || '未知错误');
            loading.style.display = 'none';
            return;
        }
        
        // Generate QR code using external library or API
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qrcodeUrl)}`;
        qrImage.style.display = 'block';
        loading.style.display = 'none';
        qrStatus.textContent = '请使用哔哩哔哩 App 扫码登录';
        
        // Start polling
        startQRPoll(data.qrcodeKey);
    } catch (e) {
        qrStatus.textContent = '获取二维码失败: ' + e.message;
        loading.style.display = 'none';
    }
}

function startQRPoll(qrcodeKey) {
    if (qrPollInterval) clearInterval(qrPollInterval);
    
    qrPollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${apiBase}/bilibili/qr/poll?qrcode_key=${qrcodeKey}`);
            const data = await res.json();
            const qrStatus = document.getElementById('qr-status');
            
            if (!data.success) {
                qrStatus.textContent = data.message || '轮询失败';
                return;
            }
            
            switch (data.status) {
                case 'success':
                    qrStatus.textContent = '登录成功！';
                    document.getElementById('bilibili-login-status').textContent = '已登录';
                    closeQRModal();
                    // Reload platform data
                    if (state.currentPlatform === 'bilibili') {
                        state.popularData = [];
                        state.popularPage = 1;
                        loadPopularRooms();
                    }
                    break;
                case 'scanned':
                    qrStatus.textContent = '已扫码，请在手机上确认登录';
                    break;
                case 'expired':
                    qrStatus.textContent = '二维码已过期，请重新获取';
                    clearInterval(qrPollInterval);
                    break;
                case 'waiting':
                    // Still waiting
                    break;
            }
        } catch (e) {
            console.error('QR poll error:', e);
        }
    }, 3000);
}

function closeQRModal() {
    document.getElementById('qr-modal').classList.add('hidden');
    if (qrPollInterval) {
        clearInterval(qrPollInterval);
        qrPollInterval = null;
    }
}
