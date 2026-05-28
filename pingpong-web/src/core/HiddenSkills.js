/**
 * 球员隐藏技能 / 特殊天赋系统
 * 
 * 每个技能在比赛不同阶段触发，提供小幅加成
 * 参考 GDD 创意板块
 */

export const SKILLS = {
    /** 樊振东: 王者之心 — 常驻全属性+5%，关键分额外+8%，决胜局额外+5% */
    王者之心: {
        name: '王者之心',
        desc: '常驻全属性+4%，关键分再+6%',
        onBeforeCalc(player) {
            player.stats.serve += 4;
            player.stats.receive += 4;
            player.stats.forehand += 4;
            player.stats.backhand += 4;
            player.stats.rally += 4;
        },
        onClutch(player, baseStrength) { return baseStrength * 1.06; },
        onDeciding(player, baseStrength) { return baseStrength * 1.04; }
    },

    /** 马龙: 六边形战士 — 全属性保底88，相持阶段+3% */
    六边形战士: {
        name: '六边形战士',
        desc: '全属性保底92，相持+6',
        onBeforeCalc(player) {
            const stats = player.stats;
            stats.serve = Math.max(92, stats.serve);
            stats.receive = Math.max(92, stats.receive);
            stats.forehand = Math.max(92, stats.forehand);
            stats.backhand = Math.max(92, stats.backhand);
            stats.rally = Math.max(92, stats.rally);
            player.currentMentality = Math.max(player.stats.mentality * 0.92, player.currentMentality);
        },
        onRally(player, baseStrength) { return baseStrength + 6; }
    },

    /** 张继科: 藏獒觉醒 — 落后时爆发+10%，反手+2常驻 */
    藏獒觉醒: {
        name: '藏獒觉醒',
        desc: '落后时+10%，反手+2',
        onComeback(player, baseStrength) { return baseStrength * 1.10; },
        onBeforeCalc(player) {
            player.stats.backhand += 2;
        }
    },

    /** 王楚钦: 发球鬼才 — 发球轮全属性+3% */
    发球鬼才: {
        name: '发球鬼才',
        desc: '发球轮全属性+3%',
        onServe(player, baseStrength) { return baseStrength * 1.03; }
    },

    /** 刘国梁: 智多星 — 战术切换后第一局全属性+5% */
    智多星: {
        name: '智多星',
        desc: '战术切换后首局+5%',
        onTacticChange(player, baseStrength) { return baseStrength * 1.05; }
    },

    /** 马琳: 战术大师 — 前三板和死盯落点战术效果+30% */
    战术大师: {
        name: '战术大师',
        desc: '前三板/死盯落点战术+30%效果',
        onTacticBoost(tacticId, baseStrength) {
            if (tacticId === 'first_three' || tacticId === 'target_weakness') {
                return baseStrength * 1.30;
            }
            return baseStrength;
        }
    },

    /** 许昕: 神仙球 — 相持阶段有8%概率无视差距直接得分 */
    神仙球: {
        name: '神仙球',
        desc: '相持阶段8%概率神仙球得分',
        onMagicShot() { return Math.random() < 0.08; }
    },

    /** 王励勤: 大力神 — 正手+5，体能消耗减半 */
    大力神: {
        name: '大力神',
        desc: '正手+5，体能消耗减半',
        onStaminaCost(cost) { return cost * 0.5; }
    },

    /** 张本智和: 嘶吼 — 每赢一分下分概率+1%(上限15%) */
    嘶吼: {
        name: '嘶吼',
        desc: '连续得分时气势如虹',
        onMomentum(player, consecutivePoints) {
            return consecutivePoints * 0.01;
        }
    },

    /** 林昀儒: 沉默刺客 — 反手+3，心态永不波动(始终100%) */
    沉默刺客: {
        name: '沉默刺客',
        desc: '反手+3，心态恒定',
        onBeforeCalc(player) {
            player.stats.backhand += 3;
            player.currentMentality = player.stats.mentality;
        }
    },

    /** 波尔: 欧洲之巅 — 欧洲技术流，接发+3，相持+4 */
    欧洲之巅: {
        name: '欧洲之巅',
        desc: '接发+3，相持+4',
        onBeforeCalc(player) {
            player.stats.receive += 3;
        },
        onRally(player, baseStrength) { return baseStrength + 4; }
    },

    /** 奥恰洛夫: 潜水艇 — 发球+5(诡异的发球动作) */
    潜水艇: {
        name: '潜水艇',
        desc: '发球+5',
        onBeforeCalc(player) {
            player.stats.serve += 5;
        }
    },

    /** 萨姆索诺夫: 太极 — 相持阶段+5 */
    太极: {
        name: '太极',
        desc: '相持+5',
        onRally(player, baseStrength) { return baseStrength + 5; }
    },

    /** 王皓: 直拍横打 — 反手视为正手计算 */
    直拍横打: {
        name: '直拍横打',
        desc: '反手获得正手加成',
        onBeforeCalc(player) {
            player.stats.backhand = Math.max(player.stats.backhand, player.stats.forehand - 3);
        }
    },

    /** 林高远: 极速 — +5 速度相关(接发/相持) */
    极速: {
        name: '极速',
        desc: '接发+5',
        onBeforeCalc(player) {
            player.stats.receive += 5;
        }
    },

    /** 莫雷高德: 怪球手 — 让对手极不适应，全属性-8% */
    怪球手: {
        name: '怪球手',
        desc: '对手全属性-8%',
        onConfuse(baseStrength) { return baseStrength * 0.92; }
    },

    /** 林诗栋: 快攻 — 正手+2 */
    快攻: {
        name: '快攻',
        desc: '正手+2',
        onBeforeCalc(player) {
            player.stats.forehand += 2;
        }
    },

    /** 大勒布伦: 双胞胎兄弟 — 全属性+2 */
    双胞胎兄: {
        name: '双胞胎兄',
        desc: '全属性+2',
        onBeforeCalc(player) {
            player.stats.serve += 2;
            player.stats.receive += 2;
            player.stats.forehand += 2;
            player.stats.backhand += 2;
            player.stats.rally += 2;
        }
    },

    /** 小勒布伦: 双胞胎兄弟 — 全属性+2 */
    双胞胎弟: {
        name: '双胞胎弟',
        desc: '全属性+2',
        onBeforeCalc(player) {
            player.stats.serve += 2;
            player.stats.receive += 2;
            player.stats.forehand += 2;
            player.stats.backhand += 2;
            player.stats.rally += 2;
        }
    },

    /** 科曼: 硬桥硬马 — 正反手均衡+2 */
    硬桥硬马: {
        name: '硬桥硬马',
        desc: '正反手+2',
        onBeforeCalc(player) {
            player.stats.forehand += 2;
            player.stats.backhand += 2;
        }
    },

    /** 刘丁硕: 铁人 — 体能消耗-30%，便宜又好用 */
    铁人: {
        name: '铁人',
        desc: '体能消耗-30%',
        onStaminaCost(cost) { return cost * 0.7; }
    },

    /** 弗朗西斯卡: 重炮 — 正手+4，反手-2 */
    重炮: {
        name: '重炮',
        desc: '正手+4，反手-2',
        onBeforeCalc(player) {
            player.stats.forehand += 4;
            player.stats.backhand = Math.max(60, player.stats.backhand - 2);
        }
    },

    /** 雨果: 全能战士 — 全属性不低于85 */
    全能战士: {
        name: '全能战士',
        desc: '全属性保底85',
        onBeforeCalc(player) {
            player.stats.serve = Math.max(85, player.stats.serve);
            player.stats.receive = Math.max(85, player.stats.receive);
            player.stats.forehand = Math.max(85, player.stats.forehand);
            player.stats.backhand = Math.max(85, player.stats.backhand);
            player.stats.rally = Math.max(85, player.stats.rally);
        }
    },

    /** 松岛辉空: 神童 — 接发+5 */
    神童: {
        name: '神童',
        desc: '接发+5',
        onBeforeCalc(player) {
            player.stats.receive += 5;
        }
    },

    /** 丹羽孝溪: 佛系 — 心态始终100%，但体能消耗+10% */
    佛系: {
        name: '佛系',
        desc: '心态恒定100%',
        onBeforeCalc(player) {
            player.currentMentality = 100;
        }
    },

    /** 方博: 拼命三郎 — 落后时+5% */
    拼命三郎: {
        name: '拼命三郎',
        desc: '落后时+5%',
        onComeback(player, baseStrength) { return baseStrength * 1.05; }
    },

    /** 阿鲁纳: 非洲雄狮 — 正手+5，体能+3 */
    非洲雄狮: {
        name: '非洲雄狮',
        desc: '正手+5，体能+3',
        onBeforeCalc(player) {
            player.stats.forehand += 5;
            player.stats.stamina += 3;
        }
    },

    /** 哈基阔: 发球怪 — 发球+5 */
    发球怪: {
        name: '发球怪',
        desc: '发球+5',
        onBeforeCalc(player) {
            player.stats.serve += 5;
        }
    },

    /** 哈基羊: 气氛组 — 心态+5，体能+3 */
    气氛组: {
        name: '气氛组',
        desc: '心态+5，体能+3',
        onBeforeCalc(player) {
            player.currentMentality = Math.min(100, player.currentMentality + 5);
            player.stats.stamina += 3;
        }
    },

    /** 瓦尔德内尔: 游击队长 — 每局随机切换战术，战术效果+8% */
    游击队长: {
        name: '游击队长',
        desc: '每局随机换战术，效果+8%',
        onTacticChange(player, baseStrength) { return baseStrength * 1.08; }
    }
};

/**
 * 获取球员的隐藏技能列表
 */
export function getPlayerSkills(playerName) {
    const skillMap = {
        '樊振东': ['王者之心'],
        '马龙': ['六边形战士'],
        '张继科': ['藏獒觉醒'],
        '王楚钦': ['发球鬼才'],
        '刘国梁': ['智多星'],
        '瓦尔德内尔': ['游击队长'],
        '马琳': ['战术大师'],
        '许昕': ['神仙球'],
        '王励勤': ['大力神'],
        '张本智和': ['嘶吼'],
        '林昀儒': ['沉默刺客'],
        '波尔': ['欧洲之巅'],
        '奥恰洛夫': ['潜水艇'],
        '萨姆索诺夫': ['太极'],
        '王皓': ['直拍横打'],
        '林高远': ['极速'],
        '莫雷高德': ['怪球手'],
        '林诗栋': ['快攻'],
        '大勒布伦': ['双胞胎兄'],
        '小勒布伦': ['双胞胎弟'],
        '科曼': ['硬桥硬马'],
        '刘丁硕': ['铁人'],
        '弗朗西斯卡': ['重炮'],
        '雨果': ['全能战士'],
        '松岛辉空': ['神童'],
        '丹羽孝溪': ['佛系'],
        '方博': ['拼命三郎'],
        '阿鲁纳': ['非洲雄狮'],
        '哈基阔': ['发球怪'],
        '哈基羊': ['气氛组'],
    };
    return skillMap[playerName] || [];
}
