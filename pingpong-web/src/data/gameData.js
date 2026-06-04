import { Player } from '../core/PingPongMatch.js'

/*
 * 价格体系（已更新 2026-05-28）：
 * 1000 → 樊振东(#1) / 张继科/马龙(第2档最强)
 * 900  → 瓦尔德内尔、王皓、王楚钦
 * 800  → 莫雷高德、萨姆索诺夫、马琳、波尔、刘国梁、
 *         张本智和、林昀儒、林诗栋、勒布伦兄弟、科曼
 * 700  → 奥恰洛夫、王励勤
 * 600  → 雨果、松岛辉空、丹羽孝溪、许昕、林高远
 * 500  → 弗朗西斯卡、方博
 * 400  → 阿鲁纳
 * 300  → 刘丁硕
 * 200  → 哈基阔
 * 100  → 哈基羊
 */

// Helper
function plainPlayer(name, stats) {
    return new Player(name, stats);
}
function corePlayer(name, stats) {
    const p = new Player(name, stats);
    p.isCore = true;
    return p;
}

/** 三大初始分组 */
export const starterGroups = [
    {
        id: 'group_1', name: 'A组',
        players: [
            // 樊振东小幅削弱(仍最强)
            plainPlayer('樊振东', { serve: 90, receive: 94, forehand: 96, backhand: 96, rally: 98, stamina: 95, mentality: 100, price: 1000 }),
            plainPlayer('波尔', { serve: 93, receive: 95, forehand: 95, backhand: 97, rally: 98, stamina: 88, mentality: 96, price: 800 }),
            plainPlayer('莫雷高德', { serve: 86, receive: 92, forehand: 93, backhand: 80, rally: 96, stamina: 94, mentality: 78, price: 800 }),
        ]
    },
    {
        id: 'group_2', name: 'B组',
        players: [
            plainPlayer('马龙', { serve: 94, receive: 95, forehand: 100, backhand: 96, rally: 100, stamina: 92, mentality: 100, price: 1000 }),
            plainPlayer('奥恰洛夫', { serve: 92, receive: 92, forehand: 91, backhand: 95, rally: 95, stamina: 93, mentality: 93, price: 700 }),
            plainPlayer('萨姆索诺夫', { serve: 94, receive: 93, forehand: 98, backhand: 90, rally: 98, stamina: 88, mentality: 98, price: 800 }),
        ]
    },
    {
        id: 'group_3', name: 'C组',
        players: [
            plainPlayer('张继科', { serve: 91, receive: 96, forehand: 97, backhand: 100, rally: 98, stamina: 94, mentality: 100, price: 1000 }),
            plainPlayer('王皓', { serve: 94, receive: 93, forehand: 97, backhand: 96, rally: 96, stamina: 88, mentality: 92, price: 900 }),
            plainPlayer('马琳', { serve: 100, receive: 98, forehand: 97, backhand: 82, rally: 82, stamina: 80, mentality: 96, price: 800 }),
        ]
    }
];

/** 自由市场（不含三大分组的球员，不含AI球队核心球员） */
export const freeAgentsPool = [
    // ═══ Price 900 ═══
    plainPlayer('瓦尔德内尔', { serve: 96, receive: 94, forehand: 93, backhand: 94, rally: 99, stamina: 90, mentality: 98, price: 900 }),

    // ═══ Price 800 ═══
    // （AI球队核心：王楚钦、刘国梁、张本智和、林昀儒、林诗栋、勒布伦兄弟、科曼 — 非卖品，不在自由市场）

    // ═══ Price 700 ═══
    plainPlayer('王励勤', { serve: 86, receive: 90, forehand: 100, backhand: 82, rally: 99, stamina: 98, mentality: 94, price: 700 }),

    // ═══ Price 600 ═══
    plainPlayer('雨果', { serve: 90, receive: 85, forehand: 94, backhand: 94, rally: 95, stamina: 93, mentality: 90, price: 600 }),
    plainPlayer('松岛辉空', { serve: 96, receive: 90, forehand: 90, backhand: 95, rally: 93, stamina: 97, mentality: 90, price: 600 }),
    plainPlayer('丹羽孝溪', { serve: 90, receive: 90, forehand: 90, backhand: 90, rally: 90, stamina: 80, mentality: 100, price: 600 }),
    plainPlayer('许昕', { serve: 92, receive: 83, forehand: 98, backhand: 74, rally: 91, stamina: 92, mentality: 80, price: 600 }),
    plainPlayer('林高远', { serve: 91, receive: 91, forehand: 94, backhand: 96, rally: 89, stamina: 96, mentality: 82, price: 600 }),

    // ═══ Price 500 ═══
    plainPlayer('弗朗西斯卡', { serve: 72, receive: 82, forehand: 90, backhand: 90, rally: 90, stamina: 88, mentality: 80, price: 500 }),
    plainPlayer('方博', { serve: 90, receive: 82, forehand: 96, backhand: 82, rally: 88, stamina: 90, mentality: 72, price: 500 }),

    // ═══ Price 400 ═══
    plainPlayer('阿鲁纳', { serve: 80, receive: 80, forehand: 94, backhand: 80, rally: 94, stamina: 98, mentality: 88, price: 400 }),

    // ═══ Price 200 ═══
    plainPlayer('哈基阔', { serve: 95, receive: 70, forehand: 72, backhand: 72, rally: 70, stamina: 98, mentality: 98, price: 200 }),

    // ═══ Price 100 ═══
    plainPlayer('哈基羊', { serve: 70, receive: 70, forehand: 70, backhand: 70, rally: 60, stamina: 100, mentality: 100, price: 100 }),
];

// AI 队伍定义
export const leagueAICaching = [
    {
        id: 'team_jp', name: '饭圈队', wins: 0, losses: 0, gold: 1500,
        players: [
            corePlayer('王楚钦', { serve: 100, receive: 98, forehand: 94, backhand: 94, rally: 87, stamina: 96, mentality: 96, price: 900 }),
            corePlayer('刘国梁', { serve: 100, receive: 96, forehand: 85, backhand: 85, rally: 75, stamina: 80, mentality: 97, price: 800 }),
            corePlayer('刘丁硕', { serve: 70, receive: 70, forehand: 70, backhand: 70, rally: 80, stamina: 90, mentality: 70, price: 300 }),
        ]
    },
    {
        id: 'team_eu', name: '黑马队', wins: 0, losses: 0, gold: 1500,
        players: [
            corePlayer('张本智和', { serve: 94, receive: 92, forehand: 92, backhand: 97, rally: 93, stamina: 98, mentality: 97, price: 800 }),
            corePlayer('林昀儒', { serve: 97, receive: 97, forehand: 89, backhand: 99, rally: 89, stamina: 97, mentality: 97, price: 800 }),
            corePlayer('林诗栋', { serve: 95, receive: 95, forehand: 93, backhand: 97, rally: 92, stamina: 97, mentality: 88, price: 800 }),
        ]
    },
    {
        id: 'team_na', name: '新星队', wins: 0, losses: 0, gold: 1500,
        players: [
            corePlayer('大勒布伦', { serve: 92, receive: 92, forehand: 92, backhand: 92, rally: 92, stamina: 96, mentality: 91, price: 800 }),
            corePlayer('小勒布伦', { serve: 91, receive: 91, forehand: 91, backhand: 96, rally: 92, stamina: 95, mentality: 90, price: 800 }),
            corePlayer('科曼', { serve: 89, receive: 90, forehand: 91, backhand: 94, rally: 91, stamina: 95, mentality: 90, price: 800 }),
        ]
    }
];