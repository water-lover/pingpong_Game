import { SKILLS, getPlayerSkills } from './HiddenSkills.js'

export class Player {
    constructor(name, stats) {
        this.name = name;
        this.stats = {
            serve: stats.serve || 50,
            receive: stats.receive || 50,
            forehand: stats.forehand || 50,
            backhand: stats.backhand || 50,
            rally: stats.rally || 50,
            stamina: stats.stamina || 100,
            mentality: stats.mentality || 50,
            price: stats.price || Math.floor(Math.random() * 500) + 500,
        };
        this.teamId = stats.teamId || null;
        this.skills = getPlayerSkills(name);
        this._baseStats = { ...this.stats };

        // 体能消耗系数x —— 越强的球员x越低
        const price = this.stats.price;
        this.x = price >= 1000 ? 0.75 :
            price >= 900 ? 0.80 :
                price >= 800 ? 0.85 :
                    price >= 700 ? 0.90 :
                        price >= 600 ? 0.95 :
                            price >= 500 ? 1.00 :
                                price >= 400 ? 1.05 : 1.10;

        this.form = 1.0;
        this.consecutiveWins = 0;
        this.tacticChangedThisMatch = false;
        // 统计本盘使用过的战术
        this.usedTacticsInFixture = [];
        this.resetMatchStates();
    }

    resetMatchStates() {
        Object.assign(this.stats, this._baseStats);
        this.currentMentality = this.stats.mentality;
        this.currentTactic = 'normal';
        this.consecutiveWins = 0;
        this.usedTacticsInFixture = [];
        if (this.currentStamina === undefined) this.currentStamina = this.stats.stamina;
    }

    /** 记录一盘比赛中使用的战术 */
    recordTactic(tacticId) {
        if (!this.usedTacticsInFixture.includes(tacticId)) {
            this.usedTacticsInFixture.push(tacticId);
        }
    }

    /** 计算本盘比赛的体力消耗 */
    calcFixtureStaminaCost() {
        // 基础消耗10，根据战术调整
        const tactics = this.usedTacticsInFixture;
        let multiplier = 1.0;
        if (tactics.includes('aggressive') || tactics.includes('rally_focus')) multiplier = 1.5;
        else if (tactics.includes('first_three')) multiplier = 1.3;
        else if (tactics.includes('conservative')) multiplier = 0.8;

        return Math.round(10 * multiplier * this.x);
    }

    /** 应用一盘比赛的体力消耗 */
    applyFixtureStaminaCost() {
        const cost = this.calcFixtureStaminaCost();
        this.currentStamina = Math.max(0, this.currentStamina - cost);
    }

    /** 轮间体力恢复 —— 固定恢复10点 */
    roundRecovery() {
        this.currentStamina = Math.min(this.stats.stamina, this.currentStamina + 10);
    }

    rerollForm() {
        this.form = 0.88 + Math.random() * 0.24;
    }

    applyPassiveSkills() {
        Object.assign(this.stats, this._baseStats);
        this.currentMentality = this.stats.mentality;
        this.skills.forEach(skillId => {
            const skill = SKILLS[skillId];
            if (skill?.onBeforeCalc) skill.onBeforeCalc(this);
        });
    }
}

/**
 * 战术配置表 —— 每种战术影响属性权重与比赛风格
 */
const TACTICS = {
    normal: {
        label: '常规套路', weights: { serve: 0.18, receive: 0.18, forehand: 0.22, backhand: 0.22, rally: 0.20 },
        staCost: 0.9, rngRange: 14, rngShift: -7, serveBonus: 0, rallyBonus: 0, desc: '数值均衡，稳字当头'
    },
    aggressive: {
        label: '全线搏杀', weights: { serve: 0.10, receive: 0.10, forehand: 0.38, backhand: 0.22, rally: 0.20 },
        staCost: 2.0, rngRange: 34, rngShift: -17, serveBonus: 5, rallyBonus: 8, desc: '高风险高回报·易失误'
    },
    conservative: {
        label: '稳扎稳打', weights: { serve: 0.18, receive: 0.22, forehand: 0.15, backhand: 0.20, rally: 0.25 },
        staCost: 0.5, rngRange: 10, rngShift: -5, serveBonus: -2, rallyBonus: -3, desc: '防守反击，降低失误率'
    },
    target_backhand: {
        label: '死盯反手', weights: { serve: 0.12, receive: 0.12, forehand: 0.12, backhand: 0.44, rally: 0.20 },
        staCost: 0.9, rngRange: 14, rngShift: -7, serveBonus: 0, rallyBonus: 4, desc: '压制反手，专打软肋'
    },
    first_three: {
        label: '前三板', weights: { serve: 0.28, receive: 0.24, forehand: 0.18, backhand: 0.15, rally: 0.15 },
        staCost: 1.2, rngRange: 18, rngShift: -9, serveBonus: 8, rallyBonus: -10, desc: '强化发接发，削弱相持'
    },
    rally_focus: {
        label: '形成相持', weights: { serve: 0.08, receive: 0.08, forehand: 0.20, backhand: 0.20, rally: 0.44 },
        staCost: 0.6, rngRange: 12, rngShift: -6, serveBonus: -3, rallyBonus: 8, desc: '大幅依赖相持与体能'
    }
};

/** 所有战术ID列表，供AI随机选取 */
const TACTIC_IDS = Object.keys(TACTICS);

/**
 * 计算球员在当前战术下的加权综合实力
 */
function calcTacticStrength(player, role, isRallyPhase = false, vsPlayer = null) {
    const t = TACTICS[player.currentTactic] || TACTICS.normal;
    const w = t.weights;
    let base = player.stats.serve * w.serve + player.stats.receive * w.receive +
        player.stats.forehand * w.forehand + player.stats.backhand * w.backhand +
        player.stats.rally * w.rally;

    if (!isRallyPhase) {
        base += t.serveBonus;
        if (player.skills.includes('发球鬼才') && role.includes('server'))
            base = SKILLS['发球鬼才'].onServe(player, base);
    } else {
        base += t.rallyBonus;
        base += (role.includes('attacker') ? player.stats.forehand : player.stats.backhand) * 0.08;
        if (player.skills.includes('太极'))
            base = SKILLS['太极'].onRally(player, base);
    }

    if (player.skills.includes('战术大师'))
        base = SKILLS['战术大师'].onTacticBoost(player.currentTactic, base);
    if (player.skills.includes('智多星') && player.tacticChangedThisMatch)
        base = SKILLS['智多星'].onTacticChange(player, base);

    base *= player.form;
    base *= Math.max(0.75, player.currentStamina / Math.max(1, player.stats.stamina));

    if (role.includes('comeback') && player.skills.includes('藏獒觉醒'))
        base = SKILLS['藏獒觉醒'].onComeback(player, base);
    if (player.skills.includes('拼命三郎') && role.includes('comeback'))
        base = SKILLS['拼命三郎'].onComeback(player, base);
    if (role.includes('clutch') && player.skills.includes('王者之心'))
        base = SKILLS['王者之心'].onClutch(player, base);
    if (role.includes('deciding') && player.skills.includes('王者之心'))
        base = SKILLS['王者之心'].onDeciding(player, base);

    // 对手有怪球手时，减少我的能力
    if (vsPlayer && vsPlayer.skills.includes('怪球手')) {
        base = SKILLS['怪球手'].onConfuse(base);
    }

    // 双胞胎兄弟加成：同队时检查
    if (player.skills.includes('双胞胎兄') || player.skills.includes('双胞胎弟')) {
        // 注意：此技能在TeamMatch层面处理，这里跳过避免重复
    }

    base *= (0.85 + 0.15 * (player.currentMentality / Math.max(1, player.stats.mentality)));
    return base;
}

function getRNG(tid) {
    const t = TACTICS[tid] || TACTICS.normal;
    return Math.random() * t.rngRange + t.rngShift;
}

function getStaminaCost(player, mult) {
    let c = TACTICS[player.currentTactic].staCost * mult * 0.15;
    if (player.skills.includes('大力神')) c = SKILLS['大力神'].onStaminaCost(c);
    if (player.skills.includes('常青树')) c = SKILLS['常青树'].onStaminaCost(c);
    return c;
}

export class GameMatch {
    constructor(playerA, playerB) {
        this.playerA = playerA;
        this.playerB = playerB;
        this.scoreA = 0;
        this.scoreB = 0;
        this.turn = 'A';
        this.serveCount = 0;
        this.isFinished = false;
        this.winner = null;
        this.logs = [];
        this.rallyLengths = [];
        this.playerA.applyPassiveSkills();
        this.playerB.applyPassiveSkills();
    }

    log(message) {
        this.logs.push(message);
        console.log(message);
    }

    playPoint() {
        if (this.isFinished) return;

        const server = this.turn === 'A' ? this.playerA : this.playerB;
        const receiver = this.turn === 'A' ? this.playerB : this.playerA;
        const diff = Math.abs(this.scoreA - this.scoreB);
        const isComeback = diff >= 3; // 分差≥3就触发追分，防止一路崩
        const isClutch = (this.scoreA >= 9 && this.scoreB >= 9) || this.scoreA >= 10 || this.scoreB >= 10;
        const trailingA = this.scoreA < this.scoreB;

        const mkRole = (side, phase) =>
            (isClutch ? 'clutch_' : '') + (isComeback && ((side === 'A' && trailingA) || (side === 'B' && !trailingA)) ? 'comeback_' : '') + phase;

        let servePower = calcTacticStrength(server, mkRole('A', 'server'), false, receiver);
        let receivePower = calcTacticStrength(receiver, mkRole('B', 'receiver'), false, server);
        if (isComeback) {
            const comebackMul = diff >= 7 ? 1.12 : (diff >= 5 ? 1.08 : 1.05);
            if (trailingA) servePower *= comebackMul; else receivePower *= comebackMul;
        }

        const adv = (servePower + getRNG(server.currentTactic)) - (receivePower + getRNG(receiver.currentTactic));

        // 发球直接得分/接发直接得分
        if (adv > 30) {
            this.scorePoint(this.turn === 'A' ? 'A' : 'B');
            server.currentStamina = Math.max(0, server.currentStamina - 0.3);
            receiver.currentStamina = Math.max(0, receiver.currentStamina - 0.2);
            this.log(`⚡ [发球得分] ${server.name} 发球直接得分！`);
            this._afterPoint(server === this.playerA); this._finishPoint(); return;
        }
        if (adv < -35) {
            this.scorePoint(this.turn === 'A' ? 'B' : 'A');
            receiver.currentStamina = Math.max(0, receiver.currentStamina - 0.3);
            server.currentStamina = Math.max(0, server.currentStamina - 0.2);
            this.log(`💥 [接发得分] ${receiver.name} 接发球抢攻得分！`);
            this._afterPoint(receiver === this.playerA); this._finishPoint(); return;
        }

        let rc = 0, atk = adv > 3 ? server : receiver, def = adv > 3 ? receiver : server, pw = null;
        let la = 0, ld = 0;
        while (rc < 30) {
            rc++;
            const aRole = mkRole(atk === this.playerA ? 'A' : 'B', 'attacker');
            const dRole = mkRole(def === this.playerA ? 'A' : 'B', 'defender');
            let ap = calcTacticStrength(atk, aRole, true, def);
            let dp = calcTacticStrength(def, dRole, true, atk);
            if (isComeback) {
                if (atk === (trailingA ? this.playerA : this.playerB)) ap *= 1.05;
                if (def === (trailingA ? this.playerA : this.playerB)) dp *= 1.05;
            }
            if (atk.skills.includes('神仙球') && SKILLS['神仙球']?.onMagicShot?.()) {
                pw = atk; this.log(`🎪 [神仙球] ${atk.name} 打出神仙球！`); break;
            }
            const bonus = atk.currentTactic === 'aggressive' ? 4 : (atk.currentTactic === 'first_three' && rc <= 2 ? 3 : 0);
            la = ap + bonus + getRNG(atk.currentTactic);
            ld = dp * 0.95 + getRNG(def.currentTactic);
            atk.currentStamina = Math.max(0, atk.currentStamina - getStaminaCost(atk, 0.5));
            def.currentStamina = Math.max(0, def.currentStamina - getStaminaCost(def, 0.4));
            if (la - ld > 20) { pw = atk; break; }
            if (la - ld < -22) { pw = def; break; }
            [atk, def] = [def, atk];
            if (rc > 18 && Math.random() < 0.06) { pw = Math.random() < 0.5 ? atk : def; break; }
        }
        if (!pw) pw = la > ld ? atk : def;

        this.rallyLengths.push(rc);
        if (pw === this.playerA) this.scorePoint('A'); else this.scorePoint('B');
        this._afterPoint(pw === this.playerA);

        const wn = pw.name;
        if (rc >= 10) this.log(`🔥 [多板相持·${rc}板] ${wn} 艰难拿下！`);
        else if (rc >= 5) this.log(`[相持·${rc}板] ${wn} 得分`);
        else this.log(`[短球·${rc}板] ${wn} 得分`);
        this._finishPoint();
    }

    _afterPoint(isA) {
        if (isA) { this.playerA.consecutiveWins++; this.playerB.consecutiveWins = 0; }
        else { this.playerB.consecutiveWins++; this.playerA.consecutiveWins = 0; }
    }

    _finishPoint() {
        this.log(`${this.playerA.name} ${this.scoreA} : ${this.scoreB} ${this.playerB.name}`);
        this.checkGameEnd();
        if (!this.isFinished) this.handleServeSwitch();
    }

    scorePoint(s) { s === 'A' ? this.scoreA++ : this.scoreB++; }

    handleServeSwitch() {
        this.serveCount++;
        const isDeuce = this.scoreA >= 10 && this.scoreB >= 10;
        if (this.serveCount >= (isDeuce ? 1 : 2)) { this.turn = this.turn === 'A' ? 'B' : 'A'; this.serveCount = 0; }
    }

    checkGameEnd() {
        // 标准乒乓球规则：11分制，需领先2分，无上限
        if ((this.scoreA >= 11 || this.scoreB >= 11) && Math.abs(this.scoreA - this.scoreB) >= 2) {
            this.isFinished = true;
            this.winner = this.scoreA > this.scoreB ? this.playerA : this.playerB;
            this.log(`=== 本局结束 ${this.winner.name} 胜 (${this.scoreA}:${this.scoreB}) ===`);
        }
    }

    playWholeGame() {
        this.log(`=== ${this.playerA.name} vs ${this.playerB.name} ===`);
        while (!this.isFinished) this.playPoint();
        return this.winner;
    }
}

export class SeriesMatch {
    // 5局3胜制 (Bo5)
    constructor(playerA, playerB) {
        this.playerA = playerA;
        this.playerB = playerB;

        this.scoreA = 0;
        this.scoreB = 0;

        this.currentGame = null;
        this.gamesHistory = [];

        this.timeoutUsedA = false;
        this.timeoutUsedB = false;

        this.isFinished = false;
        this.winner = null;
        this.logs = [];

        // AI在每盘开始前随机选一个战术
        this._assignAiTactic(playerB);
    }

    log(message) {
        this.logs.push(message);
        console.log(message);
    }

    /** AI随机选择战术（排除normal以增加多样性，或包含normal但降低概率） */
    _assignAiTactic(aiPlayer) {
        // 随机选一个非normal的战术，或者30%概率用normal
        if (Math.random() < 0.3) {
            aiPlayer.currentTactic = 'normal';
        } else {
            const nonNormal = TACTIC_IDS.filter(id => id !== 'normal');
            aiPlayer.currentTactic = nonNormal[Math.floor(Math.random() * nonNormal.length)];
        }
        this.log(`🤖 [AI战术] ${aiPlayer.name} 选择战术：${TACTICS[aiPlayer.currentTactic].label}`);
    }

    startNextGame() {
        if (this.isFinished) return null;

        // 局间恢复
        if (this.gamesHistory.length > 0) {
            this.playerA.currentStamina = Math.min(this.playerA.stats.stamina, this.playerA.currentStamina + 3);
            this.playerB.currentStamina = Math.min(this.playerB.stats.stamina, this.playerB.currentStamina + 3);
            // AI每局之间可以调整战术
            if (Math.random() < 0.5) {
                this._assignAiTactic(this.playerB);
            }
        }

        this.currentGame = new GameMatch(this.playerA, this.playerB);
        this.currentGame.log = (msg) => this.log(msg);

        const tactA = TACTICS[this.playerA.currentTactic].label;
        const tactB = TACTICS[this.playerB.currentTactic].label;

        this.log(`\n===========================================`);
        this.log(`【第 ${this.gamesHistory.length + 1} 局比赛开始】 大比分 ${this.scoreA}:${this.scoreB}`);
        this.log(`   战术：${this.playerA.name} [${tactA}] vs ${this.playerB.name} [${tactB}]`);
        this.log(`   体能：${this.playerA.name} ${Math.floor(this.playerA.currentStamina)} | ${this.playerB.name} ${Math.floor(this.playerB.currentStamina)}`);
        this.log(`===========================================`);

        if (this.gamesHistory.length % 2 === 1) {
            this.currentGame.turn = 'B';
        }

        return this.currentGame;
    }

    checkSeriesEnd() {
        if (this.scoreA >= 3 || this.scoreB >= 3) {
            this.isFinished = true;
            this.winner = this.scoreA >= 3 ? this.playerA : this.playerB;
            this.log(`\n🏆 ====== 最终战果 ====== 🏆`);
            this.log(`【${this.winner.name}】以总比分 ${this.scoreA} : ${this.scoreB} 赢得胜利！`);
            // 打印平均回合板数
            const allRallies = this.gamesHistory.flatMap(() => []);
            // 从每局的GameMatch里拿rally统计
            if (this.currentGame) {
                const avgRally = this.currentGame.rallyLengths.length > 0
                    ? (this.currentGame.rallyLengths.reduce((a, b) => a + b, 0) / this.currentGame.rallyLengths.length).toFixed(1)
                    : 'N/A';
                // 只打印最后一句
            }
        }
    }

    recordGameResult() {
        if (this.currentGame && this.currentGame.isFinished && !this.currentGame.recorded) {
            this.currentGame.recorded = true;
            if (this.currentGame.scoreA > this.currentGame.scoreB) {
                this.scoreA++;
            } else {
                this.scoreB++;
            }
            // 记录本局使用的战术
            this.playerA.recordTactic(this.playerA.currentTactic);
            this.playerB.recordTactic(this.playerB.currentTactic);

            const avgRally = this.currentGame.rallyLengths.length > 0
                ? (this.currentGame.rallyLengths.reduce((a, b) => a + b, 0) / this.currentGame.rallyLengths.length).toFixed(1)
                : '?';
            this.gamesHistory.push({
                scoreA: this.currentGame.scoreA,
                scoreB: this.currentGame.scoreB,
                avgRallyShots: avgRally,
            });
            this.log(`>>> 第 ${this.gamesHistory.length} 局结束（均${avgRally}板/分），大比分：${this.playerA.name} ${this.scoreA} : ${this.scoreB} ${this.playerB.name} <<<`);
            this.checkSeriesEnd();
            // 系列赛结束时，按盘扣除体力
            if (this.isFinished) {
                const costA = this.playerA.calcFixtureStaminaCost();
                const costB = this.playerB.calcFixtureStaminaCost();
                this.playerA.applyFixtureStaminaCost();
                this.playerB.applyFixtureStaminaCost();
                this.log(`[体力] ${this.playerA.name} -${costA} (x=${this.playerA.x}) | ${this.playerB.name} -${costB} (x=${this.playerB.x})`);
            }
        }
    }

    playSeriesAuto() {
        while (!this.isFinished) {
            const game = this.startNextGame();
            game.playWholeGame();
            this.recordGameResult();
        }
    }
}

export class TeamMatch {
    constructor(homeTeam, awayTeam) {
        this.homeRoster = homeTeam;
        this.awayRoster = awayTeam;

        // 斯韦思林杯：A-X, B-Y, C-Z, A-Y, B-X
        this.fixtures = [
            { id: 1, home: this.homeRoster[0], away: this.awayRoster[0], match: null, winner: null },
            { id: 2, home: this.homeRoster[1], away: this.awayRoster[1], match: null, winner: null },
            { id: 3, home: this.homeRoster[2], away: this.awayRoster[2], match: null, winner: null },
            { id: 4, home: this.homeRoster[0], away: this.awayRoster[1], match: null, winner: null },
            { id: 5, home: this.homeRoster[1], away: this.awayRoster[0], match: null, winner: null }
        ];

        this.scoreHome = 0;
        this.scoreAway = 0;

        this.currentFixtureIndex = 0;
        this.isFinished = false;
        this.winner = null;
        this.logs = [];
    }

    log(message) {
        this.logs.push(message);
        console.log(message);
    }

    startNextFixture() {
        if (this.isFinished || this.currentFixtureIndex >= 5) return null;

        const fixture = this.fixtures[this.currentFixtureIndex];
        fixture.match = new SeriesMatch(fixture.home, fixture.away);
        fixture.match.log = (msg) => this.log(msg);

        // 未上场的板凳球员恢复15%体力
        this.homeRoster.forEach(p => {
            if (p !== fixture.home && p !== fixture.away) {
                p.currentStamina = Math.min(p.stats.stamina, (p.currentStamina || p.stats.stamina) + p.stats.stamina * 0.15);
            }
        });
        this.awayRoster.forEach(p => {
            if (p !== fixture.home && p !== fixture.away) {
                p.currentStamina = Math.min(p.stats.stamina, (p.currentStamina || p.stats.stamina) + p.stats.stamina * 0.15);
            }
        });

        this.log(`\n======================================================`);
        this.log(`【第 ${fixture.id} 盘比赛开始】 ${fixture.home.name} vs ${fixture.away.name}`);
        this.log(`======================================================`);

        return fixture;
    }

    recordFixtureResult() {
        const fixture = this.fixtures[this.currentFixtureIndex];
        if (fixture && fixture.match && fixture.match.isFinished) {
            fixture.winner = fixture.match.winner === fixture.home ? 'home' : 'away';

            if (fixture.winner === 'home') {
                this.scoreHome++;
            } else {
                this.scoreAway++;
            }

            this.log(`\n★★★ 盘口结算：${fixture.match.winner.name} 赢得了第 ${fixture.id} 盘单打！`);
            this.log(`★★★ 团体赛大比分：主队 ${this.scoreHome} : ${this.scoreAway} 客队`);

            this.currentFixtureIndex++;
            this.checkTeamMatchEnd();
        }
    }

    checkTeamMatchEnd() {
        if (this.scoreHome >= 3 || this.scoreAway >= 3) {
            this.isFinished = true;
            this.winner = this.scoreHome >= 3 ? 'home' : 'away';
            this.log(`\n🏆🏆🏆 ========================================= 🏆🏆🏆`);
            this.log(`团体赛落幕！最终由 ${this.winner === 'home' ? '主队' : '客队'} 以 ${this.scoreHome}:${this.scoreAway} 夺魁！`);
            this.log(`🏆🏆🏆 ========================================= 🏆🏆🏆`);
        }
    }
}
