const apiBase = '/api';

document.addEventListener('DOMContentLoaded', () => {
    const navHome = document.getElementById('nav-home');
    const navFavorites = document.getElementById('nav-favorites');
    const navSettings = document.getElementById('nav-settings');
    
    const sections = {
        home: document.getElementById('input-section'),
        favorites: document.getElementById('favorites-section'),
        settings: document.getElementById('settings-section')
    };

    function showSection(name) {
        Object.values(sections).forEach(el => el.classList.add('hidden'));
        sections[name].classList.remove('hidden');
        
        document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
        if(name === 'home') navHome.classList.add('active');
        if(name === 'favorites') navFavorites.classList.add('active');
        if(name === 'settings') navSettings.classList.add('active');

        if(name === 'favorites') loadFavorites();
    }

    navHome.onclick = () => showSection('home');
    navFavorites.onclick = () => showSection('favorites');
    navSettings.onclick = () => showSection('settings');

    document.getElementById('play-btn').onclick = playStream;
    document.getElementById('close-player').onclick = closePlayer;
});

async function playStream() {
    const platform = document.getElementById('platform-select').value;
    const roomId = document.getElementById('room-id-input').value;

    if (!roomId) return alert('Please enter a room ID');

    try {
        const response = await fetch(`${apiBase}/live/${platform}/${roomId}`);
        if (!response.ok) throw new Error('Stream not found');
        const data = await response.json();
        
        // Assuming data.link is the stream URL or we construct it
        // The API _getLiveStream in server.dart currently returns LiveRoom json.
        // LiveRoom has 'link' or 'data'.
        // We actually need the PLAYABLE url.
        // Since getLiveStream logic in server.dart is incomplete (it just returns room details),
        // we might not get the stream URL yet.
        // Assuming the 'data' field or 'link' field has m3u8 or flv.
        
        // For demonstration, let's assume 'link' is the hls url.
        // Real implementation needs to extract the actual play url from LiveRoom object returned by Sites.
        
        // console.log(data);
        
        // We will likely need to fetch the stream URL if it's not in the details.
        // For now, let's try to use data.link if available.
        
        const videoElement = document.getElementById('videoElement');
        const playerContainer = document.getElementById('player-container');
        
        playerContainer.classList.remove('hidden');
        
        // Destroy previous player instance if any
        if (window.flvPlayer) {
            window.flvPlayer.destroy();
            window.flvPlayer = null;
        }

        // Check if hls or flv
        // This logic depends on what the server returns.
        // This is a placeholder for logic.
        
        // if (url.endsWith('.flv')) { ... } else if (url.endsWith('.m3u8')) { ... }
        
        alert("Playback logic requires server implementation to return valid stream URL. Currently server returns: " + JSON.stringify(data));

    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function closePlayer() {
    const playerContainer = document.getElementById('player-container');
    const videoElement = document.getElementById('videoElement');
    playerContainer.classList.add('hidden');
    videoElement.pause();
    if (window.flvPlayer) {
        window.flvPlayer.destroy();
        window.flvPlayer = null;
    }
}

async function loadFavorites() {
    try {
        const res = await fetch(`${apiBase}/favorites`);
        const favorites = await res.json();
        const grid = document.getElementById('favorites-grid');
        grid.innerHTML = '';
        
        favorites.forEach(room => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${room.cover || 'placeholder.jpg'}" alt="${room.title}">
                <div class="card-content">
                    <div class="card-title">${room.title}</div>
                    <div class="card-subtitle">${room.nick} (${room.platform})</div>
                </div>
            `;
            card.onclick = () => {
                document.getElementById('platform-select').value = room.platform;
                document.getElementById('room-id-input').value = room.roomId;
                showSection('home');
                playStream(); // Auto play
            };
            grid.appendChild(card);
        });
    } catch (e) {
        console.error(e);
    }
}

async function saveCookie(platform) {
    const input = document.getElementById(`${platform}-cookie`);
    const cookie = input.value;
    
    await fetch(`${apiBase}/settings/cookie`, {
        method: 'POST',
        body: JSON.stringify({ platform, cookie })
    });
    alert('Saved');
}
