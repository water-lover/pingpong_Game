import { Player } from '../core/PingPongMatch.js'

/*
 * 价格体系说明：
 * 1000 → 樊振东(#1) / 张继科/马龙(第2档最强)
 * 900  → 瓦尔德内尔、王皓
 * 800  → 莫雷高德、萨姆索诺夫、马琳、王楚钦、
 *         张本智和、林昀儒、林诗栋、勒布伦兄弟、波尔、科曼
 * 700  → 奥恰洛夫、王励勤、刘国梁
 * 600  → 雨果、松岛辉空、丹羽孝溪、许昕、林高远
 * 500  → 弗朗西斯卡、方博
 * 400  → 阿鲁纳
 * 300  → 刘丁硕
 * 200  → 哈基阔
 * 100  → 哈基羊
 */

export const freeAgentsPool = [
    // ═══ Price 1000 — 第一梯队 ═══
    new plainPlayer('樊振东', { serve: 92, receive: 96, forehand: 98, backhand: 98, rally: 100, stamina: 95, mentality: 100, price: 1000 }),
    new plainPlayer('张继科', { serve: 91, receive: 92, forehand: 96, backhand: 100, rally: 98, stamina: 90, mentality: 98, price: 1000 }),
    new plainPlayer('马龙', { serve: 92, receive: 93, forehand: 100, backhand: 92, rally: 99, stamina: 85, mentality: 100, price: 1000 }),

    // ═══ Price 900 ═══
    new plainPlayer('瓦尔德内尔', { serve: 92, receive: 93, forehand: 91, backhand: 90, rally: 98, stamina: 88, mentality: 95, price: 900 }),
    new plainPlayer('王皓', { serve: 94, receive: 93, forehand: 97, backhand: 96, rally: 96, stamina: 88, mentality: 92, price: 900 }),

    // ═══ Price 800 ═══
    new plainPlayer('莫雷高德', { serve: 82, receive: 90, forehand: 92, backhand: 72, rally: 95, stamina: 93, mentality: 72, price: 800 }),
    new plainPlayer('萨姆索诺夫', { serve: 94, receive: 93, forehand: 98, backhand: 90, rally: 98, stamina: 88, mentality: 98, price: 800 }),
    new plainPlayer('马琳', { serve: 100, receive: 98, forehand: 97, backhand: 82, rally: 82, stamina: 80, mentality: 96, price: 800 }),
    new plainPlayer('波尔', { serve: 93, receive: 93, forehand: 95, backhand: 95, rally: 97, stamina: 88, mentality: 95, price: 800 }),
    new plainPlayer('科曼', { serve: 92, receive: 93, forehand: 93, backhand: 96, rally: 93, stamina: 97, mentality: 92, price: 800 }),

    // ═══ Price 700 ═══
    new plainPlayer('奥恰洛夫', { serve: 92, receive: 92, forehand: 91, backhand: 97, rally: 95, stamina: 93, mentality: 93, price: 700 }),
    new plainPlayer('王励勤', { serve: 86, receive: 90, forehand: 100, backhand: 82, rally: 99, stamina: 98, mentality: 94, price: 700 }),

    // ═══ Price 600 ═══
    new plainPlayer('雨果', { serve: 90, receive: 85, forehand: 94, backhand: 94, rally: 95, stamina: 93, mentality: 90, price: 600 }),
    new plainPlayer('松岛辉空', { serve: 96, receive: 90, forehand: 90, backhand: 97, rally: 93, stamina: 97, mentality: 90, price: 600 }),
    new plainPlayer('丹羽孝溪', { serve: 90, receive: 90, forehand: 90, backhand: 90, rally: 90, stamina: 80, mentality: 100, price: 600 }),
    // 升级组: 500→600
    new plainPlayer('许昕', { serve: 92, receive: 83, forehand: 98, backhand: 74, rally: 91, stamina: 92, mentality: 80, price: 600 }),
    new plainPlayer('林高远', { serve: 91, receive: 91, forehand: 94, backhand: 96, rally: 89, stamina: 96, mentality: 82, price: 600 }),

    // ═══ Price 500 ═══
    new plainPlayer('弗朗西斯卡', { serve: 72, receive: 82, forehand: 90, backhand: 90, rally: 90, stamina: 88, mentality: 80, price: 500 }),
    new plainPlayer('方博', { serve: 90, receive: 82, forehand: 96, backhand: 82, rally: 88, stamina: 90, mentality: 72, price: 500 }),

    // ═══ Price 400 ═══
    new plainPlayer('阿鲁纳', { serve: 80, receive: 80, forehand: 96, backhand: 80, rally: 96, stamina: 98, mentality: 88, price: 400 }),

    // ═══ Price 200 ═══
    new plainPlayer('哈基阔', { serve: 100, receive: 70, forehand: 72, backhand: 72, rally: 70, stamina: 98, mentality: 98, price: 200 }),
];

// Helper to create Player instances
function plainPlayer(name, stats) {
    return new Player(name, stats);
}

// AI 队伍（数值与自由市场同步，isCore=true 的核心球员不可被强挖）
function corePlayer(name, stats) {
    const p = new Player(name, stats);
    p.isCore = true;
    return p;
}

export const leagueAICaching = [
    {
        id: 'team_jp',
        name: '饭圈队',
        wins: 0,
        losses: 0,
        gold: 1000,
        players: [
            corePlayer('王楚钦', { serve: 100, receive: 98, forehand: 92, backhand: 92, rally: 82, stamina: 95, mentality: 94, price: 800 }),
            corePlayer('刘国梁', { serve: 100, receive: 96, forehand: 82, backhand: 82, rally: 72, stamina: 78, mentality: 96, price: 700 }),
            corePlayer('刘丁硕', { serve: 70, receive: 70, forehand: 70, backhand: 70, rally: 80, stamina: 90, mentality: 70, price: 300 }),
        ]
    },
    {
        id: 'team_eu',
        name: '黑马队',
        wins: 0,
        losses: 0,
        gold: 1000,
        players: [
            corePlayer('张本智和', { serve: 93, receive: 92, forehand: 90, backhand: 97, rally: 92, stamina: 98, mentality: 97, price: 800 }),
            corePlayer('林昀儒', { serve: 97, receive: 97, forehand: 87, backhand: 99, rally: 87, stamina: 96, mentality: 97, price: 800 }),
            corePlayer('林诗栋', { serve: 94, receive: 94, forehand: 93, backhand: 96, rally: 92, stamina: 97, mentality: 86, price: 800 }),
        ]
    },
    {
        id: 'team_na',
        name: '新星队',
        wins: 0,
        losses: 0,
        gold: 1000,
        players: [
            corePlayer('大勒布伦', { serve: 91, receive: 91, forehand: 91, backhand: 91, rally: 91, stamina: 95, mentality: 91, price: 800 }),
            corePlayer('小勒布伦', { serve: 90, receive: 91, forehand: 90, backhand: 95, rally: 92, stamina: 95, mentality: 90, price: 800 }),
            corePlayer('科曼', { serve: 92, receive: 93, forehand: 93, backhand: 96, rally: 93, stamina: 97, mentality: 92, price: 800 }),
            corePlayer('哈基羊', { serve: 70, receive: 70, forehand: 70, backhand: 70, rally: 60, stamina: 100, mentality: 100, price: 100 }),
        ]
    }
];

export function generateRandomPlayer() {
    const names = ['风暴', '闪电', '狂龙', '铁壁', '幽灵', '魔王', '新星', '黑马'];
    const surnames = ['张', '李', '孙', '周', '吴', '郑', '王', '刘', '陈', '林'];
    const name = surnames[Math.floor(Math.random() * surnames.length)] + names[Math.floor(Math.random() * names.length)];
    const randStat = () => Math.floor(Math.random() * 20) + 75; // 75-94
    return new Player(name, {
        serve: randStat(),
        receive: randStat(),
        forehand: randStat(),
        backhand: randStat(),
        rally: randStat(),
        stamina: Math.floor(Math.random() * 15) + 80,
        mentality: randStat(),
        price: Math.floor(Math.random() * 500) + 500
    });
}