const apiBase = '/api';

// State management
const state = {
    currentPlatform: 'bilibili',
    popularPage: 1,
    popularHasMore: true,
    popularLoading: false,
    categoryPlatform: 'bilibili',
    categoryPage: 1,
    categoryHasMore: true,
    categoryLoading: false,
    currentArea: null,
    currentRoom: null,
    currentStreamData: null,
    platforms: [],
    hlsPlayer: null,
    flvPlayer: null,
    volume: parseFloat(localStorage.getItem('playerVolume') || '1'),
    isMiniMode: false,
    controlsTimeout: null,
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initPlayerControls();
    initVolumeControls();
    initScrollHandlers();
    initInfiniteScroll();
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
    document.getElementById('back-to-top').onclick = scrollToTop;
    document.getElementById('expand-player').onclick = expandFromMini;
    document.getElementById('close-mini-player').onclick = closePlayer;
    
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

        if (name === 'popular' && document.getElementById('popular-grid').children.length === 0) {
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
        if (!state.isMiniMode) {
            overlay.classList.add('hidden-controls');
        }
    }
    
    // Mouse move shows controls
    playerWrapper.addEventListener('mousemove', showControls);
    
    // Mouse leave starts hide timer
    playerWrapper.addEventListener('mouseleave', () => {
        clearTimeout(state.controlsTimeout);
        state.controlsTimeout = setTimeout(hideControls, 2000);
    });
    
    // Click on video shows controls
    playerWrapper.addEventListener('click', (e) => {
        if (e.target.tagName === 'VIDEO') {
            showControls();
        }
    });
    
    // Prevent hiding when interacting with controls
    overlay.addEventListener('mouseenter', () => {
        clearTimeout(state.controlsTimeout);
    });
    
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

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('player-container').classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            adjustVolume(0.05);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            adjustVolume(-0.05);
        }
    });

    // Mouse wheel on player
    const playerWrapper = document.getElementById('player-wrapper');
    if (playerWrapper) {
        playerWrapper.addEventListener('wheel', (e) => {
            if (document.getElementById('player-container').classList.contains('hidden')) return;
            e.preventDefault();
            adjustVolume(e.deltaY < 0 ? 0.05 : -0.05);
        }, { passive: false });
    }
}

// Scroll handlers
function initScrollHandlers() {
    const backToTop = document.getElementById('back-to-top');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        // Show/hide back to top
        if (scrollY > 500) {
            backToTop.classList.remove('hidden');
        } else {
            backToTop.classList.add('hidden');
        }
        
        // Mini player mode logic
        const playerContainer = document.getElementById('player-container');
        if (!playerContainer.classList.contains('hidden') && state.currentRoom) {
            const playerRect = playerContainer.getBoundingClientRect();
            const shouldBeMini = playerRect.bottom < -50;
            
            if (shouldBeMini && !state.isMiniMode) {
                enterMiniMode();
            } else if (!shouldBeMini && state.isMiniMode) {
                exitMiniMode();
            }
        }
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function enterMiniMode() {
    state.isMiniMode = true;
    const playerContainer = document.getElementById('player-container');
    const miniPlayer = document.getElementById('mini-player');
    
    playerContainer.classList.add('mini-mode');
    miniPlayer.classList.remove('hidden');
    document.getElementById('mini-player-title').textContent = state.currentRoom?.title || '直播中';
}

function exitMiniMode() {
    state.isMiniMode = false;
    const playerContainer = document.getElementById('player-container');
    const miniPlayer = document.getElementById('mini-player');
    
    playerContainer.classList.remove('mini-mode');
    miniPlayer.classList.add('hidden');
}

function expandFromMini() {
    exitMiniMode();
    scrollToTop();
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
        alert('画中画功能不可用');
    }
}

// Load platforms
async function loadPlatforms() {
    try {
        const res = await fetch(`${apiBase}/platforms`);
        const data = await res.json();
        state.platforms = data.platforms;
    } catch (e) {
        console.error('Failed to load platforms:', e);
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
            state.popularHasMore = true;
            popularTabs.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('popular-grid').innerHTML = '';
            document.getElementById('popular-error').classList.add('hidden');
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

// Popular rooms with better error handling
async function loadPopularRooms() {
    if (state.popularLoading || !state.popularHasMore) return;
    
    state.popularLoading = true;
    const loading = document.getElementById('popular-loading');
    const error = document.getElementById('popular-error');
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        const res = await fetch(`${apiBase}/popular/${state.currentPlatform}?page=${state.popularPage}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        
        const grid = document.getElementById('popular-grid');
        if (data.items && data.items.length > 0) {
            data.items.forEach(room => {
                grid.appendChild(createRoomCard(room));
            });
            state.popularHasMore = data.hasMore;
            state.popularPage++;
        } else if (state.popularPage === 1) {
            grid.innerHTML = '<p class="empty-message">暂无直播</p>';
            state.popularHasMore = false;
        }
    } catch (e) {
        console.error('Failed to load popular rooms:', e);
        if (state.popularPage === 1) {
            error.classList.remove('hidden');
        }
    } finally {
        state.popularLoading = false;
        loading.classList.add('hidden');
    }
}

function retryLoadPopular() {
    document.getElementById('popular-error').classList.add('hidden');
    state.popularPage = 1;
    state.popularHasMore = true;
    document.getElementById('popular-grid').innerHTML = '';
    loadPopularRooms();
}

// Categories
async function loadCategories() {
    const list = document.getElementById('category-list');
    list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>加载中...</span></div>';
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const res = await fetch(`${apiBase}/categories/${state.categoryPlatform}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        
        list.innerHTML = '';
        
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach(category => {
                if (category.children && category.children.length > 0) {
                    const card = document.createElement('div');
                    card.className = 'category-card';
                    card.innerHTML = `
                        <h4>${category.name}</h4>
                        <span>${category.children.length} 个子分类</span>
                    `;
                    card.onclick = () => showSubCategories(category);
                    list.appendChild(card);
                }
            });
        }
        
        if (list.children.length === 0) {
            list.innerHTML = '<p class="empty-message">暂无分类</p>';
        }
    } catch (e) {
        console.error('Failed to load categories:', e);
        list.innerHTML = '<div class="error-message"><span>加载失败</span><button onclick="loadCategories()">重试</button></div>';
    }
}

function showSubCategories(category) {
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    
    category.children.forEach(area => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <img src="${area.areaPic || ''}" alt="" onerror="this.style.background='var(--surface-hover)'">
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
    state.categoryHasMore = true;
    
    document.getElementById('category-list').classList.add('hidden');
    document.getElementById('category-rooms-container').classList.remove('hidden');
    document.getElementById('category-title').textContent = area.areaName || area.typeName || '';
    document.getElementById('category-rooms-grid').innerHTML = '';
    document.getElementById('category-error').classList.add('hidden');
    
    await fetchCategoryRooms();
}

async function fetchCategoryRooms() {
    if (state.categoryLoading || !state.categoryHasMore || !state.currentArea) return;
    
    state.categoryLoading = true;
    const loading = document.getElementById('category-loading');
    const error = document.getElementById('category-error');
    loading.classList.remove('hidden');
    
    try {
        const area = state.currentArea;
        const url = `${apiBase}/category/${state.categoryPlatform}/${encodeURIComponent(area.areaType || '')}/${encodeURIComponent(area.areaId || '')}?page=${state.categoryPage}&areaName=${encodeURIComponent(area.areaName || '')}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        
        const grid = document.getElementById('category-rooms-grid');
        if (data.items && data.items.length > 0) {
            data.items.forEach(room => {
                grid.appendChild(createRoomCard(room));
            });
            state.categoryHasMore = data.hasMore;
            state.categoryPage++;
        } else if (state.categoryPage === 1) {
            grid.innerHTML = '<p class="empty-message">暂无直播</p>';
            state.categoryHasMore = false;
        }
    } catch (e) {
        console.error('Failed to load category rooms:', e);
        if (state.categoryPage === 1) {
            error.classList.remove('hidden');
        }
    } finally {
        state.categoryLoading = false;
        loading.classList.add('hidden');
    }
}

function retryLoadCategory() {
    document.getElementById('category-error').classList.add('hidden');
    state.categoryPage = 1;
    state.categoryHasMore = true;
    document.getElementById('category-rooms-grid').innerHTML = '';
    fetchCategoryRooms();
}

function showCategoryList() {
    state.currentArea = null;
    document.getElementById('category-rooms-container').classList.add('hidden');
    document.getElementById('category-list').classList.remove('hidden');
}

// Room card with better image handling
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const isLive = room.liveStatus === 0 || room.status === true;
    const cover = room.cover || '';
    
    card.innerHTML = `
        <div class="card-cover">
            ${cover ? `<img src="${cover}" alt="" loading="lazy" onload="this.style.opacity=1" onerror="this.classList.add('loading-error')">` : ''}
            <div class="cover-placeholder">${room.nick || '直播间'}</div>
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
    
    // Style the image
    const img = card.querySelector('img');
    if (img) {
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';
    }
    
    card.onclick = () => openRoom(room);
    return card;
}

function formatViewers(count) {
    if (!count) return '';
    const num = parseInt(count);
    if (isNaN(num)) return count;
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万';
    }
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
            lineSelect.innerHTML = data.urls.map((_, i) => 
                `<option value="${i}">线路 ${i + 1}</option>`
            ).join('');
            lineSelect.style.display = 'block';
        } else {
            lineSelect.style.display = 'none';
        }
        
        // Check favorite status
        await updateFavoriteButton(platform, roomId);
        
        // Show player and scroll to top
        document.getElementById('player-container').classList.remove('hidden');
        scrollToTop();
        
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
    
    // Cleanup previous players
    if (state.hlsPlayer) {
        state.hlsPlayer.destroy();
        state.hlsPlayer = null;
    }
    if (state.flvPlayer) {
        state.flvPlayer.destroy();
        state.flvPlayer = null;
    }
    
    videoElement.src = '';
    videoElement.volume = state.volume;
    
    // Detect stream type
    const isHls = url.includes('.m3u8') || url.includes('m3u8');
    const isFlv = url.includes('.flv') || url.includes('flv');
    
    if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
        state.hlsPlayer = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
        });
        state.hlsPlayer.loadSource(url);
        state.hlsPlayer.attachMedia(videoElement);
        state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(e => console.log('自动播放被阻止:', e));
        });
        state.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('HLS fatal error:', data);
            }
        });
    } else if (isFlv && typeof flvjs !== 'undefined' && flvjs.isSupported()) {
        state.flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: url,
            isLive: true,
        });
        state.flvPlayer.attachMediaElement(videoElement);
        state.flvPlayer.load();
        state.flvPlayer.play();
    } else {
        videoElement.src = url;
        videoElement.play().catch(e => console.log('播放错误:', e));
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
            
            // Update line selector
            const lineSelect = document.getElementById('line-select');
            if (data.urls.length > 1) {
                lineSelect.innerHTML = data.urls.map((_, i) => 
                    `<option value="${i}">线路 ${i + 1}</option>`
                ).join('');
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
    if (state.currentStreamData && state.currentStreamData.urls && state.currentStreamData.urls[lineIndex]) {
        playVideoUrl(state.currentStreamData.urls[lineIndex]);
    }
}

function closePlayer() {
    const playerContainer = document.getElementById('player-container');
    const videoElement = document.getElementById('videoElement');
    
    // Exit mini mode first
    exitMiniMode();
    
    playerContainer.classList.add('hidden');
    videoElement.pause();
    
    if (state.hlsPlayer) {
        state.hlsPlayer.destroy();
        state.hlsPlayer = null;
    }
    if (state.flvPlayer) {
        state.flvPlayer.destroy();
        state.flvPlayer = null;
    }
    
    videoElement.src = '';
    state.currentRoom = null;
    state.currentStreamData = null;
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
            favorites.forEach(room => {
                grid.appendChild(createRoomCard(room));
            });
        }
    } catch (e) {
        console.error('Failed to load favorites:', e);
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
    } catch (e) {
        console.error('Failed to check favorite status:', e);
    }
}

async function toggleFavorite() {
    if (!state.currentRoom) return;
    
    const btn = document.getElementById('favorite-btn');
    const isCurrentlyFavorite = btn.classList.contains('active');
    
    try {
        if (isCurrentlyFavorite) {
            await fetch(`${apiBase}/favorites/${state.currentRoom.platform}/${state.currentRoom.roomId}`, {
                method: 'DELETE'
            });
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
    } catch (e) {
        console.error('Failed to toggle favorite:', e);
    }
}

// Infinite scroll
function initInfiniteScroll() {
    const options = {
        root: null,
        rootMargin: '300px',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.id === 'popular-loading' && !state.popularLoading && state.popularHasMore) {
                    loadPopularRooms();
                } else if (entry.target.id === 'category-loading' && !state.categoryLoading && state.categoryHasMore) {
                    fetchCategoryRooms();
                }
            }
        });
    }, options);

    observer.observe(document.getElementById('popular-loading'));
    observer.observe(document.getElementById('category-loading'));
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
