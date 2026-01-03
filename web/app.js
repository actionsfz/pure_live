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
    platforms: [],
    hlsPlayer: null,
    flvPlayer: null,
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initPlatformTabs();
    initInfiniteScroll();
    loadPlatforms();
    
    document.getElementById('play-btn').onclick = playStream;
    document.getElementById('close-player').onclick = closePlayer;
    document.getElementById('back-to-categories').onclick = showCategoryList;
    document.getElementById('favorite-btn').onclick = toggleFavorite;
    document.getElementById('quality-select').onchange = changeQuality;
});

// Navigation
function initNavigation() {
    const sections = {
        home: document.getElementById('input-section'),
        popular: document.getElementById('popular-section'),
        categories: document.getElementById('categories-section'),
        favorites: document.getElementById('favorites-section'),
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

    document.getElementById('nav-home').onclick = () => showSection('home');
    document.getElementById('nav-popular').onclick = () => showSection('popular');
    document.getElementById('nav-categories').onclick = () => showSection('categories');
    document.getElementById('nav-favorites').onclick = () => showSection('favorites');
    document.getElementById('nav-settings').onclick = () => showSection('settings');
}

// Load available platforms
async function loadPlatforms() {
    try {
        const res = await fetch(`${apiBase}/platforms`);
        const data = await res.json();
        state.platforms = data.platforms;
        renderPlatformTabs();
    } catch (e) {
        console.error('Failed to load platforms:', e);
        // Fallback platforms
        state.platforms = [
            { id: 'bilibili', name: '哔哩' },
            { id: 'douyu', name: '斗鱼' },
            { id: 'huya', name: '虎牙' },
            { id: 'douyin', name: '抖音' },
            { id: 'kuaishou', name: '快手' },
            { id: 'cc', name: '网易CC' }
        ];
        renderPlatformTabs();
    }
}

// Platform tabs
function initPlatformTabs() {
    // Will be populated after platforms load
}

function renderPlatformTabs() {
    const popularTabs = document.getElementById('platform-tabs');
    const categoryTabs = document.getElementById('category-platform-tabs');
    
    const tabsHtml = state.platforms.map(p => 
        `<button class="platform-tab ${p.id === state.currentPlatform ? 'active' : ''}" data-platform="${p.id}">${p.name}</button>`
    ).join('');
    
    popularTabs.innerHTML = tabsHtml;
    categoryTabs.innerHTML = tabsHtml;
    
    // Add click handlers
    popularTabs.querySelectorAll('.platform-tab').forEach(tab => {
        tab.onclick = () => {
            state.currentPlatform = tab.dataset.platform;
            state.popularPage = 1;
            state.popularHasMore = true;
            popularTabs.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('popular-grid').innerHTML = '';
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

// Popular rooms
async function loadPopularRooms() {
    if (state.popularLoading || !state.popularHasMore) return;
    
    state.popularLoading = true;
    const loading = document.getElementById('popular-loading');
    loading.classList.remove('hidden');
    
    try {
        const res = await fetch(`${apiBase}/popular/${state.currentPlatform}?page=${state.popularPage}`);
        const data = await res.json();
        
        const grid = document.getElementById('popular-grid');
        data.items.forEach(room => {
            grid.appendChild(createRoomCard(room));
        });
        
        state.popularHasMore = data.hasMore;
        state.popularPage++;
    } catch (e) {
        console.error('Failed to load popular rooms:', e);
    } finally {
        state.popularLoading = false;
        loading.classList.add('hidden');
    }
}

// Categories
async function loadCategories() {
    try {
        const res = await fetch(`${apiBase}/categories/${state.categoryPlatform}`);
        const data = await res.json();
        
        const list = document.getElementById('category-list');
        list.innerHTML = '';
        
        data.categories.forEach(category => {
            if (category.children && category.children.length > 0) {
                // Show category with children count
                const card = document.createElement('div');
                card.className = 'category-card';
                card.innerHTML = `
                    <h4>${category.name}</h4>
                    <span>${category.children.length} subcategories</span>
                `;
                card.onclick = () => showSubCategories(category);
                list.appendChild(card);
            }
        });
        
        if (list.children.length === 0) {
            list.innerHTML = '<p class="empty-message">No categories available for this platform.</p>';
        }
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
}

function showSubCategories(category) {
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    
    category.children.forEach(area => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            ${area.areaPic ? `<img src="${area.areaPic}" alt="${area.areaName}" onerror="this.style.display='none'">` : ''}
            <div class="category-item-info">
                <h4>${area.areaName || area.typeName}</h4>
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
    document.getElementById('category-title').textContent = area.areaName || area.typeName;
    document.getElementById('category-rooms-grid').innerHTML = '';
    
    await fetchCategoryRooms();
}

async function fetchCategoryRooms() {
    if (state.categoryLoading || !state.categoryHasMore || !state.currentArea) return;
    
    state.categoryLoading = true;
    const loading = document.getElementById('category-loading');
    loading.classList.remove('hidden');
    
    try {
        const area = state.currentArea;
        const url = `${apiBase}/category/${state.categoryPlatform}/${area.areaType || ''}/${area.areaId || ''}?page=${state.categoryPage}&areaName=${encodeURIComponent(area.areaName || '')}`;
        const res = await fetch(url);
        const data = await res.json();
        
        const grid = document.getElementById('category-rooms-grid');
        data.items.forEach(room => {
            grid.appendChild(createRoomCard(room));
        });
        
        state.categoryHasMore = data.hasMore;
        state.categoryPage++;
    } catch (e) {
        console.error('Failed to load category rooms:', e);
    } finally {
        state.categoryLoading = false;
        loading.classList.add('hidden');
    }
}

function showCategoryList() {
    state.currentArea = null;
    document.getElementById('category-rooms-container').classList.add('hidden');
    document.getElementById('category-list').classList.remove('hidden');
    loadCategories();
}

// Room card
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const isLive = room.liveStatus === 0 || room.status === true;
    const cover = room.cover || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"%3E%3Crect fill="%231e293b" width="16" height="9"/%3E%3C/svg%3E';
    
    card.innerHTML = `
        <div class="card-cover">
            <img src="${cover}" alt="${room.title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 9%22%3E%3Crect fill=%22%231e293b%22 width=%2216%22 height=%229%22/%3E%3C/svg%3E'">
            ${isLive ? '<span class="live-badge">LIVE</span>' : ''}
            ${room.watching ? `<span class="viewer-count">${formatViewers(room.watching)}</span>` : ''}
        </div>
        <div class="card-content">
            <div class="card-title" title="${room.title}">${room.title || 'Untitled'}</div>
            <div class="card-subtitle">${room.nick || 'Unknown'}</div>
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
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + 'w';
    }
    return num.toLocaleString();
}

function getPlatformName(id) {
    const platform = state.platforms.find(p => p.id === id);
    return platform ? platform.name : id;
}

// Open room and play
async function openRoom(room) {
    state.currentRoom = room;
    document.getElementById('platform-select').value = room.platform;
    document.getElementById('room-id-input').value = room.roomId;
    await playStream();
}

async function playStream() {
    const platform = document.getElementById('platform-select').value;
    const roomId = document.getElementById('room-id-input').value;

    if (!roomId) return alert('Please enter a room ID');

    try {
        const response = await fetch(`${apiBase}/stream/${platform}/${roomId}`);
        if (!response.ok) throw new Error('Failed to fetch stream');
        const data = await response.json();
        
        if (!data.success) {
            alert(data.message || 'Stream is not available');
            return;
        }
        
        state.currentRoom = data.room;
        
        // Update player UI
        document.getElementById('player-title').textContent = data.room.title || 'Live Stream';
        document.getElementById('player-streamer').textContent = data.room.nick || '';
        
        // Populate quality selector
        const qualitySelect = document.getElementById('quality-select');
        qualitySelect.innerHTML = data.qualities.map((q, i) => 
            `<option value="${i}" ${i === data.selectedQuality ? 'selected' : ''}>${q.name}</option>`
        ).join('');
        
        // Check favorite status
        await updateFavoriteButton(platform, roomId);
        
        // Show player
        document.getElementById('player-container').classList.remove('hidden');
        
        // Play stream
        if (data.urls && data.urls.length > 0) {
            playVideoUrl(data.urls[0]);
        } else {
            alert('No playable URLs available');
        }

    } catch (e) {
        alert('Error: ' + e.message);
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
    
    // Detect stream type
    const isHls = url.includes('.m3u8') || url.includes('m3u8');
    const isFlv = url.includes('.flv') || url.includes('flv');
    
    if (isHls && Hls && Hls.isSupported()) {
        state.hlsPlayer = new Hls();
        state.hlsPlayer.loadSource(url);
        state.hlsPlayer.attachMedia(videoElement);
        state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(e => console.log('Autoplay blocked:', e));
        });
    } else if (isFlv && flvjs && flvjs.isSupported()) {
        state.flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: url,
            isLive: true,
        });
        state.flvPlayer.attachMediaElement(videoElement);
        state.flvPlayer.load();
        state.flvPlayer.play();
    } else {
        // Try native playback
        videoElement.src = url;
        videoElement.play().catch(e => console.log('Playback error:', e));
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
            playVideoUrl(data.urls[0]);
        }
    } catch (e) {
        console.error('Failed to change quality:', e);
    }
}

function closePlayer() {
    const playerContainer = document.getElementById('player-container');
    const videoElement = document.getElementById('videoElement');
    
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
}

// Favorites
async function loadFavorites() {
    try {
        const res = await fetch(`${apiBase}/favorites`);
        const favorites = await res.json();
        const grid = document.getElementById('favorites-grid');
        const emptyMsg = document.getElementById('favorites-empty');
        
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
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.id === 'popular-loading') {
                    loadPopularRooms();
                } else if (entry.target.id === 'category-loading') {
                    fetchCategoryRooms();
                }
            }
        });
    }, { rootMargin: '100px' });

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
        alert('Cookie saved successfully!');
    } catch (e) {
        alert('Failed to save cookie: ' + e.message);
    }
}
