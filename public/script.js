// ============================================
//   STALK MEDIA — Script
// ============================================

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=0a1628&color=60a5fa&name=User&bold=true';

let currentPlatform = 'tiktok';

const platformConfig = {
    tiktok: {
        icon: 'fa-brands fa-tiktok',
        color: '#fff',
        stats: ['Followers', 'Following', 'Likes'],
        tips: 'Profile Pic HD · Follower Stats · Bio',
        map: (d) => ({
            avatar: d.avatarLarger || d.avatarMedium || DEFAULT_AVATAR,
            name: d.nickname || d.uniqueId || 'TikTok User',
            username: d.uniqueId || '-',
            bio: d.signature || 'No bio available.',
            link: `https://tiktok.com/@${d.uniqueId}`,
            verified: d.verified,
            s1: d.stats?.followerCount || 0,
            s2: d.stats?.followingCount || 0,
            s3: d.stats?.heartCount || 0
        })
    },
    instagram: {
        icon: 'fa-brands fa-instagram',
        color: '#e1306c',
        stats: ['Followers', 'Following', 'Posts'],
        tips: 'Posts Count · Bio · Verified Status',
        map: (d) => ({
            avatar: d.profile_pic || DEFAULT_AVATAR,
            name: d.nickname || d.username,
            username: d.username,
            bio: d.bio || 'No bio.',
            link: `https://instagram.com/${d.username}`,
            verified: d.is_verified,
            s1: d.stats?.followers || 0,
            s2: d.stats?.following || 0,
            s3: d.stats?.posts || 0
        })
    },
    github: {
        icon: 'fa-brands fa-github',
        color: '#aaa',
        stats: ['Followers', 'Following', 'Repos'],
        tips: 'Public Repos · Bio · Company',
        map: (d) => ({
            avatar: d.profile_pic || DEFAULT_AVATAR,
            name: d.nickname || d.username,
            username: d.username,
            bio: d.bio || 'No bio.',
            link: d.url,
            verified: false,
            s1: d.stats?.followers || 0,
            s2: d.stats?.following || 0,
            s3: d.stats?.repos || 0
        })
    },
    twitter: {
        icon: 'fa-brands fa-twitter',
        color: '#1da1f2',
        stats: ['Followers', 'Following', 'Tweets'],
        tips: 'Tweets Count · Verified · Bio',
        map: (d) => ({
            avatar: d.profile_pic || DEFAULT_AVATAR,
            name: d.nickname || d.username,
            username: d.username,
            bio: d.bio || 'No bio.',
            link: `https://x.com/${d.username}`,
            verified: d.is_verified,
            s1: d.stats?.followers || 0,
            s2: d.stats?.following || 0,
            s3: d.stats?.tweets || 0
        })
    },
    youtube: {
        icon: 'fa-brands fa-youtube',
        color: '#ff0000',
        stats: ['Subscribers', 'Videos', 'Views'],
        tips: 'Subscribers · Video Count · Channel Info',
        map: (d) => ({
            avatar: d.profile_pic || DEFAULT_AVATAR,
            name: d.nickname || d.username,
            username: d.username,
            bio: d.bio || 'No bio.',
            link: `https://youtube.com/@${d.username}`,
            verified: true,
            s1: d.stats?.subscribers || '0',
            s2: d.stats?.videos || '0',
            s3: d.stats?.views || '0'
        })
    },
    pinterest: {
        icon: 'fa-brands fa-pinterest',
        color: '#e60023',
        stats: ['Followers', 'Following', 'Pins'],
        tips: 'Saved Pins · Boards · Bio',
        map: (d) => ({
            avatar: d.profile_pic || DEFAULT_AVATAR,
            name: d.nickname || d.username,
            username: d.username,
            bio: d.bio || 'No bio.',
            link: `https://pinterest.com/${d.username}`,
            verified: d.is_verified,
            s1: d.stats?.followers || 0,
            s2: d.stats?.following || 0,
            s3: d.stats?.pins || 0
        })
    },
    roblox: {
        icon: 'fa-solid fa-gamepad',
        color: '#ff4444',
        stats: ['Friends', 'Followers', 'Following'],
        tips: 'Avatar Headshot · Friends Count · Bio',
        map: (d) => ({
            avatar: d.profile_pic || DEFAULT_AVATAR,
            name: d.nickname || d.username,
            username: d.username,
            bio: d.bio || 'No bio.',
            link: d.url,
            verified: false,
            s1: d.stats?.friends || 0,
            s2: d.stats?.followers || 0,
            s3: d.stats?.following || 0
        })
    }
};

// ---- PLATFORM DROPDOWN ----
const trigger = document.getElementById('platformTrigger');
const options = document.getElementById('platformOptions');
const arrow = document.getElementById('dropdownArrow');

trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = options.classList.contains('open');
    isOpen ? closeDropdown() : openDropdown();
});

function openDropdown() {
    options.classList.add('open');
    trigger.classList.add('open');
}
function closeDropdown() {
    options.classList.remove('open');
    trigger.classList.remove('open');
}

document.addEventListener('click', () => closeDropdown());

document.querySelectorAll('.platform-option').forEach(opt => {
    opt.addEventListener('click', function (e) {
        e.stopPropagation();
        const val = this.dataset.value;
        const iconClass = this.dataset.icon;
        const text = this.innerText.trim();

        currentPlatform = val;
        document.getElementById('selectedText').innerText = text;
        document.getElementById('selectedIcon').innerHTML = `<i class="${iconClass}" style="color:${this.dataset.color}"></i>`;

        resetResult();
        closeDropdown();
    });
});

// ---- PASTE ----
async function pasteInput() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('usernameInput').value = text.replace('@', '').trim();
    } catch (e) {}
}

// ---- FORMAT NUMBER ----
function formatNumber(num) {
    if (!num) return '0';
    if (typeof num === 'string') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ---- STALK ----
async function doStalk() {
    const username = document.getElementById('usernameInput').value.replace('@', '').trim();
    if (!username) {
        shakeInput();
        return;
    }

    setLoading(true);
    resetResult();

    try {
        const res = await fetch(`/api/stalk?type=${currentPlatform}&username=${encodeURIComponent(username)}`);
        const json = await res.json();

        if (!json.status) throw new Error(json.error || 'User not found');

        const cfg = platformConfig[currentPlatform];
        const d = cfg.map(json.data);

        // Platform badge
        document.getElementById('resPlatformIcon').className = cfg.icon;
        document.getElementById('resPlatformIcon').style.color = cfg.color;
        document.getElementById('resPlatformName').innerText = currentPlatform.toUpperCase();

        // Profile
        const avatarEl = document.getElementById('resAvatar');
        avatarEl.src = d.avatar;
        avatarEl.onerror = () => { avatarEl.src = DEFAULT_AVATAR; };

        document.getElementById('resNickname').innerText = d.name;
        document.getElementById('resUsername').innerText = '@' + d.username;
        document.getElementById('resUsername').href = d.link;
        document.getElementById('resBio').innerText = d.bio;
        document.getElementById('resLink').href = d.link;

        // Verified
        d.verified
            ? document.getElementById('resVerified').classList.remove('hidden')
            : document.getElementById('resVerified').classList.add('hidden');

        // Stats
        document.getElementById('lblStat1').innerText = cfg.stats[0];
        document.getElementById('valStat1').innerText = formatNumber(d.s1);
        document.getElementById('lblStat2').innerText = cfg.stats[1];
        document.getElementById('valStat2').innerText = formatNumber(d.s2);
        document.getElementById('lblStat3').innerText = cfg.stats[2];
        document.getElementById('valStat3').innerText = formatNumber(d.s3);

        // Show result
        document.getElementById('result').classList.remove('hidden');
        document.getElementById('error-msg').classList.add('hidden');

        // Scroll to result
        setTimeout(() => {
            document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (err) {
        document.getElementById('error-text').innerText = err.message || 'Failed to fetch profile.';
        document.getElementById('error-msg').classList.remove('hidden');
        document.getElementById('result').classList.add('hidden');
    } finally {
        setLoading(false);
    }
}

function resetResult() {
    document.getElementById('result').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');
}

function setLoading(state) {
    const btn = document.getElementById('stalkBtn');
    const loading = document.getElementById('loading');
    if (state) {
        btn.disabled = true;
        btn.querySelector('.btn-text').innerText = 'Stalking...';
        loading.classList.remove('hidden');
    } else {
        btn.disabled = false;
        btn.querySelector('.btn-text').innerText = 'Stalk Profile';
        loading.classList.add('hidden');
    }
}

function shakeInput() {
    const input = document.getElementById('usernameInput');
    input.style.animation = 'none';
    input.offsetHeight;
    input.style.animation = 'shake 0.4s ease';
    input.style.borderColor = 'rgba(239,68,68,0.6)';
    setTimeout(() => { input.style.borderColor = ''; }, 1000);
}

// ---- ENTER KEY ----
document.getElementById('usernameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doStalk();
});

// ---- NAVBAR SCROLL ----
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    const scrollBtns = document.getElementById('scrollBtns');
    navbar.classList.toggle('scrolled', window.scrollY > 20);
    scrollBtns.classList.toggle('visible', window.scrollY > 200);
});

// ---- SCROLL HELPERS ----
function smoothScrollTo(pos) {
    if (pos === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

// ---- REVEAL ON SCROLL ----
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---- SHAKE KEYFRAME ----
const styleSheet = document.createElement('style');
styleSheet.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`;
document.head.appendChild(styleSheet);
