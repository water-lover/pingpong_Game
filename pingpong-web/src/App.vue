<script setup>
import { ref, computed } from 'vue'
import { Player, TeamMatch } from './core/PingPongMatch.js'
import { freeAgentsPool, leagueAICaching } from './data/gameData.js'
import { SKILLS } from './core/HiddenSkills.js'

// ==========================================
// ====== 数据与状态 ======
const MAX_ROUNDS = 12
const appState = ref('drafting')
const logs = ref([])
const showSkillBook = ref(false) // 技能查询表
const showOpponentRoster = ref(false) // 对手大名单

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

const myTeamGold = ref(1500)
const teamStats = ref({
  'team_mine': { name: '本质队', points: 0, wins: 0, losses: 0 },
  'team_jp':   { name: '饭圈队', points: 0, wins: 0, losses: 0 },
  'team_eu':   { name: '黑马队', points: 0, wins: 0, losses: 0 },
  'team_na':   { name: '新星队', points: 0, wins: 0, losses: 0 }
})

const isLeagueFinished = computed(() => currentRound.value > MAX_ROUNDS)

const leagueStandings = computed(() => {
  return Object.values(teamStats.value).sort((a, b) => b.points - a.points || b.wins - a.wins)
})

const champion = computed(() => {
  if (!isLeagueFinished.value) return null
  return leagueStandings.value[0]
})

// 固定的 3 轮循环对决表
const schedule = [
  [{ home: 'team_mine', away: 'team_jp' }, { home: 'team_eu', away: 'team_na' }],
  [{ home: 'team_mine', away: 'team_eu' }, { home: 'team_na', away: 'team_jp' }],
  [{ home: 'team_mine', away: 'team_na' }, { home: 'team_jp', away: 'team_eu' }]
]

// 俱乐部可用球员池 (供布阵使用)
const playerPool = computed(() => myTeamPlayers.value)

// AI 的队伍 (客队)
const enemyTeam = ref(null)

// 选秀界面: 剩余可招募名额
const maxRecruit = 1

const draftPlayer = (p) => {
  if (myTeamPlayers.value.length < maxRecruit && !myTeamPlayers.value.includes(p)) {
    myTeamPlayers.value.push(p)
  }
}
const removeDrafted = (p) => {
  myTeamPlayers.value = myTeamPlayers.value.filter(mp => mp !== p)
}
const finishDrafting = () => {
  if (myTeamPlayers.value.length === maxRecruit) {
    // 剩下的自由球员
    let remainingAgents = freeAgentsPool.filter(p => !myTeamPlayers.value.includes(p));

    // 给人机队伍补充队员（用他们自己的资金买人，注重能力）
    leagueTeams.value.forEach(team => {
      if (team.id !== 'team_mine') {
        const targetRosterSize = 5;
        while (team.players.length < targetRosterSize && remainingAgents.length > 0) {
          // 只看买得起的球员
          let affordable = remainingAgents.filter(p => p.stats.price <= team.gold);
          if (affordable.length === 0) break; // 没钱了，停手

          // 为这些球员打分：能力分 + 随机波动（为了不要100%都选同一个最好的人）
          affordable.forEach(p => {
             const abilityScore = p.stats.serve + p.stats.receive + p.stats.forehand + p.stats.backhand + p.stats.rally + p.stats.stamina * 1.5;
             // 加一点随机因素
             p._aiScore = abilityScore * (0.8 + Math.random() * 0.4); 
          });

          // 按打分从高到低排序，拿走最好的
          affordable.sort((a, b) => b._aiScore - a._aiScore);
          const drafted = affordable[0];
          
          // 扣钱加人
          team.gold -= drafted.stats.price;
          team.players.push(drafted);

          // 从剩下的池子里移除
          remainingAgents = remainingAgents.filter(pa => pa !== drafted);
        }
      }
    });

    // 经过人机挑剩下的人，正式流入我们的转会市场
    scoutPoolPlayers.value = remainingAgents;
    
    appState.value = 'league'
    saveGame()
  }
}

const getNextOpponentId = () => {
  const roundIdx = (currentRound.value - 1) % 3
  const match = schedule[roundIdx].find(m => m.home === 'team_mine' || m.away === 'team_mine')
  return match.home === 'team_mine' ? match.away : match.home
}

const getNextOpponent = () => {
  return leagueTeams.value.find(t => t.id === getNextOpponentId())
}

const goToRoster = () => {
  const oppPlayers = getNextOpponent().players
  // 如果人机队伍有多名球员（>3），让人机进行“合理”选人（按平均属性和体能优先挑选）
  if (oppPlayers.length > 3) {
    let sortedBest = [...oppPlayers].sort((a, b) => {
      // 综合评分 = 基础属性之和 + 体能
      const scoreA = a.stats.serve + a.stats.receive + a.stats.forehand + a.stats.backhand + a.stats.rally + a.stats.stamina * 2;
      const scoreB = b.stats.serve + b.stats.receive + b.stats.forehand + b.stats.backhand + b.stats.rally + b.stats.stamina * 2;
      return scoreB - scoreA;
    });
    // 选出能力最好的3个人
    enemyTeam.value = sortedBest.slice(0, 3);
  } else {
    enemyTeam.value = oppPlayers
  }
  appState.value = 'roster'
}

// 球探与转会市场
const scoutPoolPlayers = ref([])

const openScout = () => {
  // 如果自由市场空了，就直接打开，不强行生成
  appState.value = 'scout'
}

const MAX_TEAM_SIZE = 5 // 队伍人数上限

const buyPlayer = (p, isFromOtherTeam = false) => {
  // 检查人数上限
  if (myTeamPlayers.value.length >= MAX_TEAM_SIZE) {
    alert(`球队已满 ${MAX_TEAM_SIZE} 人，请先卖出现有球员！`)
    return
  }
  const cost = isFromOtherTeam ? Math.floor(p.stats.price * 1.5) : p.stats.price;
  if (myTeamGold.value >= cost) {
    myTeamGold.value -= cost
    // 这里做个深拷贝或者只记录所有权，以免直接修改对象引用
    myTeamPlayers.value.push(p)
    if (!isFromOtherTeam) {
      scoutPoolPlayers.value = scoutPoolPlayers.value.filter(mp => mp !== p)
    } else {
      // 从 AI 队伍买走
      leagueTeams.value.forEach(t => {
        if (t.players.includes(p)) {
          t.players = t.players.filter(tp => tp !== p)
          t.gold = (t.gold || 0) + cost // NPC得到卖球员的转会费
          
          // NPC球队少人后自动从市场补充一个人
          let affordable = scoutPoolPlayers.value.filter(sp => sp.stats.price <= t.gold);
          if (affordable.length > 0) {
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
  { id: 'normal', label: '常规套路', desc: '数值均衡，稳字当头' },
  { id: 'aggressive', label: '⚔️ 全线搏杀', desc: '强保正手，暴击加成，体力极速消耗' },
  { id: 'conservative', label: '🛡️ 稳扎稳打', desc: '防守反击，降低失误率，保留体力' },
  { id: 'target_backhand', label: '🎯 死盯反手', desc: '压制反手，专打对面软肋' },
  { id: 'first_three', label: '⚡ 前三板', desc: '强化发球与接发，削弱相持' },
  { id: 'rally_focus', label: '🏓 形成相持', desc: '大幅依赖相持能力和体能' }
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
  // 1. 玩家比赛结果结算
  const isWin = teamScore.value.home >= 3
  const oppId = getNextOpponentId()

  if (isWin) {
     teamStats.value['team_mine'].wins++
     teamStats.value['team_mine'].points += 3
     teamStats.value[oppId].losses++
     myTeamGold.value += 500 // 赢球奖金
  } else {
     teamStats.value['team_mine'].losses++
     teamStats.value[oppId].wins++
     teamStats.value[oppId].points += 3
     myTeamGold.value += 200 // 出场费
  }
  
  // 2. 模拟后台其他 AI 交手的比赛
  const roundIdx = (currentRound.value - 1) % 3
  const bgMatch = schedule[roundIdx].find(m => m.home !== 'team_mine' && m.away !== 'team_mine')
  if (bgMatch) {
     const bgHomeId = bgMatch.home
     const bgAwayId = bgMatch.away
     
     // 随机胜负
     if (Math.random() > 0.5) {
         teamStats.value[bgHomeId].wins++
         teamStats.value[bgHomeId].points += 3
         teamStats.value[bgAwayId].losses++
         const homeTeam = leagueTeams.value.find(t => t.id === bgHomeId);
         const awayTeam = leagueTeams.value.find(t => t.id === bgAwayId);
         if (homeTeam) homeTeam.gold = (homeTeam.gold || 0) + 500;
         if (awayTeam) awayTeam.gold = (awayTeam.gold || 0) + 200;
     } else {
         teamStats.value[bgAwayId].wins++
         teamStats.value[bgAwayId].points += 3
         teamStats.value[bgHomeId].losses++
         const homeTeam = leagueTeams.value.find(t => t.id === bgHomeId);
         const awayTeam = leagueTeams.value.find(t => t.id === bgAwayId);
         if (awayTeam) awayTeam.gold = (awayTeam.gold || 0) + 500;
         if (homeTeam) homeTeam.gold = (homeTeam.gold || 0) + 200;
     }
  }

  // 3. 轮间体力恢复（不是满血复活，恢复40%已消耗体力）
  myTeamPlayers.value.forEach(p => p.roundRecovery())
  leagueTeams.value.forEach(t => {
    if (t.id !== 'team_mine') {
      t.players.forEach(p => p.roundRecovery());
      // AI赚点小钱并可能从自由市场买人
      t.gold = (t.gold || 1000) + 100;
      // AI有30%概率从自由市场买人补充（如果还有名额）
      if (t.players.length < 5 && scoutPoolPlayers.value.length > 0 && Math.random() < 0.3) {
        let affordable = scoutPoolPlayers.value.filter(sp => sp.stats.price <= t.gold);
        if (affordable.length > 0) {
          affordable.sort((a, b) => (b.stats.serve + b.stats.receive + b.stats.forehand + b.stats.backhand) - (a.stats.serve + a.stats.receive + a.stats.forehand + a.stats.backhand));
          const pick = affordable[0];
          t.gold -= pick.stats.price;
          t.players.push(pick);
          scoutPoolPlayers.value = scoutPoolPlayers.value.filter(sp => sp !== pick);
        }
      }
    }
  })
  
  currentRound.value++
  saveGame()

  // 检查联赛是否结束
  if (currentRound.value > MAX_ROUNDS) {
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
const resetGame = () => {
  myTeamPlayers.value = []
  myTeamGold.value = 1500
  currentRound.value = 1
  teamStats.value = {
    'team_mine': { name: '本质队', points: 0, wins: 0, losses: 0 },
    'team_jp':   { name: '饭圈队', points: 0, wins: 0, losses: 0 },
    'team_eu':   { name: '黑马队', points: 0, wins: 0, losses: 0 },
    'team_na':   { name: '新星队', points: 0, wins: 0, losses: 0 }
  }
  // 重置AI队伍
  leagueTeams.value = leagueAICaching.map(t => ({
    ...t,
    wins: 0,
    losses: 0,
    gold: 1000,
    players: t.players.map(p => new Player(p.name, { ...p.stats }))
  }))
  scoutPoolPlayers.value = []
  appState.value = 'drafting'
}
</script>

<template>
  <div class="container">
    <h1>乒乓球经理 - 模拟经营</h1>

    <!-- ================= 选秀建队阶段 ================= -->
    <div v-if="appState === 'drafting'" class="drafting-view">
      <h3>【建队基石】从自由市场免费招募</h3>
      <p class="desc">请从下方自由球员中免费招募 1 名选手作为你的建队核心！（当前：{{ myTeamPlayers.length }}/1  &nbsp;|&nbsp;  <span class="hint">点击已选球员可取消选择</span>）</p>
      
      <div class="draft-pool">
        <div class="player-card selectable" 
             v-for="p in freeAgentsPool" 
             :key="p.name"
             :class="{'selected': myTeamPlayers.includes(p)}"
             @click="myTeamPlayers.includes(p) ? removeDrafted(p) : draftPlayer(p)">
          <h4>{{ p.name }}</h4>
          <ul class="stats">
            <li>发球: {{ p.stats.serve }} | 接发: {{ p.stats.receive }}</li>
            <li>正手: {{ p.stats.forehand }} | 反手: {{ p.stats.backhand }}</li>
            <li>相持: {{ p.stats.rally }} | 体能: {{ p.stats.stamina }} | 心态: {{ p.stats.mentality }}</li>
            <li v-if="p.skills?.length">✨ 技能: {{ p.skills.map(s => SKILLS[s]?.name).join('、') }}</li>
          </ul>
        </div>
      </div>
      
      <div class="action-bar mt">
        <button class="btn-primary huge" :disabled="myTeamPlayers.length !== 1" @click="finishDrafting">
          确认核心球员，进入转会市场！
        </button>
      </div>
    </div>

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

      <div class="action-bar mt">
        <button class="btn-primary huge" @click="resetGame">🔄 开始新赛季</button>
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
        <p style="font-size:13px;color:#888;text-align:left;">每盘消耗 = 10 × 战术倍率 × x。x越低越省体力。</p>
        <table class="skill-table">
          <thead><tr><th>价格档</th><th>x系数</th><th>举例</th><th>常规消耗</th><th>搏杀消耗</th></tr></thead>
          <tbody>
            <tr><td>1000</td><td><strong>0.75</strong></td><td>樊振东/张继科/马龙</td><td>8</td><td>11</td></tr>
            <tr><td>900</td><td><strong>0.80</strong></td><td>瓦尔德内尔/王皓</td><td>8</td><td>12</td></tr>
            <tr><td>800</td><td><strong>0.85</strong></td><td>张本/林昀儒/波尔等</td><td>9</td><td>13</td></tr>
            <tr><td>700</td><td><strong>0.90</strong></td><td>奥恰/王励勤/刘国梁</td><td>9</td><td>14</td></tr>
            <tr><td>600</td><td><strong>0.95</strong></td><td>雨果/许昕/林高远等</td><td>10</td><td>14</td></tr>
            <tr><td>500</td><td><strong>1.00</strong></td><td>弗朗西斯卡/方博</td><td>10</td><td>15</td></tr>
            <tr><td>400</td><td><strong>1.05</strong></td><td>阿鲁纳</td><td>11</td><td>16</td></tr>
            <tr><td>200~100</td><td><strong>1.10</strong></td><td>哈基阔/哈基羊</td><td>11</td><td>17</td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;color:#999;text-align:left;margin-top:8px;">战术倍率：搏杀/相持1.5、前三板1.3、稳扎稳打0.8、常规/死盯反手1.0</p>
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
