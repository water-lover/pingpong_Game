import { Player } from '../core/PingPongMatch.js'

/*
 * 价格体系（重构版）
 * 1000 → 樊振东 / 马龙 / 张继科
 * 900  → 王皓、瓦尔德内尔、王楚钦
 * 800  → 波尔、萨姆索诺夫、林昀儒、莫雷高德、
 *         张本智和、林诗栋、大勒布伦、小勒布伦
 * 700  → 奥恰洛夫、王励勤、马琳、松岛辉空、科曼
 * 600  → 丹羽孝溪、许昕、弗朗西斯卡、方博、林高远
 * 500  → 阿鲁纳、雨果、刘丁硕、哈基阔、哈基羊、骰子妈
 */

// Helper
function plainPlayer(name, stats) {
    return new Player(name, stats);
}

/** 三大初始分组（选一组作为建队基石） */
export const starterGroups = [
    {
        id: 'group_1', name: 'A组',
        players: [
            plainPlayer('樊振东', { serve: 92, receive: 95, forehand: 97, backhand: 97, rally: 99, stamina: 96, mentality: 100, price: 1000 }),
            plainPlayer('波尔', { serve: 93, receive: 95, forehand: 95, backhand: 97, rally: 98, stamina: 88, mentality: 96, price: 800 }),
            plainPlayer('莫雷高德', { serve: 88, receive: 93, forehand: 94, backhand: 85, rally: 96, stamina: 93, mentality: 82, price: 800 }),
        ]
    },
    {
        id: 'group_2', name: 'B组',
        players: [
            plainPlayer('马龙', { serve: 94, receive: 95, forehand: 100, backhand: 96, rally: 100, stamina: 92, mentality: 100, price: 1000 }),
            plainPlayer('奥恰洛夫', { serve: 92, receive: 91, forehand: 91, backhand: 95, rally: 93, stamina: 92, mentality: 92, price: 700 }),
            plainPlayer('萨姆索诺夫', { serve: 94, receive: 93, forehand: 98, backhand: 90, rally: 98, stamina: 88, mentality: 98, price: 800 }),
        ]
    },
    {
        id: 'group_3', name: 'C组',
        players: [
            plainPlayer('张继科', { serve: 92, receive: 96, forehand: 97, backhand: 100, rally: 98, stamina: 94, mentality: 100, price: 1000 }),
            plainPlayer('王皓', { serve: 94, receive: 93, forehand: 97, backhand: 96, rally: 96, stamina: 88, mentality: 92, price: 900 }),
            plainPlayer('马琳', { serve: 99, receive: 96, forehand: 95, backhand: 82, rally: 82, stamina: 80, mentality: 95, price: 700 }),
        ]
    }
];

/** 饭圈队 —— 固定5人，不参与任何选秀 */
export const fanTeamRoster = [
    plainPlayer('王楚钦', { serve: 100, receive: 98, forehand: 94, backhand: 94, rally: 87, stamina: 96, mentality: 96, price: 900 }),
    plainPlayer('刘国梁', { serve: 100, receive: 96, forehand: 85, backhand: 85, rally: 75, stamina: 80, mentality: 97, price: 800 }),
    plainPlayer('刘丁硕', { serve: 78, receive: 78, forehand: 80, backhand: 80, rally: 82, stamina: 94, mentality: 78, price: 500 }),
    plainPlayer('松岛辉空', { serve: 95, receive: 91, forehand: 91, backhand: 93, rally: 92, stamina: 95, mentality: 90, price: 700 }),
    plainPlayer('骰子妈', { serve: 76, receive: 76, forehand: 76, backhand: 76, rally: 76, stamina: 90, mentality: 90, price: 500 }),
];

/** 完整可分配球员池（饭圈队5人不在此）*/
export const getFullPlayerPool = () => {
    const pool = [];

    // 三组初始球员（合并成一个大池）
    starterGroups.forEach(g => {
        g.players.forEach(p => {
            if (!pool.find(x => x.name === p.name)) {
                pool.push(plainPlayer(p.name, { ...p.stats }));
            }
        });
    });

    // 自由市场（全部放入）
    const freePlayers = [
        // ═══ 900 ═══
        plainPlayer('瓦尔德内尔', { serve: 96, receive: 94, forehand: 93, backhand: 94, rally: 99, stamina: 90, mentality: 98, price: 900 }),

        // ═══ 800 ═══
        plainPlayer('林昀儒', { serve: 97, receive: 97, forehand: 89, backhand: 99, rally: 89, stamina: 97, mentality: 97, price: 800 }),
        plainPlayer('张本智和', { serve: 94, receive: 92, forehand: 92, backhand: 97, rally: 93, stamina: 98, mentality: 95, price: 800 }),
        plainPlayer('林诗栋', { serve: 94, receive: 93, forehand: 94, backhand: 96, rally: 92, stamina: 96, mentality: 89, price: 800 }),
        plainPlayer('大勒布伦', { serve: 93, receive: 93, forehand: 93, backhand: 93, rally: 93, stamina: 95, mentality: 91, price: 800 }),
        plainPlayer('小勒布伦', { serve: 93, receive: 93, forehand: 93, backhand: 93, rally: 93, stamina: 95, mentality: 91, price: 800 }),

        // ═══ 700 ═══
        plainPlayer('王励勤', { serve: 86, receive: 90, forehand: 98, backhand: 84, rally: 96, stamina: 96, mentality: 92, price: 700 }),
        plainPlayer('科曼', { serve: 90, receive: 91, forehand: 92, backhand: 93, rally: 91, stamina: 94, mentality: 90, price: 700 }),

        // ═══ 600 ═══
        plainPlayer('丹羽孝溪', { serve: 90, receive: 90, forehand: 90, backhand: 90, rally: 90, stamina: 80, mentality: 100, price: 600 }),
        plainPlayer('许昕', { serve: 92, receive: 83, forehand: 98, backhand: 74, rally: 91, stamina: 92, mentality: 80, price: 600 }),
        plainPlayer('弗朗西斯卡', { serve: 76, receive: 84, forehand: 91, backhand: 91, rally: 91, stamina: 88, mentality: 82, price: 600 }),
        plainPlayer('方博', { serve: 90, receive: 82, forehand: 96, backhand: 82, rally: 88, stamina: 90, mentality: 74, price: 600 }),
        plainPlayer('林高远', { serve: 91, receive: 91, forehand: 94, backhand: 96, rally: 89, stamina: 96, mentality: 84, price: 600 }),

        // ═══ 500 ═══
        plainPlayer('阿鲁纳', { serve: 80, receive: 80, forehand: 92, backhand: 80, rally: 92, stamina: 96, mentality: 86, price: 500 }),
        plainPlayer('雨果', { serve: 86, receive: 82, forehand: 90, backhand: 90, rally: 91, stamina: 90, mentality: 88, price: 500 }),
        plainPlayer('哈基阔', { serve: 94, receive: 72, forehand: 74, backhand: 74, rally: 72, stamina: 95, mentality: 92, price: 500 }),
        plainPlayer('哈基羊', { serve: 74, receive: 74, forehand: 74, backhand: 74, rally: 70, stamina: 98, mentality: 96, price: 500 }),
    ];

    freePlayers.forEach(p => {
        if (!pool.find(x => x.name === p.name)) {
            pool.push(p);
        }
    });

    return pool;
};

/** 蛇形均衡分配剩余球员给AI队伍 */
export function snakeDraftToAITeams(remainingPool, teamIds) {
    // teamIds: 要分配的队伍ID列表（不含饭圈队和玩家队）
    // 返回: { teamId: [players] }
    
    // 按身价从高到低排序
    const sorted = [...remainingPool].sort((a, b) => b.stats.price - a.stats.price);
    
    const result = {};
    teamIds.forEach(id => { result[id] = []; });
    
    let teamIndex = 0;
    let direction = 1; // 1=正向, -1=反向
    const totalTeams = teamIds.length;
    
    sorted.forEach((player, i) => {
        result[teamIds[teamIndex]].push(player);
        teamIndex += direction;
        if (teamIndex >= totalTeams) {
            teamIndex = totalTeams - 1;
            direction = -1;
        } else if (teamIndex < 0) {
            teamIndex = 0;
            direction = 1;
        }
    });
    
    return result;
}
