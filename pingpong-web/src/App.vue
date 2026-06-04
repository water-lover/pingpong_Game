<script setup>
import { ref, computed } from 'vue'
import { Player, TeamMatch } from './core/PingPongMatch.js'
import { freeAgentsPool, leagueAICaching, starterGroups } from './data/gameData.js'
import { SKILLS } from './core/HiddenSkills.js'

const MAX_ROUNDS = 10
const appState = ref('group_select') // group_select → league → scout → roster → match → champion → playoff_over
const logs = ref([])
const showSkillBook = ref(false)
const showOpponentRoster = ref(false)
const showTraining = ref(false)
const showTacticGuide = ref(false)
const seasonCount = ref(1)
const championsHistory = ref([])
const seasonMVP = ref(null)

// 战术克制关系
const tacticCounters = {
  normal: { strong: [], weak: ['target_weakness'], desc: '万金油，无明显克制，但容易被针对' },
  aggressive: { strong: ['conservative'], weak: ['rally_focus'], desc: '压制防守反击，但被相持消耗克制' },
  conservative: { strong: ['first_three'], weak: ['aggressive'], desc: '克制前三板抢攻，但被暴力搏杀冲垮' },
  target_weakness: { strong: ['normal'], weak: ['first_three'], desc: '克制常规打法，但被快速抢攻压制' },
  first_three: { strong: ['rally_focus', 'target_weakness'], weak: ['conservative'], desc: '克制相持和盯人，但被防守反击化解' },
  rally_focus: { strong: ['aggressive'], weak: ['first_three'], desc: '克制搏杀消耗战，但前三板抢攻是软肋' }
}

/** 训练球员 */
const trainPlayer = (p, stat) => {
  const cost = p.getTrainCost(stat)
  if (cost === Infinity) { alert('已达到潜力上限！'); return }
  if (myTeamGold.value < cost) { alert(`资金不足！需要 ${cost} 金币`); return }
  myTeamGold.value -= cost
  const spent = p.trainStat(stat)
  // 刷新响应式
  myTeamPlayers.value = [...myTeamPlayers.value]
}

const skillList = computed(() => Object.entries(SKILLS).map(([id, s]) => ({ id, name: s.name, desc: s.desc })))

/** 反向查询：技能名 → 拥有该技能的球员列表 */
const skillToPlayers = computed(() => {
  const map = {}
  const allPlayers = [...freeAgentsPool]
  leagueTeams.value.forEach(t => { if (t.id !== 'team_mine') allPlayers.push(...t.players) })
  myTeamPlayers.value.forEach(p => { if (!allPlayers.includes(p)) allPlayers.push(p) })
  allPlayers.forEach(p => {
    (p.skills || []).forEach(sid => {
      const skill = SKILLS[sid]
      if (skill) {
        if (!map[skill.name]) map[skill.name] = []
        if (!map[skill.name].includes(p.name)) map[skill.name].push(p.name)
      }
    })
  })
  return map
})

// 我的球队
const myTeamPlayers = ref([])
const leagueTeams = ref(leagueAICaching)
const currentRound = ref(1)

// 3大分组选择
const selectedGroup = ref(null)
const selectGroup = (groupId) => {
  selectedGroup.value = groupId
  const chosen = starterGroups.find(g => g.id === groupId)
  myTeamPlayers.value = chosen.players.map(p => p)
  // 另外两个组变成独立AI队伍
  const leftovers = starterGroups.filter(g => g.id !== groupId)
  const teamNames = ['凌云队', '雷霆队']
  leftovers.forEach((g, i) => {
    const teamId = i === 0 ? 'team_b' : 'team_c'
    let team = leagueTeams.value.find(t => t.id === teamId)
    if (!team) {
      team = { id: teamId, name: teamNames[i], wins: 0, losses: 0, gold: 1500, players: [] }
      leagueTeams.value.push(team)
      teamStats.value[teamId] = { name: teamNames[i], points: 0, wins: 0, losses: 0 }
    }
    team.players = g.players.map(p => { const np = new Player(p.name, {...p.stats}); np.isCore = true; return np })
  })
  // 自动分配2名替补球员（保证5人阵容）
  const benchMap = {
    'group_1': ['许昕', '弗朗西斯卡'],
    'group_2': ['林高远', '方博'],
    'group_3': ['松岛辉空', '方博']
  };
  const benchNames = benchMap[groupId] || [];
  const allFree = [...freeAgentsPool, ...freeAgentsForDraft.value];
  benchNames.forEach(name => {
    const src = allFree.find(p => p.name === name);
    if (src && !myTeamPlayers.value.find(p => p.name === name)) {
      const bp = new Player(src.name, {...src.stats});
      myTeamPlayers.value.push(bp);
      myTeamGold.value -= bp.stats.price;
      freeAgentsForDraft.value = freeAgentsForDraft.value.filter(fa => fa.name !== name);
    }
  });
  // 自动完成选秀（剩余球员分给AI）
  autoFinishDraft();
  appState.value = 'league'
}

/** 自动分配剩余自由球员给AI队伍 */
const autoFinishDraft = () => {
  let remaining = [...freeAgentsForDraft.value];
  leagueTeams.value.forEach(team => {
    if (team.id !== 'team_mine') {
      while (team.players.length < 5 && remaining.length > 0) {
        let affordable = remaining.filter(p => p.stats.price <= team.gold);
        if (affordable.length === 0) break;
        affordable.forEach(p => {
          const score = p.stats.serve+p.stats.receive+p.stats.forehand+p.stats.backhand+p.stats.rally+p.stats.stamina*1.5;
          p._aiScore = score * (0.8 + Math.random() * 0.4);
        });
        affordable.sort((a, b) => b._aiScore - a._aiScore);
        const picked = affordable[0];
        team.gold -= picked.stats.price;
        team.players.push(picked);
        remaining = remaining.filter(p => p !== picked);
      }
    }
  });
  scoutPoolPlayers.value = remaining;
  saveGame();
}
const myTeamGold = ref(1500)
const teamStats = ref({
  'team_mine': { name: '本质队', points: 0, wins: 0, losses: 0 },
  'team_jp':   { name: '饭圈队', points: 0, wins: 0, losses: 0 },
  'team_eu':   { name: '黑马队', points: 0, wins: 0, losses: 0 },
  'team_na':   { name: '新星队', points: 0, wins: 0, losses: 0 },
  'team_b':    { name: '凌云队', points: 0, wins: 0, losses: 0 },
  'team_c':    { name: '雷霆队', points: 0, wins: 0, losses: 0 },
})

// 6队循环赛：每队与其他5队交手2次 = 10轮

// 6队循环赛：每队与其他5队交手2次 = 10轮
const schedule = []
const teamIds = ['team_mine', 'team_jp', 'team_eu', 'team_na', 'team_b', 'team_c']
for (let cycle = 0; cycle < 2; cycle++) {
  for (let r = 0; r < 5; r++) {
    const round = []
    for (let m = 0; m < 3; m++) {
      if (teamIds[m] !== teamIds[5 - m]) round.push({ home: teamIds[m], away: teamIds[5 - m] })
    }
    schedule.push(round)
    const last = teamIds.pop()
    teamIds.splice(1, 0, last)
  }
}

const isLeagueFinished = computed(() => currentRound.value > MAX_ROUNDS)

const leagueStandings = computed(() => {
  return Object.values(teamStats.value).sort((a, b) => b.points - a.points || b.wins - a.wins)
})

const champion = computed(() => {
  if (!isLeagueFinished.value) return null
  return leagueStandings.value[0]
})

// ══════ 季后赛/杯赛模式 ══════
const playoffState = ref('idle') // idle → bracket → semis → final → over
const playoffBracket = ref(null)
const playoffCurrentMatch = ref(null)
const playoffFinalTeam = ref(null)

const top4Teams = computed(() => leagueStandings.value.slice(0, 4))

const startPlayoffs = () => {
  const top4 = top4Teams.value
  playoffBracket.value = {
    semis: [
      { home: top4[0], away: top4[3], winner: null, homeScore: 0, awayScore: 0 },
      { home: top4[1], away: top4[2], winner: null, homeScore: 0, awayScore: 0 }
    ],
    final: { home: null, away: null, winner: null, homeScore: 0, awayScore: 0 }
  }
  playoffState.value = 'bracket'
  appState.value = 'playoff'
}

const getTeamObj = (standingsEntry) => {
  const id = Object.keys(teamStats.value).find(k => teamStats.value[k].name === standingsEntry.name)
  return leagueTeams.value.find(t => t.id === id) || { id: 'team_mine', name: standingsEntry.name, players: [...myTeamPlayers.value] }
}

const startPlayoffMatch = (isFinal = false, semiIndex = -1) => {
  const bracket = playoffBracket.value
  if (isFinal) {
    playoffCurrentMatch.value = {
      type: 'final',
      home: bracket.final.home,
      away: bracket.final.away,
      homeTeam: getTeamObj(bracket.final.home),
      awayTeam: getTeamObj(bracket.final.away),
    }
  } else {
    // 使用传入的半决赛索引，或找第一个未完成的
    const semiIdx = semiIndex >= 0 ? semiIndex : bracket.semis.findIndex(s => s.winner === null)
    if (semiIdx === -1 || bracket.semis[semiIdx].winner) return
    const semi = bracket.semis[semiIdx]
    playoffCurrentMatch.value = {
      type: 'semifinal',
      index: semiIdx,
      home: semi.home,
      away: semi.away,
      homeTeam: getTeamObj(semi.home),
      awayTeam: getTeamObj(semi.away),
    }
  }
  // 进入排兵布阵
  const match = playoffCurrentMatch.value
  const homeRoster = match.homeTeam.players.sort((a, b) => (b.stats.serve+b.stats.receive+b.stats.forehand+b.stats.backhand+b.stats.rally+b.stats.stamina*2) - (a.stats.serve+a.stats.receive+a.stats.forehand+a.stats.backhand+a.stats.rally+a.stats.stamina*2)).slice(0, 3)
  const awayRoster = match.awayTeam.players.sort((a, b) => (b.stats.serve+b.stats.receive+b.stats.forehand+b.stats.backhand+b.stats.rally+b.stats.stamina*2) - (a.stats.serve+a.stats.receive+a.stats.forehand+a.stats.backhand+a.stats.rally+a.stats.stamina*2)).slice(0, 3)
  
  if (match.homeTeam.id === 'team_mine') {
    rosterSlots.value = [null, null, null]
    enemyTeam.value = awayRoster
    appState.value = 'roster'
  } else if (match.awayTeam.id === 'team_mine') {
    rosterSlots.value = [null, null, null]
    enemyTeam.value = homeRoster
    appState.value = 'roster'
  } else {
    // AI vs AI, 自动模拟
    const tm = new TeamMatch(homeRoster, awayRoster); tm.log = () => {}
    while (!tm.isFinished) { tm.startNextFixture(); const f = tm.fixtures[tm.currentFixtureIndex]; if (f?.match) f.match.playSeriesAuto(); tm.recordFixtureResult() }
    const homeWon = tm.scoreHome >= 3
    if (match.type === 'semifinal') {
      bracket.semis[match.index].winner = homeWon ? match.home : match.away
      bracket.semis[match.index].homeScore = tm.scoreHome
      bracket.semis[match.index].awayScore = tm.scoreAway
    } else {
      bracket.final.winner = homeWon ? match.home : match.away
      bracket.final.homeScore = tm.scoreHome
      bracket.final.awayScore = tm.scoreAway
      playoffState.value = 'over'
    }
    // 检查所有半决赛完成
    if (bracket.semis.every(s => s.winner !== null) && bracket.final.home === null) {
      bracket.final.home = bracket.semis[0].winner
      bracket.final.away = bracket.semis[1].winner
    }
  }
}

const recordPlayoffResult = (homeWon) => {
  const match = playoffCurrentMatch.value
  if (!match) return
  // 记录比分
  const homeScore = teamScore.value?.home ?? 0
  const awayScore = teamScore.value?.away ?? 0
  if (match.type === 'semifinal') {
    playoffBracket.value.semis[match.index].winner = homeWon ? match.home : match.away
    playoffBracket.value.semis[match.index].homeScore = homeScore
    playoffBracket.value.semis[match.index].awayScore = awayScore
  } else {
    playoffBracket.value.final.winner = homeWon ? match.home : match.away
    playoffBracket.value.final.homeScore = homeScore
    playoffBracket.value.final.awayScore = awayScore
    playoffState.value = 'over'
    // 记录冠军到名人堂
    const winnerName = playoffBracket.value.final.winner?.name || '未知'
    const mvpName = playoffBracket.value.final.winner?.name || seasonMVP.value?.name || ''
    championsHistory.value.push({ season: seasonCount.value, champion: winnerName, mvp: mvpName })
    // 根据排名给MVP
    const allPlayers = [...myTeamPlayers.value]
    if (allPlayers.length > 0) {
      const mvp = allPlayers.sort((a,b) => (b.stats.serve+b.stats.receive+b.stats.forehand+b.stats.backhand+b.stats.rally) - (a.stats.serve+a.stats.receive+a.stats.forehand+a.stats.backhand+a.stats.rally))[0]
      seasonMVP.value = mvp
    }
  }
  // 检查是否所有半决赛结束
  const bracket = playoffBracket.value
  if (bracket.semis.every(s => s.winner !== null) && bracket.final.home === null) {
    bracket.final.home = bracket.semis[0].winner
    bracket.final.away = bracket.semis[1].winner
    playoffCurrentMatch.value = null
  }
}

const goToNextPlayoffMatch = () => {
  const bracket = playoffBracket.value
  if (bracket.final.home && bracket.final.away && bracket.final.winner === null) {
    startPlayoffMatch(true)
  } else {
    appState.value = 'playoff'
  }
}

// 俱乐部可用球员池 (供布阵使用)
const playerPool = computed(() => myTeamPlayers.value)

// AI 的队伍 (客队)
const enemyTeam = ref(null)

// 球探与转会市场
const scoutPoolPlayers = ref([])

// 选秀界面：玩家从自由市场招募
const draftPlayer = (p) => {
  if (myTeamPlayers.value.length >= MAX_TEAM_SIZE) {
    alert(`球队已满 ${MAX_TEAM_SIZE} 人！`);
    return;
  }
  if (myTeamPlayers.value.includes(p)) return;
  if (myTeamGold.value < p.stats.price) {
    alert(`资金不足！需要 ${p.stats.price} 金币`);
    return;
  }
  myTeamGold.value -= p.stats.price;
  myTeamPlayers.value.push(p);
  freeAgentsForDraft.value = freeAgentsForDraft.value.filter(fa => fa !== p);
}
const removeDrafted = (p) => {
  myTeamGold.value += p.stats.price;
  myTeamPlayers.value = myTeamPlayers.value.filter(mp => mp !== p);
  freeAgentsForDraft.value.push(p);
}

const freeAgentsForDraft = ref(freeAgentsPool.map(p => new Player(p.name, { ...p.stats })))

const finishDrafting = () => {
  // 玩家先选完了，剩下的自由球员供人机队伍选择
  let remainingAgents = [...freeAgentsForDraft.value];

  // 给人机队伍补充队员（用他们自己的资金买人，注重能力）
  leagueTeams.value.forEach(team => {
    if (team.id !== 'team_mine') {
      const targetRosterSize = 5;
      while (team.players.length < targetRosterSize && remainingAgents.length > 0) {
        let affordable = remainingAgents.filter(p => p.stats.price <= team.gold);
        if (affordable.length === 0) break;
        affordable.forEach(p => {
           const abilityScore = p.stats.serve + p.stats.receive + p.stats.forehand + p.stats.backhand + p.stats.rally + p.stats.stamina * 1.5;
           p._aiScore = abilityScore * (0.8 + Math.random() * 0.4); 
        });
        affordable.sort((a, b) => b._aiScore - a._aiScore);
        const drafted = affordable[0];
        team.gold -= drafted.stats.price;
        team.players.push(drafted);
        remainingAgents = remainingAgents.filter(pa => pa !== drafted);
      }
    }
  });

  scoutPoolPlayers.value = remainingAgents;
  appState.value = 'league'
  saveGame()
}

const getNextOpponentId = () => {
  const roundIdx = (currentRound.value - 1) % schedule.length
  const thisRound = schedule[roundIdx]
  if (!thisRound || !Array.isArray(thisRound)) return 'team_jp'
  // 找到包含玩家队的那场比赛
  const myMatch = thisRound.find(m => m.home === 'team_mine' || m.away === 'team_mine')
  if (!myMatch) return 'team_jp'
  return myMatch.home === 'team_mine' ? myMatch.away : myMatch.home
}

const getNextOpponent = () => {
  return leagueTeams.value.find(t => t.id === getNextOpponentId())
}

const goToRoster = () => {
  const oppPlayers = getNextOpponent().players
  // 人机选人：优先体能好的，同时随机轮换让替补有机会上场
  if (oppPlayers.length > 3) {
    let scored = [...oppPlayers].map(p => ({
      player: p,
      score: p.stats.serve + p.stats.receive + p.stats.forehand + p.stats.backhand + p.stats.rally + (p.currentStamina || p.stats.stamina) * 2 + (p.isCore ? 35 : 0) + Math.random() * 25
    }));
    scored.sort((a, b) => b.score - a.score);
    scored.slice(0, 3).forEach(s => { const teamId = getNextOpponentId(); const stats = teamStats.value[teamId]; s.player.teamChemistry = stats ? stats.chemistry : 50; });
    enemyTeam.value = scored.slice(0, 3).map(s => s.player);
  } else {
    oppPlayers.forEach(p => { const teamId = getNextOpponentId(); const stats = teamStats.value[teamId]; p.teamChemistry = stats ? stats.chemistry : 50; });
    enemyTeam.value = oppPlayers
  }
  appState.value = 'roster'
}

const MAX_TEAM_SIZE = 5 // 队伍人数上限

const openScout = () => {
  appState.value = 'scout'
}

const buyPlayer = (p, isFromOtherTeam = false) => {
  // 检查人数上限
  if (myTeamPlayers.value.length >= MAX_TEAM_SIZE) {
    alert(`球队已满 ${MAX_TEAM_SIZE} 人，请先卖出现有球员！`)
    return
  }
  // 核心球员不可被挖走
  if (isFromOtherTeam && p.isCore) {
    alert(`${p.name} 是球队核心，拒绝转会！`)
    return
  }
  const cost = isFromOtherTeam ? Math.floor(p.stats.price * 1.5) : p.stats.price;
  if (myTeamGold.value >= cost) {
    myTeamGold.value -= cost
    myTeamPlayers.value.push(p)
    if (!isFromOtherTeam) {
      scoutPoolPlayers.value = scoutPoolPlayers.value.filter(mp => mp !== p)
    } else {
      // 从 AI 队伍买走
      leagueTeams.value.forEach(t => {
        if (t.players.includes(p)) {
          t.players = t.players.filter(tp => tp !== p)
          t.gold = (t.gold || 0) + cost
          
          // NPC球队少人后必须从市场补充到至少3人
          while (t.players.length < 3) {
            let affordable = scoutPoolPlayers.value.filter(sp => sp.stats.price <= t.gold);
            if (affordable.length === 0) {
              // 市场无合适球员，生成一个底薪临时工
              const tempPlayer = new Player('临时工#' + Math.floor(Math.random()*100), {
                serve: 60 + Math.floor(Math.random()*10),
                receive: 60 + Math.floor(Math.random()*10),
                forehand: 60 + Math.floor(Math.random()*10),
                backhand: 60 + Math.floor(Math.random()*10),
                rally: 60 + Math.floor(Math.random()*10),
                stamina: 80 + Math.floor(Math.random()*15),
                mentality: 60 + Math.floor(Math.random()*15),
                price: 50
              });
              t.players.push(tempPlayer);
              t.gold -= 50;
              break;
            }
            affordable.forEach(sp => {
              const abilityScore = sp.stats.serve + sp.stats.receive + sp.stats.forehand + sp.stats.backhand + sp.stats.rally + sp.stats.stamina * 1.5;
              sp._aiScore = abilityScore * (0.8 + Math.random() * 0.4);
            });
            affordable.sort((a, b) => b._aiScore - a._aiScore);
            const drafted = affordable[0];
            t.gold -= drafted.stats.price;
            t.players.push(drafted);
            scoutPoolPlayers.value = scoutPoolPlayers.value.filter(sp => sp !== drafted);
          }
        }
      })
    }
  } else {
    alert(`资金不足，至少需要 ${cost} 金币！`)
  }
}

/** 卖出球员 —— 回收80%价格的金币 */
const sellPlayer = (p) => {
  const refund = Math.floor(p.stats.price * 0.8);
  myTeamGold.value += refund;
  myTeamPlayers.value = myTeamPlayers.value.filter(mp => mp !== p);
  // 卖出的球员回到自由市场池
  scoutPoolPlayers.value.push(p);
}

// 主队的布阵插槽 (A, B, C)
const rosterSlots = ref([null, null, null])
const slotLabels = ['A (一单)', 'B (二单)', 'C (三单)']

let currentTeamMatch = null
const teamScore = ref({ home: 0, away: 0 })
const fixtures = ref([])
const activeFixtureIndex = ref(0)
const isMatchFinished = ref(false)

// 用于展示正在进行的这盘里的五局三胜数据
const activeSeriesInfo = ref(null)

// 战术板相关状态
const isTacticBoardOpen = ref(false)
const tacticOptions = [
  { id: 'normal', label: '常规套路', desc: '均衡稳健，失误率仅5%' },
  { id: 'aggressive', label: '⚔️ 全线搏杀', desc: '正手爆发+38%，但20%概率失误大掉分' },
  { id: 'conservative', label: '🛡️ 稳扎稳打', desc: '防守稳固，相持略优，失误率仅3%' },
  { id: 'target_weakness', label: '🎯 死盯落点', desc: '自动分析对手正/反手弱侧重点攻击' },
  { id: 'first_three', label: '⚡ 前三板', desc: '发接发特化，15%概率执行失败' },
  { id: 'rally_focus', label: '🏓 形成相持', desc: '相持权重+44%，发接发偏弱但失误低' }
]
const selectedTactic = ref('normal')


// ====== 方法：排兵布阵阶段 ======
const selectPlayer = (player) => {
  if (rosterSlots.value.includes(player)) {
    // 已经选中了则取消
    const idx = rosterSlots.value.indexOf(player)
    rosterSlots.value[idx] = null
  } else {
    // 找一个空位放入
    const emptyIdx = rosterSlots.value.findIndex(val => val === null)
    if (emptyIdx !== -1) {
      rosterSlots.value[emptyIdx] = player
    }
  }
}

// 检查是否选满了三人
const isRosterReady = computed(() => {
  return rosterSlots.value.every(val => val !== null)
})

// ====== 方法：进入比赛阶段 ======
const confirmRosterAndStart = () => {
  appState.value = 'match'
  logs.value = []
  

  // 创建团体赛对象
  currentTeamMatch = new TeamMatch([...rosterSlots.value], enemyTeam.value)
  currentTeamMatch.log = (msg) => logs.value.push(msg)
  currentTeamMatch.log('【系统】对阵名单确立！斯韦思林杯赛制团体赛开始。')
  
  fixtures.value = currentTeamMatch.fixtures
  activeFixtureIndex.value = currentTeamMatch.currentFixtureIndex
  isMatchFinished.value = false
  syncMatchState()
}

const syncMatchState = () => {
  if (!currentTeamMatch) return
  teamScore.value = { home: currentTeamMatch.scoreHome, away: currentTeamMatch.scoreAway }
  activeFixtureIndex.value = currentTeamMatch.currentFixtureIndex
  isMatchFinished.value = currentTeamMatch.isFinished

  // 同步正在打的这盘 5局3胜
  const currentFixture = currentTeamMatch.fixtures[currentTeamMatch.currentFixtureIndex]
  if (currentFixture && currentFixture.match) {
    const sm = currentFixture.match
    activeSeriesInfo.value = {
      playerA_Tactic: sm.playerA.currentTactic,
      timeoutUsedA: sm.timeoutUsedA,
      scoreA: sm.scoreA,
      scoreB: sm.scoreB,
      currentGameObj: sm.currentGame,
      // 如果大分没决出且当前小局还在打，表示活跃
      hasActiveGame: sm.currentGame && !sm.currentGame.isFinished,
      isSeriesFinished: sm.isFinished
    }
  } else {
    activeSeriesInfo.value = null
  }
}

const startNextFixture = () => {
  if (!currentTeamMatch || currentTeamMatch.isFinished) return
  currentTeamMatch.startNextFixture()
  syncMatchState()
}

const startNextGameInSeries = () => {
  const currentFixture = currentTeamMatch.fixtures[currentTeamMatch.currentFixtureIndex]
  if (currentFixture && currentFixture.match) {
    currentFixture.match.startNextGame()
    syncMatchState()
  }
}

// 战术/教练系统 
const callTimeout = () => {
  const currentFixture = currentTeamMatch.fixtures[currentTeamMatch.currentFixtureIndex]
  if (currentFixture && currentFixture.match) {
    if (currentFixture.match.timeoutUsedA) return
    currentFixture.match.timeoutUsedA = true
    isTacticBoardOpen.value = true
    currentTeamMatch.log(`📢 【暂停】中国队主教练请求了暂停！场上比赛中断。`)
    syncMatchState()
  }
}

const openTacticBoardBreak = () => {
  isTacticBoardOpen.value = true
}

const applyTactic = () => {
  const currentFixture = currentTeamMatch.fixtures[currentTeamMatch.currentFixtureIndex]
  if (currentFixture && currentFixture.match) {
    currentFixture.match.playerA.currentTactic = selectedTactic.value
    
    let tacticName = tacticOptions.find(t => t.id === selectedTactic.value)?.label
    currentTeamMatch.log(`💡 【战术调整】教练已部署战术：${tacticName}`)
  }
  isTacticBoardOpen.value = false
  syncMatchState()
}

const playPoint = () => {
  const currentFixture = currentTeamMatch.fixtures[currentTeamMatch.currentFixtureIndex]
  if (currentFixture && currentFixture.match && currentFixture.match.currentGame) {
    const sm = currentFixture.match
    sm.currentGame.playPoint()
    
    // 如果小局结束，记录大分
    if (sm.currentGame.isFinished) {
      sm.recordGameResult()
    }
    // 如果5局3胜结束，记录到团体赛中
    if (sm.isFinished) {
      currentTeamMatch.recordFixtureResult()
    }
    syncMatchState()
  }
}

const autoSkipCurrentSeries = () => {
  const currentFixture = currentTeamMatch.fixtures[currentTeamMatch.currentFixtureIndex]
  if (currentFixture && currentFixture.match) {
    currentFixture.match.playSeriesAuto()
    currentTeamMatch.recordFixtureResult()
    syncMatchState()
  }
}

const saveGame = () => {
    // Phase 4/5 local storage stub
    console.log("Game progress saved.");
}

const resetToMenu = () => {
  // 季后赛模式
  if (playoffState.value !== 'idle') {
    const isWin = teamScore.value.home >= 3
    // 季后赛每轮结束后恢复体力（让战术博弈成为可能）
    myTeamPlayers.value.forEach(p => p.roundRecovery())
    recordPlayoffResult(isWin)
    // 检查决赛是否就绪且玩家参与其中 → 直接进入决赛
    const bracket = playoffBracket.value
    if (bracket?.final?.home && bracket?.final?.away && !bracket.final.winner) {
      const playerInFinal = bracket.final.home.name === '本质队' || bracket.final.away.name === '本质队'
      if (playerInFinal) {
        startPlayoffMatch(true)
        return // 防止被下面的 appState='playoff' 覆盖
      }
    }
    appState.value = 'playoff'
    rosterSlots.value = [null, null, null]
    teamScore.value = { home: 0, away: 0 }
    fixtures.value = []
    activeFixtureIndex.value = 0
    isMatchFinished.value = false
    currentTeamMatch = null
    enemyTeam.value = null
    logs.value = []
    return
  }

  // 1. 玩家比赛结果结算
  const isWin = teamScore.value.home >= 3
  const oppId = getNextOpponentId()

  // 每轮基础经费（与人机队伍持平）
  myTeamGold.value += 800

  if (isWin) {
     teamStats.value['team_mine'].wins++
     teamStats.value['team_mine'].points += 3
     teamStats.value[oppId].losses++
     myTeamGold.value += 2500 // 赢球奖金

  } else {
     teamStats.value['team_mine'].losses++
     teamStats.value[oppId].wins++
     teamStats.value[oppId].points += 3
     myTeamGold.value += 1500 // 出场费

  }
  
  // 2. 模拟后台所有 AI 交手的比赛（含真实体能消耗）
  const roundIdx = (currentRound.value - 1) % schedule.length
  const thisRound = schedule[roundIdx]
  if (thisRound) {
     thisRound.forEach(match => {
       if (match.home !== 'team_mine' && match.away !== 'team_mine') {
         const h = leagueTeams.value.find(t => t.id === match.home);
         const a = leagueTeams.value.find(t => t.id === match.away);
         if (h && a && h.players.length >= 3 && a.players.length >= 3) {
           // 按综合能力+当前体力排序，选出各队最强的3人
           // AI阵容选人：核心球员优先登场，兼顾体能与随机轮换
           const aiRosterScore = (p) => p.stats.serve + p.stats.receive + p.stats.forehand + p.stats.backhand + p.stats.rally + (p.currentStamina || p.stats.stamina) * 2 + (p.isCore ? 30 : 0) + Math.random() * 20;
           const homeRoster = [...h.players].sort((x, y) => aiRosterScore(y) - aiRosterScore(x)).slice(0, 3);
           const awayRoster = [...a.players].sort((x, y) => aiRosterScore(y) - aiRosterScore(x)).slice(0, 3);
           // 执行完整的团体赛模拟（含体能消耗）
           const tm = new TeamMatch(homeRoster, awayRoster);
           tm.log = () => {}; // 静默模拟
           while (!tm.isFinished) {
             tm.startNextFixture();
             const fixture = tm.fixtures[tm.currentFixtureIndex];
             if (fixture && fixture.match) {
               fixture.match.playSeriesAuto();
             }
             tm.recordFixtureResult();
           }
           const homeWin = tm.scoreHome >= 3;
           if (homeWin) {
             teamStats.value[match.home].wins++;
             teamStats.value[match.home].points += 3;
             teamStats.value[match.away].losses++;
             if (h) h.gold = (h.gold || 0) + 2500;
             if (a) a.gold = (a.gold || 0) + 1500;
           } else {
             teamStats.value[match.away].wins++;
             teamStats.value[match.away].points += 3;
             teamStats.value[match.home].losses++;
             if (a) a.gold = (a.gold || 0) + 2500;
             if (h) h.gold = (h.gold || 0) + 1500;
           }
         }
       }
     });
  }

  // 3. 轮间体力恢复 + 士气/化学调整
  myTeamPlayers.value.forEach(p => { p.roundRecovery(); ; })
  leagueTeams.value.forEach(t => {
    if (t.id !== 'team_mine') {
      t.players.forEach(p => { p.roundRecovery(); ; });
      // AI赚钱 + 强制训练：每轮至少把核心球员练满
      t.gold = (t.gold || 1000) + 1200;  // AI资金提升
      // AI训练：优先核心球员，有多少钱练多少
      let aiAttempts = 0;
      while (aiAttempts < 8 && t.gold > 80) {
        aiAttempts++;
        const trainable = [...t.players].filter(p => p.isCore).sort((a, b) => (b.stats.price || 0) - (a.stats.price || 0));
        if (trainable.length === 0) break;
        let trained = false;
        for (const p of trainable) {
          const candidates = ['serve','receive','forehand','backhand','rally']
            .filter(s => p.getTrainCost(s) < Infinity && p.getTrainCost(s) <= t.gold)
            .sort((a, b) => p.getTrainCost(b) - p.getTrainCost(a)); // 优先最贵的(核心球员强项)
          if (candidates.length === 0) continue;
          t.gold -= p.trainStat(candidates[0]);
          trained = true;
          break;
        }
        if (!trained) break;
      }
    }
  })
  
  currentRound.value++
  saveGame()

  // 检查联赛是否结束
  if (currentRound.value > MAX_ROUNDS) {
    // 记录常规赛冠军
    appState.value = 'champion'
  } else {
    appState.value = 'league'
  }
  rosterSlots.value = [null, null, null]
  teamScore.value = { home: 0, away: 0 }
  fixtures.value = []
  activeFixtureIndex.value = 0
  isMatchFinished.value = false
  currentTeamMatch = null
  logs.value = []
}

/** 重置整个联赛（重新开始） */
const continueNextSeason = () => {
  currentRound.value = 1;
  seasonCount.value++;
  // 重置成绩表
  Object.keys(teamStats.value).forEach(k => {
    teamStats.value[k].points = 0;
    teamStats.value[k].wins = 0;
    teamStats.value[k].losses = 0;
  });
  // AI队伍保留训练成果和资金
  leagueTeams.value.forEach(t => {
    if (t.id !== 'team_mine') {
      t.gold = (t.gold || 1500) + 2000; // 赛季间补助
      t.players.forEach(p => {
        p.currentStamina = p.stats.stamina;
        p.morale = 75;
      });
    }
  });
  myTeamPlayers.value.forEach(p => {
    p.currentStamina = p.stats.stamina;
    p.morale = 75;
  });
  myTeamGold.value += 2000; // 赛季间赞助
  // 重置离子赛状态
  playoffState.value = 'idle';
  playoffBracket.value = null;
  playoffCurrentMatch.value = null;
  appState.value = 'league';
  saveGame();
}

const resetGame = () => {
  seasonCount.value = 1;
  championsHistory.value = [];
  seasonMVP.value = null;
  myTeamPlayers.value = []
  myTeamGold.value = 1500
  currentRound.value = 1
  teamStats.value = {
    'team_mine': { name: '本质队', points: 0, wins: 0, losses: 0 },
    'team_jp':   { name: '饭圈队', points: 0, wins: 0, losses: 0 },
    'team_eu':   { name: '黑马队', points: 0, wins: 0, losses: 0 },
    'team_na':   { name: '新星队', points: 0, wins: 0, losses: 0 },
    'team_b':    { name: '凌云队', points: 0, wins: 0, losses: 0 },
    'team_c':    { name: '雷霆队', points: 0, wins: 0, losses: 0 },
  }
  // 重置AI队伍
  leagueTeams.value = leagueAICaching.map(t => ({
    ...t,
    wins: 0,
    losses: 0,
    gold: 1500,
    players: t.players.map(p => new Player(p.name, { ...p.stats }))
  }))
  scoutPoolPlayers.value = []
  freeAgentsForDraft.value = freeAgentsPool.map(p => new Player(p.name, { ...p.stats }))
  selectedGroup.value = null
  appState.value = 'group_select'
}
</script>

<template>
  <div class="container">
    <h1>乒乓球经理 - 模拟经营</h1>

    <!-- ================= 三大分组选择 ================= -->
    <div v-if="appState === 'group_select'" class="drafting-view">
      <h3>【选择你的建队基石】</h3>
      <p class="desc">请从下面三组中挑选一组作为你的初始阵容，其余两组将成为联赛对手</p>
      <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;">
        <div v-for="g in starterGroups" :key="g.id" class="player-card selectable"
             :class="{'selected': selectedGroup === g.id}"
             @click="selectGroup(g.id)" style="width:260px;cursor:pointer;">
          <h4 style="color:#e74c3c;font-size:20px;">{{ g.name }}</h4>
          <div v-for="p in g.players" :key="p.name" style="margin:8px 0;padding:8px;background:#f9f9f9;border-radius:6px;">
            <strong>{{ p.name }}</strong> ({{ p.stats.price }}金)
            <div style="font-size:12px;color:#666;">
              发{{ p.stats.serve }} 接{{ p.stats.receive }} 正{{ p.stats.forehand }} 反{{ p.stats.backhand }} 相{{ p.stats.rally }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= 选秀阶段：玩家先选人 ================= -->
    <div v-if="appState === 'drafting'" class="drafting-view">
      <h3>【选秀签约 - 请你先选人】</h3>
      <p class="desc">你的初始阵容已就绪，当前资金 <strong>{{ myTeamGold }}</strong> 金币</p>
      <p class="desc" style="font-size:14px;">点击下方自由球员签约补强（上限 {{ MAX_TEAM_SIZE }} 人），确认后AI球队再挑选剩余球员</p>
      
      <div style="display:flex;flex-wrap:wrap;gap:15px;justify-content:center;margin:15px 0;">
        <div class="player-card" v-for="p in freeAgentsForDraft" :key="p.name" style="border:2px solid #f39c12;cursor:pointer;" @click="draftPlayer(p)">
          <h4>{{ p.name }}</h4>
          <ul class="stats">
            <li>发球: {{ p.stats.serve }} | 接发: {{ p.stats.receive }}</li>
            <li>正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }}</li>
            <li>相持: {{ p.stats.rally }} | 体能: {{ p.stats.stamina }} | 心态: {{ p.stats.mentality }}</li>
          </ul>
          <div style="font-size:16px;font-weight:bold;color:#e67e22;margin-top:8px;">💰 {{ p.stats.price }}</div>
        </div>
      </div>

      <div style="margin:15px 0;">
        <h4>我的球队 ({{ myTeamPlayers.length }}/{{ MAX_TEAM_SIZE }})</h4>
        <div class="draft-pool">
          <div class="player-card" v-for="p in myTeamPlayers" :key="p.name" style="border:2px solid #2ecc71;">
            <h4>{{ p.name }}</h4>
            <ul class="stats" style="font-size:13px;">
              <li>发{{ p.stats.serve }} 接{{ p.stats.receive }} 正{{ p.stats.forehand }} 反{{ p.stats.backhand }} 相{{ p.stats.rally }}</li>
            </ul>
            <button class="btn-danger mt" @click="removeDrafted(p)" style="width:100%;">退款取消 (💰+{{ p.stats.price }})</button>
          </div>
        </div>
      </div>

      <div class="action-bar mt">
        <button class="btn-primary huge" @click="finishDrafting">确认，进入联赛！</button>
      </div>
    </div>

    <!-- ================= 联赛信息面板 ================= -->

    <!-- ================= 冠军庆典 ================= -->
    <div v-if="appState === 'champion'" class="champion-view">
      <div class="champion-banner">
        <div class="trophy">🏆</div>
        <h2>🏆 联赛冠军诞生！</h2>
        <h1 class="champion-name" :class="{'my-champion': champion?.name === '本质队'}">
          {{ champion?.name }}
        </h1>
        <p class="champion-record">战绩：{{ champion?.wins }} 胜 {{ champion?.losses }} 负 · 积分 {{ champion?.points }}</p>
        <div v-if="champion?.name === '本质队'" class="champion-congrats">
          🎉 恭喜你率队夺得联赛总冠军！🎉
        </div>
        <div v-else class="champion-congrats">
          😤 很遗憾未能夺冠，下赛季再来！
        </div>
      </div>

      <div class="final-standings">
        <h3>最终积分榜</h3>
        <table class="standings-table">
          <thead><tr><th>排名</th><th>球队</th><th>胜/负</th><th>积分</th></tr></thead>
          <tbody>
            <tr v-for="(ts, index) in leagueStandings" :key="ts.name"
                :class="{'my-team-row': ts.name === '本质队', 'champion-row': index === 0}">
              <td>{{ index + 1 }} {{ index === 0 ? '👑' : '' }}</td>
              <td>{{ ts.name }}</td>
              <td>{{ ts.wins }} - {{ ts.losses }}</td>
              <td><strong>{{ ts.points }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="season-info" style="text-align:center;font-size:18px;margin:10px 0;">
        第 <strong>{{ seasonCount }}</strong> 赛季 · 常规赛
      </div>
      <div class="action-bar mt">
        <button class="btn-primary huge" @click="startPlayoffs" style="background:#8e44ad;margin-right:15px;">🏆 进入季后赛</button>
        <button class="btn-secondary huge" @click="resetGame">🔄 重新开始</button>
      </div>
    </div>

    <!-- ================= 季后赛模式 ================= -->
    <div v-if="appState === 'playoff'" class="playoff-view">
      <div class="playoff-header">
        <h2>🏆 季后赛 · 淘汰赛</h2>
        <p class="desc">常规赛前4名进入淘汰赛，每轮为完整团体赛，体力不恢复！</p>
      </div>

      <!-- 半决赛 -->
      <div class="bracket-round">
        <div class="round-label">半决赛（Bo5团体赛）</div>
        <div class="bracket-matches">
          <div class="bracket-match card" v-for="(s, i) in playoffBracket?.semis || []" :key="i">
            <div class="matchup-label">{{ i === 0 ? '1st vs 4th' : '2nd vs 3rd' }}</div>
            <div class="team-row" :class="{'is-winner': s.winner === s.home, 'is-player': s.home.name === '本质队'}">
              <span class="seed">#{{ i === 0 ? '1' : '2' }}</span>
              <span class="name">{{ s.home.name }}</span>
              <span class="score">{{ s.homeScore }}{{ s.winner === s.home ? ' ✓' : '' }}</span>
            </div>
            <div class="team-row" :class="{'is-winner': s.winner === s.away, 'is-player': s.away.name === '本质队'}">
              <span class="seed">#{{ i === 0 ? '4' : '3' }}</span>
              <span class="name">{{ s.away.name }}</span>
              <span class="score">{{ s.awayScore }}{{ s.winner === s.away ? ' ✓' : '' }}</span>
            </div>
            <button v-if="!s.winner" class="btn-match" @click="startPlayoffMatch(false, i)">⚔️ 开赛</button>
            <div v-else class="match-result">{{ s.winner.name }} 晋级决赛</div>
          </div>
        </div>
      </div>

      <!-- 连线 -->
      <div class="bracket-connector" v-if="playoffBracket?.semis?.every(s => s.winner)">
        <div class="connector-line"></div>
      </div>

      <!-- 决赛 -->
      <div class="bracket-round final-section" v-if="playoffBracket?.final?.home">
        <div class="round-label gold">🏆 决赛</div>
        <div class="bracket-matches centered">
          <div class="bracket-match final-match card card-gold">
            <div class="team-row" :class="{'is-winner': playoffBracket.final.winner === playoffBracket.final.home, 'is-player': playoffBracket.final.home.name === '本质队'}">
              <span class="seed">SF1</span>
              <span class="name">{{ playoffBracket.final.home.name }}</span>
              <span class="score">{{ playoffBracket.final.homeScore }}{{ playoffBracket.final.winner === playoffBracket.final.home ? ' 👑' : '' }}</span>
            </div>
            <div class="vs-divider">VS</div>
            <div class="team-row" :class="{'is-winner': playoffBracket.final.winner === playoffBracket.final.away, 'is-player': playoffBracket.final.away.name === '本质队'}">
              <span class="seed">SF2</span>
              <span class="name">{{ playoffBracket.final.away.name }}</span>
              <span class="score">{{ playoffBracket.final.awayScore }}{{ playoffBracket.final.winner === playoffBracket.final.away ? ' 👑' : '' }}</span>
            </div>
            <button v-if="!playoffBracket.final.winner" class="btn-match btn-gold" @click="startPlayoffMatch(true)">🏆 总决赛开赛！</button>
          </div>
        </div>
      </div>

      <!-- 季后赛冠军 -->
      <div v-if="playoffState === 'over'" class="playoff-champion-banner">
        <div v-if="seasonMVP" style="margin:10px 0;font-size:16px;color:#f39c12;">
          🌟 赛季MVP: <strong>{{ seasonMVP.name }}</strong>
        </div>
        <div class="trophy-big">🏆</div>
        <h1 class="playoff-champion-name">{{ playoffBracket?.final?.winner?.name }}</h1>
        <p class="playoff-champion-title">季后赛总冠军</p>
        <div class="confetti-line">🎊 🎉 🏆 🎉 🎊</div>
        <div v-if="playoffBracket?.final?.winner?.name === '本质队'" class="congrats-text">
          🥇 恭喜你夺得季后赛总冠军！这是双冠王伟业！
        </div>
        <div v-else class="congrats-text">
          💪 下赛季再来，季后赛冠军终将属于你！
        </div>
        <div class="action-bar mt" style="gap:15px;">
          <button class="btn-primary huge" @click="continueNextSeason" style="background:#27ae60;">➡️ 进入第{{ seasonCount + 1 }}赛季</button>
          <button class="btn-secondary huge" @click="resetGame">🔄 重新开始</button>
        </div>
      </div>
    </div>

    <!-- ================= 名人堂 ================= -->
    <div v-if="championsHistory.length > 0" class="hall-of-fame" style="margin-top:30px;padding:20px;background:#1a1a2e;border-radius:12px;color:gold;max-width:600px;margin-left:auto;margin-right:auto;">
      <h3 style="color:#f1c40f;margin-bottom:15px;">🏛️ 冠军名人堂</h3>
      <div v-for="(entry, i) in [...championsHistory].reverse()" :key="i" style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #333;">
        <span>第{{ entry.season }}赛季</span>
        <span style="font-weight:bold;">{{ entry.champion }}</span>
        <span>{{ entry.mvp }} 🌟</span>
      </div>
    </div>

    <!-- ================= 战术克制指南 ================= -->
    <div v-if="showTacticGuide" class="modal-overlay" @click.self="showTacticGuide = false" style="z-index:2000;">
      <div class="modal-content" style="max-width:500px;">
        <h3>📖 战术克制指南</h3>
        <table class="standings-table" style="margin-top:10px;">
          <thead><tr><th>战术</th><th>克制</th><th>被克制</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="(info, id) in tacticCounters" :key="id">
              <td><strong>{{ {normal:'常规',aggressive:'搏杀',conservative:'稳扎',target_weakness:'盯人',first_three:'前三板',rally_focus:'相持'}[id] }}</strong></td>
              <td>{{ info.strong.length ? info.strong.map(s => ({normal:'常规',aggressive:'搏杀',conservative:'稳扎',target_weakness:'盯人',first_three:'前三板',rally_focus:'相持'})[s]).join('、') : '—' }}</td>
              <td>{{ info.weak.length ? info.weak.map(s => ({normal:'常规',aggressive:'搏杀',conservative:'稳扎',target_weakness:'盯人',first_three:'前三板',rally_focus:'相持'})[s]).join('、') : '—' }}</td>
              <td style="font-size:12px;color:#666;">{{ info.desc }}</td>
            </tr>
          </tbody>
        </table>
        <button class="btn-secondary mt" @click="showTacticGuide = false">关闭</button>
      </div>
    </div>

    <!-- ================= 联赛信息面板 ================= -->
    <div v-if="appState === 'league'" class="league-view">
      <div class="league-header">
        <h2>联赛运营中心 - 第 {{ currentRound }} / {{ MAX_ROUNDS }} 轮</h2>
        <div class="gold-display">💰 俱乐部资金：{{ myTeamGold }}</div>
      </div>
      <div class="round-progress-bar">
        <div class="round-progress-fill" :style="{width: ((currentRound-1)/MAX_ROUNDS*100) + '%'}"></div>
        <span class="round-progress-text">赛季进度 {{ Math.floor((currentRound-1)/MAX_ROUNDS*100) }}%</span>
      </div>
      
      <div class="dashboard">
        <!-- 积分榜 -->
        <div class="standings-box box-panel">
          <h3>🏆 联赛积分榜</h3>
          <table class="standings-table">
            <thead><tr><th>排名</th><th>球队</th><th>胜/负</th><th>积分</th></tr></thead>
            <tbody>
              <tr v-for="(ts, index) in leagueStandings" :key="ts.name" :class="{'my-team-row': ts.name === '本质队'}">
                <td>{{ index + 1 }}</td>
                <td>{{ ts.name }}</td>
                <td>{{ ts.wins }} - {{ ts.losses }}</td>
                <td><strong>{{ ts.points }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="my-team-box box-panel">
          <h3>我的阵容 
            <button class="btn-secondary" style="float: right; padding: 5px 10px; margin-left: 5px;" @click="showSkillBook = true">📖 技能</button>
            <button class="btn-secondary" style="float: right; padding: 5px 10px;" @click="openScout">🔍 球探</button>
          </h3>
          <div class="roster-list">
            <div class="player-pill" v-for="p in myTeamPlayers" :key="p.name" :title="'当前体力: ' + Math.floor(p.currentStamina) + '/' + p.stats.stamina">
               {{ p.name }} <span class="sta-bar"><span class="sta-fill" :style="{width: (p.currentStamina/p.stats.stamina*100)+'%'}"></span></span>
               <span class="sta-num">{{ Math.floor(p.currentStamina) }}/{{ p.stats.stamina }}</span>
             
            </div>
            <div style="font-size: 13px; color: #888; margin-top: 8px;">
              队伍人数: {{ myTeamPlayers.length }} / {{ MAX_TEAM_SIZE }}
            </div>
          </div>
          <div class="next-match-box mt" style="border-top: 2px dashed #ecf0f1; padding-top: 15px;">
            <p>下一场对阵：<strong class="highlight" style="font-size: 18px;">{{ getNextOpponent().name }}</strong></p>
            <button class="btn-danger huge mt" :disabled="myTeamPlayers.length < 3" @click="goToRoster" style="width: 100%;">
              {{ myTeamPlayers.length < 3 ? '球队不足 3 人，请前往球探中心买人！' : '前往球场迎战！' }}
            </button>
          </div>

          <!-- 🏋️ 训练营 -->
          <div style="border-top: 2px dashed #ecf0f1; padding-top: 15px; margin-top: 15px;">
            <h3 style="margin:0 0 10px 0;">🏋️ 训练营
              <button class="btn-secondary" style="float:right;padding:3px 10px;font-size:13px;" @click="showTraining = !showTraining">{{ showTraining ? '收起' : '展开' }}</button>
            </h3>
            <div v-if="showTraining">
              <p class="desc" style="font-size:14px;margin:5px 0;">花费金币训练球员属性，越接近潜力上限费用越高</p>
              <div v-for="p in myTeamPlayers" :key="'train-'+p.name" style="background:#f9f9f9;border-radius:8px;padding:10px;margin:8px 0;border:1px solid #2ecc71;">
                <strong>{{ p.name }}</strong> <span style="font-size:12px;color:#888;">(潜力上限)</span>
                <ul class="stats" style="margin:5px 0 0 0;">
                  <li v-for="s in ['serve','receive','forehand','backhand','rally']" :key="s" style="display:inline-block;margin-right:10px;">
                    {{ {serve:'发球',receive:'接发',forehand:'正手',backhand:'反手',rally:'相持'}[s] }}: {{ p._baseStats[s] }}/{{ p._maxStats[s]||'∞' }}
                    <button v-if="p._baseStats[s] < (p._maxStats[s]||999)" class="train-btn" @click="trainPlayer(p, s)" :title="'训练费用: '+p.getTrainCost(s)+'金'">↑{{ p.getTrainCost(s) }}金</button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ================= 转会市场 ================= -->
    <div v-if="appState === 'scout'" class="scout-view">
      <div class="league-header">
        <h2>🔍 球探中心 & 转会市场</h2>
        <div class="gold-display">💰 当前资金：{{ myTeamGold }}</div>
      </div>
      <p class="desc">你可以签约下方的自由球员，扩充你的球队板凳深度！</p>
      
      <h3>自由市场</h3>
      <div class="draft-pool">
        <div class="player-card" v-for="p in scoutPoolPlayers" :key="p.name" style="border: 2px solid #f39c12; cursor: default;">
          <h4>{{ p.name }}</h4>
          <ul class="stats">
            <li>发球: {{ p.stats.serve }} | 接发: {{ p.stats.receive }}</li>
            <li>正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }}</li>
            <li>相持: {{ p.stats.rally }} | 体能: {{ p.stats.stamina }} | 心态: {{ p.stats.mentality }}</li>
          </ul>
          <button class="btn-action mt" @click="buyPlayer(p, false)" style="width: 100%;">签约 (💰{{ p.stats.price }})</button>
        </div>
      </div>

      <h3 style="margin-top: 30px;">其他俱乐部 — 可强挖球员 (溢价50%)</h3>
      <div v-for="team in leagueTeams" :key="team.id" v-show="team.id !== 'team_mine'">
        <template v-if="team.players.filter(p => !p.isCore).length > 0">
          <h4 style="color: #666; margin-bottom: 5px;">{{ team.name }}</h4>
          <div class="draft-pool" style="margin-bottom: 20px;">
            <div class="player-card" v-for="p in team.players.filter(p => !p.isCore)" :key="p.name" style="border: 2px solid #e74c3c; cursor: default;">
              <h4>{{ p.name }}</h4>
              <ul class="stats">
                <li>发球: {{ p.stats.serve }} | 接发: {{ p.stats.receive }}</li>
                <li>正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }}</li>
                <li>相持: {{ p.stats.rally }} | 体能: {{ p.stats.stamina }} | 心态: {{ p.stats.mentality }}</li>
              </ul>
              <button class="btn-primary mt" @click="buyPlayer(p, true)" style="width: 100%; background: #e74c3c;">
                强挖 (💰{{ Math.floor(p.stats.price * 1.5) }})
              </button>
            </div>
          </div>
        </template>
      </div>
      <p v-if="!leagueTeams.some(t => t.id !== 'team_mine' && t.players.some(p => !p.isCore))" class="desc" style="color: #999;">暂无AI非核心球员可供强挖</p>

      <div class="action-bar mt">
        <button class="btn-secondary huge" @click="appState = 'league'">返回联赛运营</button>
      </div>

      <h3 style="margin-top: 30px;">我的球队 — 卖出球员 (回收80%价格)</h3>
      <div class="draft-pool" style="margin-bottom: 20px;">
        <div class="player-card" v-for="p in myTeamPlayers" :key="p.name" style="border: 1px solid #e74c3c; cursor: default;">
          <h4>{{ p.name }}</h4>
          <ul class="stats">
            <li>发球: {{ p.stats.serve }} | 接发: {{ p.stats.receive }}</li>
            <li>正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }}</li>
            <li>相持: {{ p.stats.rally }} | 体能: {{ p.stats.stamina }} | 心态: {{ p.stats.mentality }}</li>
          </ul>
          <button class="btn-danger mt" @click="sellPlayer(p)" style="width: 100%;">卖出 (💰+{{ Math.floor(p.stats.price * 0.8) }})</button>
        </div>
      </div>
    </div>
    
    <!-- ================= 排兵布阵阶段 ================= -->
    <div v-if="appState === 'roster'" class="roster-view">
      <div class="view-header">
        <button class="btn-back" @click="appState = 'league'">← 返回联赛</button>
        <h3>赛前更衣室 - 排兵布阵</h3>
      </div>
      <p class="desc">请点击球员进入槽位（再次点击已选中球员可移出）。你即将对阵：<strong>{{ getNextOpponent().name }}</strong>
        <button class="btn-link" @click="showOpponentRoster = true">📋 查看对手大名单</button>
      </p>
      
      <!-- 出场槽位 -->
      <div class="slots-container">
        <div class="slot" v-for="(player, index) in rosterSlots" :key="index" @click="player && selectPlayer(player)">
          <div class="slot-label">{{ slotLabels[index] }}</div>
          <div class="slot-card" :class="{'empty': !player}">
            <span v-if="player">{{ player.name }}</span>
            <span v-else>+ 待指派</span>
          </div>
        </div>
      </div>

      <!-- 球员池 -->
      <h4>候补球员池</h4>
      <div class="pool-container">
        <div class="pool-card" 
             v-for="p in playerPool" :key="p.name"
             :class="{'selected': rosterSlots.includes(p)}"
             @click="selectPlayer(p)">
          <strong>{{ p.name }}</strong>
          <div style="font-size:12px;color:#888;margin-top:3px;">
            ⚡体力 {{ Math.floor(p.currentStamina) }}/{{ p.stats.stamina }}
            <span class="sta-bar"><span class="sta-fill" :style="{width: (p.currentStamina/p.stats.stamina*100)+'%'}"></span></span>
          </div>
          <div class="stats">正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }} <br> 心态: {{ p.stats.mentality }}</div>
        </div>
      </div>

      <div class="actions">
        <button class="btn-secondary" @click="appState = 'league'">← 返回联赛</button>
        <button class="btn-primary huge" :disabled="!isRosterReady" @click="confirmRosterAndStart">
          提交名单并开始对决
        </button>
      </div>
    </div>

    <!-- ================= 比赛进行阶段 ================= -->
    <div v-if="appState === 'match'" class="match-view">
      
      <!-- 顶部信息 -->
      <div class="team-header">
        <div class="team-box home">
           <h3>本质队(主队)</h3>
           <div class="big-score">{{ teamScore.home }}</div>
        </div>
        <div class="vs-text">团体总比分<br>BO5</div>
        <div class="team-box away">
           <h3>{{ getNextOpponent().name }}(客)</h3>
           <div class="big-score">{{ teamScore.away }}</div>
        </div>
      </div>

      <!-- 对阵表区 -->
      <div class="fixtures-list">
        <div class="fixture-row" v-for="(fix, idx) in fixtures" :key="fix.id" 
             :class="{'active': idx === activeFixtureIndex && !isMatchFinished, 'finished': fix.winner}">
          <div class="f-home">{{ fix.home.name }}</div>
          <div class="f-mid">
            <span v-if="fix.winner" class="result">
              {{ fix.match.scoreA }} : {{ fix.match.scoreB }}
              (胜者: {{ fix.winner === 'home' ? fix.home.name : fix.away.name }})
            </span>
            <span v-else-if="idx === activeFixtureIndex && !isMatchFinished">正在进行...</span>
            <span v-else>第 {{ fix.id }} 盘</span>
          </div>
          <div class="f-away">{{ fix.away.name }}</div>
        </div>
      </div>

      <!-- 当前对决控制区 -->
      <div class="current-series-panel" v-if="!isMatchFinished">
        <h4 v-if="!activeSeriesInfo">等待由教练发令进入下一盘比赛...</h4>
        <div v-else>
           <h3 class="highlight">正在打：{{ fixtures[activeFixtureIndex].home.name }} VS {{ fixtures[activeFixtureIndex].away.name }}</h3>
           
           <div class="series-score-board">
             <!-- 这里的比分是 BO5 的大分，内部还嵌套一个小分 -->
             大分：{{ activeSeriesInfo.scoreA }} - {{ activeSeriesInfo.scoreB }}
             <span style="margin-left:20px; color:#f39c12">
               (局内小分: {{ activeSeriesInfo.currentGameObj ? activeSeriesInfo.currentGameObj.scoreA : 0 }} 
               : {{ activeSeriesInfo.currentGameObj ? activeSeriesInfo.currentGameObj.scoreB : 0 }})
             </span>
             
             <div class="tactic-tag" v-if="activeSeriesInfo.playerA_Tactic !== 'normal'">
               当前战术: {{ tacticOptions.find(t=>t.id===activeSeriesInfo.playerA_Tactic)?.label }}
             </div>
           </div>
        </div>

        <div class="controls-match mt">
          <button class="btn-primary" v-if="!activeSeriesInfo" @click="startNextFixture">进入第{{ activeFixtureIndex + 1 }}盘单打</button>
          
          <template v-if="activeSeriesInfo && !activeSeriesInfo.isSeriesFinished">
             <!-- 没有活动中的 Game时（局间休息） -->
             <template v-if="!activeSeriesInfo.hasActiveGame">
                <button class="btn-secondary" @click="openTacticBoardBreak">局间战术板</button>
                <button class="btn-primary" @click="startNextGameInSeries">发兵新一局</button>
             </template>
             
             <!-- 有活动中的 Game 时（比赛进行中） -->
             <template v-if="activeSeriesInfo.hasActiveGame">
                <!-- 局内唯一的暂停特权 -->
                <button class="btn-secondary" @click="callTimeout" :disabled="activeSeriesInfo.timeoutUsedA">
                  {{ activeSeriesInfo.timeoutUsedA ? '暂停已用' : '叫暂停' }}
                </button>
                <button class="btn-action" @click="playPoint">模拟一球</button>
             </template>
             
             <button class="btn-danger" v-if="activeSeriesInfo" @click="autoSkipCurrentSeries">一键打完本盘</button>
          </template>
        </div>
      </div>

      <!-- 悬浮态教练战术板 Modal -->
      <div class="modal-overlay" v-if="isTacticBoardOpen">
        <div class="modal-content">
          <h3>📋 教练战术安排</h3>
          <p>针对目前的场上局势（体能与比分），你希望场上球员接下来如何贯彻战术？</p>
          <div class="tactic-choices">
            <div class="tactic-item" v-for="t in tacticOptions" :key="t.id"
                 :class="{'selected': selectedTactic === t.id}"
                 @click="selectedTactic = t.id">
              <h4>{{ t.label }}</h4>
              <p>{{ t.desc }}</p>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" @click="showTacticGuide = true">📖 战术克制</button>
            <button class="btn-secondary" @click="isTacticBoardOpen = false; selectedTactic = 'normal'">取消</button>
            <button class="btn-action huge" @click="applyTactic">确认战术，回到赛场！</button>
          </div>
        </div>
      </div>

      <div class="finish-panel" v-else>
         <button class="btn-primary huge" @click="resetToMenu">返回首页重新布阵</button>
      </div>

      <!-- 日志播报区 -->
      <div class="logs">
        <ul>
          <li v-for="(log, index) in [...logs].reverse()" :key="index">{{ log }}</li>
        </ul>
      </div>

    </div>

    <!-- ========= 技能查询表 Modal ========= -->
    <div class="modal-overlay" v-if="showSkillBook" @click.self="showSkillBook = false">
      <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
        <h3>📖 球员技能大全</h3>
        <table class="skill-table">
          <thead><tr><th>技能名</th><th>效果</th><th>拥有球员</th></tr></thead>
          <tbody>
            <tr v-for="s in skillList" :key="s.id">
              <td><strong>{{ s.name }}</strong></td>
              <td>{{ s.desc }}</td>
              <td>{{ (skillToPlayers[s.name] || []).join('、') }}</td>
            </tr>
          </tbody>
        </table>
        <hr style="margin: 20px 0;">
        <h3>📊 体能消耗系数x</h3>
        <p style="font-size:13px;color:#888;text-align:left;">每盘消耗 = 20 × 战术倍率 × x。x越低越省体力。</p>
        <table class="skill-table">
          <thead><tr><th>价格档</th><th>x系数</th><th>举例</th><th>常规消耗</th><th>搏杀消耗</th></tr></thead>
          <tbody>
            <tr><td>1000</td><td><strong>0.75</strong></td><td>樊振东/张继科/马龙</td><td>15</td><td>23</td></tr>
            <tr><td>900</td><td><strong>0.80</strong></td><td>瓦尔德内尔/王皓</td><td>16</td><td>24</td></tr>
            <tr><td>800</td><td><strong>0.85</strong></td><td>张本/林昀儒/波尔等</td><td>17</td><td>26</td></tr>
            <tr><td>700</td><td><strong>0.90</strong></td><td>奥恰/王励勤/刘国梁</td><td>18</td><td>27</td></tr>
            <tr><td>600</td><td><strong>0.95</strong></td><td>雨果/许昕/林高远等</td><td>19</td><td>29</td></tr>
            <tr><td>500</td><td><strong>1.00</strong></td><td>弗朗西斯卡/方博</td><td>20</td><td>30</td></tr>
            <tr><td>400</td><td><strong>1.05</strong></td><td>阿鲁纳</td><td>21</td><td>32</td></tr>
            <tr><td>200~100</td><td><strong>1.10</strong></td><td>哈基阔/哈基羊</td><td>22</td><td>33</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:#999;text-align:left;margin-top:8px;">战术倍率：搏杀/相持1.5、前三板1.3、稳扎稳打0.8、常规/死盯反手1.0。每板额外消耗微量体力。</p>
        <button class="btn-secondary mt" @click="showSkillBook = false" style="margin-top:15px">关闭</button>
      </div>
    </div>

    <!-- ========= 对手大名单 Modal ========= -->
    <div class="modal-overlay" v-if="showOpponentRoster" @click.self="showOpponentRoster = false">
      <div class="modal-content" style="max-width: 500px;">
        <h3>📋 {{ getNextOpponent().name }} — 大名单</h3>
        <div class="draft-pool" style="margin-top:15px;">
          <div class="player-card" v-for="p in getNextOpponent().players" :key="p.name" style="cursor:default; border:1px solid #ddd;">
            <h4>{{ p.name }}</h4>
            <ul class="stats">
              <li>正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }}</li>
              <li>相持: {{ p.stats.rally }} | 体能: {{ Math.floor(p.currentStamina) }}/{{ p.stats.stamina }}</li>
              <li>技能: {{ p.skills?.length ? p.skills.map(s => SKILLS[s]?.name).join('、') : '无' }}</li>
            </ul>
          </div>
        </div>
        <button class="btn-secondary mt" @click="showOpponentRoster = false" style="margin-top:15px">关闭</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ========= 全局基础 ========= */
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #222;
}
h1 { text-align: center; color: #1a3a5c; font-size: 28px; letter-spacing: 1px; }

/* ========= Roster 视图 ========= */
.roster-view { background: #fdfdfd; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
.view-header { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }
.view-header h3 { margin: 0; }
.btn-back { background: transparent; color: #555; border: 1px solid #ccc; border-radius: 6px; padding: 6px 14px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-back:hover { background: #eee; color: #222; border-color: #999; }
.desc { text-align: center; color: #555; margin-bottom: 20px;}
.desc .hint { color: #e67e22; font-size: 14px; }
.slots-container { display: flex; justify-content: space-around; margin-bottom: 30px; }
.slot { flex: 1; text-align: center; margin: 0 10px; }
.slot-label { font-weight: bold; margin-bottom: 5px; color: #2980b9;}
.slot-card { 
  height: 80px; display: flex; align-items: center; justify-content: center; 
  background: #ecf0f1; border: 2px solid #bdc3c7; border-radius: 8px; font-size: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;
}
.slot-card.empty { border-style: dashed; color: #95a5a6; }
.slot-card:hover { border-color: #3498db; }

.pool-container { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
.pool-card {
  width: 150px; background: white; border: 1px solid #ddd; border-radius: 6px; padding: 15px; text-align: center; 
  cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: 0.2s;
}
.pool-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.pool-card.selected { background: #e8f4fd; border-color: #3498db; opacity: 0.6; pointer-events: none;}
.pool-card .stats { font-size: 12px; color: #7f8c8d; margin-top: 8px; }

/* ========= Match 视图 ========= */
.match-view { display: flex; flex-direction: column; gap: 20px; }
.team-header {
  display: flex; justify-content: space-between; align-items: center;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white; padding: 20px 40px; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.2);
}
.team-box { text-align: center; }
.team-box h3 { margin: 0 0 10px 0; font-size: 22px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);}
.big-score { font-size: 64px; font-weight: 900; line-height: 1; color: #ffd700; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
.vs-text { text-align: center; font-weight: bold; font-size: 16px; opacity: 0.8; }

.fixtures-list { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
.fixture-row { display: flex; padding: 12px 20px; border-bottom: 1px solid #eee; text-align: center; }
.fixture-row.active { background: #e3f2fd; font-weight: bold; }
.fixture-row.finished { background: #f9f9f9; color: #777; }
.f-home { flex: 1; text-align: right; }
.f-away { flex: 1; text-align: left; }
.f-mid { flex: 1; font-size: 14px; }
.f-mid .result { color: #d35400; font-weight: bold; }

.current-series-panel { background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #bdc3c7; }
.highlight { color: #2c3e50; font-size: 20px; margin-bottom: 10px; }
.series-score-board { font-size: 18px; font-weight: bold; }

.actions, .controls-match, .finish-panel { display: flex; justify-content: center; gap: 15px; margin-top: 15px;}
button { padding: 10px 20px; font-size: 15px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s;}
button:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #3498db; color: white; }
.btn-action { background: #e74c3c; color: white; }
.btn-secondary { background: #95a5a6; color: white; }
.btn-danger { background: #f39c12; color: white; }
button.huge { padding: 15px 40px; font-size: 18px; }

/* ========= 经营/选秀 UI ========= */
.drafting-view, .league-view, .scout-view { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
.draft-pool { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
.player-card {
  width: 200px; background: white; border: 2px solid #e0e0e0; border-radius: 10px; padding: 16px;
  box-shadow: 0 3px 8px rgba(0,0,0,0.08); transition: all 0.2s;
}
.player-card:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.12); transform: translateY(-2px); }
.player-card h4 { margin: 0 0 8px 0; color: #2c3e50; font-size: 18px; text-align: center; }
.player-card .stats { list-style: none; padding: 0; margin: 0; font-size: 13px; color: #555; line-height: 1.8; }
.player-card .stats li { padding: 2px 0; }
.selectable { cursor: pointer; }
.selectable:hover { border-color: #3498db; }
.selectable.selected { border-color: #e74c3c; background: #fdeceb; }

.dashboard { display: flex; gap: 20px; justify-content: center; margin-top: 20px; text-align: left; }
.box-panel { background: rgba(255,255,255,0.8); border: 2px solid #bdc3c7; border-radius: 8px; padding: 20px; flex: 1; max-width: 450px; }
.player-pill { background: #ecf0f1; border-radius: 20px; padding: 8px 15px; margin-bottom: 10px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
.sta-bar { display: inline-block; width: 40px; height: 6px; background: #ddd; border-radius: 3px; overflow: hidden; }
.sta-fill { height: 100%; background: linear-gradient(90deg, #e74c3c, #f39c12, #2ecc71); border-radius: 3px; transition: width 0.3s; }
.sta-num { font-size: 11px; color: #888; font-weight: normal; }
.btn-link { background: none; border: none; color: #3498db; cursor: pointer; font-size: 14px; text-decoration: underline; padding: 0; margin-left: 10px; }
.btn-link:hover { color: #2980b9; }
.train-btn { background: #27ae60; color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; float: right; }
.train-btn:hover { background: #219a52; }
.skill-table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
.skill-table th, .skill-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }
.skill-table th { background: #f4f6f7; color: #34495e; }

.league-header { display: flex; justify-content: space-between; align-items: center; max-width: 800px; margin: 0 auto; }
.round-progress-bar {
  max-width: 800px; margin: 8px auto 0; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; position: relative;
}
.round-progress-fill { height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); border-radius: 4px; transition: width 0.5s; }
.round-progress-text { position: absolute; right: 0; top: -18px; font-size: 12px; color: #888; }
.gold-display { font-size: 20px; font-weight: bold; color: #f39c12; background: #FFF9E6; padding: 10px 20px; border-radius: 30px; border: 2px solid #f1c40f;}

.standings-table { width: 100%; border-collapse: collapse; text-align: center; }
.standings-table th, .standings-table td { padding: 12px; border-bottom: 1px solid #ddd; }
.standings-table th { background: #f4f6f7; color: #34495e; }
.my-team-row { background-color: #e8f4fd; font-weight: bold; color: #2980b9;}
.champion-row { background-color: #fff8e1; }
.champion-view { text-align: center; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.champion-banner { padding: 30px; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 12px; color: white; margin-bottom: 24px; }
.champion-banner .trophy { font-size: 72px; animation: pulse 2s infinite; }
.champion-name { font-size: 42px; margin: 10px 0; color: #ffd700; text-shadow: 0 0 20px rgba(255,215,0,0.5); }
.champion-name.my-champion { color: #ff6b6b; text-shadow: 0 0 30px rgba(255,107,107,0.6); }
.champion-record { font-size: 18px; opacity: 0.8; }
.champion-congrats { font-size: 22px; margin-top: 15px; padding: 15px; border-radius: 8px; background: rgba(255,255,255,0.1); }
.final-standings { max-width: 500px; margin: 0 auto; text-align: left; }
.final-standings h3 { text-align: center; color: #2c3e50; }

/* ========= 教练战术板 Modal ========= */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.modal-content {
  background: white; padding: 30px; border-radius: 12px; max-width: 500px; text-align: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}
.modal-content h3 { color: #2c3e50; margin-top: 0; }
.modal-actions { display: flex; justify-content: center; gap: 12px; margin-top: 20px; }
.tactic-choices {
  display: flex; flex-direction: column; gap: 10px; margin-top: 20px;
}
.tactic-item {
  border: 2px solid #ecf0f1; border-radius: 8px; padding: 10px; cursor: pointer; text-align: left;
  transition: 0.2s;
}
.tactic-item:hover { border-color: #bdc3c7; background: #fafafa;}
.tactic-item.selected { border-color: #3498db; background: #e8f4fd; }
.tactic-item h4 { margin: 0 0 5px 0; color: #2980b9; }
.tactic-item p { margin: 0; font-size: 13px; color: #7f8c8d; }

.tactic-tag {
  display: inline-block; margin-top: 10px; padding: 2px 10px; background: #e74c3c; color: white;
  font-size: 12px; border-radius: 12px; animation: pulse 2s infinite;
}

/* ========= 季后赛 ========= */
.playoff-view { text-align: center; padding: 20px; background: #0f0f23; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); color: #fff; }
.playoff-header h2 { color: #ffd700; margin: 0; font-size: 28px; }
.playoff-header .desc { color: #aaa; font-size: 14px; }
.bracket-round { margin: 20px 0; }
.round-label { font-size: 16px; font-weight: bold; color: #ffd700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px; }
.round-label.gold { font-size: 20px; }
.bracket-matches { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
.bracket-matches.centered { justify-content: center; }
.bracket-match.card { background: #1a1a3e; border: 1px solid #333; border-radius: 12px; padding: 16px; width: 260px; text-align: center; }
.bracket-match.card.card-gold { border-color: #ffd700; box-shadow: 0 0 20px rgba(255,215,0,0.2); background: #1a1a2e; }
.matchup-label { font-size: 12px; color: #888; margin-bottom: 8px; }
.team-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin: 4px 0; border-radius: 6px; background: #252550; color: #ddd; font-size: 15px; }
.team-row.is-winner { background: #2a2a5a; color: #fff; font-weight: bold; border: 1px solid #4a4a8a; }
.team-row.is-player { border-left: 3px solid #ffd700; }
.team-row .seed { font-size: 11px; color: #888; width: 30px; text-align: left; }
.team-row .name { flex: 1; text-align: left; }
.team-row .score { font-weight: bold; color: #ffd700; }
.vs-divider { font-size: 14px; color: #666; padding: 4px; font-weight: bold; letter-spacing: 2px; }
.btn-match { margin-top: 10px; padding: 8px 20px; border: none; border-radius: 6px; background: #3498db; color: white; font-size: 14px; cursor: pointer; font-weight: bold; }
.btn-match.btn-gold { background: #f39c12; color: #1a1a2e; font-size: 16px; padding: 10px 24px; }
.btn-match:hover { opacity: 0.9; }
.match-result { margin-top: 8px; font-size: 13px; color: #2ecc71; }
.bracket-connector { text-align: center; padding: 8px; }
.connector-line { width: 2px; height: 24px; background: #ffd700; margin: 0 auto; }
.playoff-champion-banner { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #1a1a2e, #2a1a3e); border-radius: 16px; margin-top: 20px; }
.playoff-champion-banner .trophy-big { font-size: 80px; }
.playoff-champion-name { font-size: 36px; color: #ffd700; text-shadow: 0 0 20px rgba(255,215,0,0.5); margin: 10px 0; }
.playoff-champion-title { font-size: 18px; color: #aaa; letter-spacing: 4px; text-transform: uppercase; }
.confetti-line { font-size: 24px; margin: 10px 0; letter-spacing: 8px; }
.congrats-text { font-size: 18px; color: #ddd; margin: 15px 0; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; }

@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.logs { background: #2c3e50; color: #ecf0f1; padding: 20px; border-radius: 8px; height: 250px; overflow-y: auto; }
.logs h3 { margin-top: 0; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 16px; }
.logs ul { list-style: none; padding: 0; margin: 0; }
.logs li { margin-bottom: 6px; font-family: monospace; font-size: 13px; color: #a8e6cf; }
.mt { margin-top: 20px; }
</style>
