import { COMMUNITIES, DEPOT_ID, DIST, community, distanceById } from './data.ts'
import {
  EQUAL_AVG,
  EQUAL_MAX,
  EQUAL_SECOND_COST,
  EQUAL_SECOND_ID,
  PAPER_AB,
  PAPER_RQ,
  SENSITIVITY,
  SIMULTANEOUS_CAPACITIES,
  SINGLE_LEGS,
  SINGLE_ROUNDED,
  SINGLE_TOTAL,
  SINGLE_VISITS,
  TIGHT_PLAN,
  WIDE_PLAN,
  type PaperCourier,
  type PaperLeg,
  type PaperPlan,
} from './paper.ts'
import type {
  CourierResult,
  LabResults,
  Leg,
  LoadStop,
  PlanResult,
  PresetResult,
  RankRow,
} from './types.ts'

export interface SubsetTours {
  /** 不含代理点的客户，下标是槽位，值是 DIST 中的节点编号。 */
  customers: number[]
  tourCost: Float64Array
  /** 该子集的一条最短访问顺序，返回节点编号，不含代理点。 */
  order(mask: number): number[]
  /**
   * 对每个非空子集复用同一块缓冲，回调里的 slots[0..len) 是槽位顺序。
   * 不要把 slots 留到回调之外。
   */
  eachOrder(fn: (mask: number, slots: Int16Array, len: number) => void): void
}

/**
 * 固定从 depot 出发并返回的 Held-Karp。
 * dp[mask][j]：从代理点出发，恰好经过 mask 中的客户，停在客户 j 的最短路程。
 */
export function depotSubsets(dist: number[][], depot: number): SubsetTours {
  const customers: number[] = []
  for (let i = 0; i < dist.length; i++) {
    if (i !== depot) customers.push(i)
  }
  const n = customers.length
  if (n > 20) throw new Error('Held-Karp 只计算 20 个点以内的回路')

  const size = 1 << n
  const distDepot = new Float64Array(n)
  const distCC = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    distDepot[i] = dist[depot][customers[i]]
    for (let j = 0; j < n; j++) distCC[i * n + j] = dist[customers[i]][customers[j]]
  }

  const dp = new Float64Array(size * n)
  const parent = new Uint8Array(size * n)
  dp.fill(Number.POSITIVE_INFINITY)
  parent.fill(255)
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = distDepot[j]

  for (let mask = 0; mask < size; mask++) {
    if ((mask & (mask - 1)) === 0) continue
    for (let j = 0; j < n; j++) {
      const jBit = 1 << j
      if ((mask & jBit) === 0) continue
      const prev = mask ^ jBit
      let best = Number.POSITIVE_INFINITY
      let bestI = 0
      let bits = prev
      while (bits) {
        const bit = bits & -bits
        const i = 31 - Math.clz32(bit)
        const cost = dp[prev * n + i] + distCC[i * n + j]
        if (cost < best) {
          best = cost
          bestI = i
        }
        bits ^= bit
      }
      dp[mask * n + j] = best
      parent[mask * n + j] = bestI
    }
  }

  const tourCost = new Float64Array(size)
  for (let mask = 1; mask < size; mask++) {
    let best = Number.POSITIVE_INFINITY
    for (let j = 0; j < n; j++) {
      if ((mask & (1 << j)) === 0) continue
      const cost = dp[mask * n + j] + distDepot[j]
      if (cost < best) best = cost
    }
    tourCost[mask] = best
  }

  const stack = new Int16Array(n)
  const buf = new Int16Array(n)

  function fillSlots(mask: number): number {
    if (mask === 0) return 0
    let bestJ = 0
    let best = Number.POSITIVE_INFINITY
    for (let j = 0; j < n; j++) {
      if ((mask & (1 << j)) === 0) continue
      const cost = dp[mask * n + j] + distDepot[j]
      if (cost < best) {
        best = cost
        bestJ = j
      }
    }
    let sp = 0
    let m = mask
    let j = bestJ
    while (m !== 0) {
      stack[sp++] = j
      const prev = parent[m * n + j]
      m ^= 1 << j
      if (m === 0) break
      j = prev
    }
    for (let k = 0; k < sp; k++) buf[k] = stack[sp - 1 - k]
    return sp
  }

  return {
    customers,
    tourCost,
    order(mask: number): number[] {
      const len = fillSlots(mask)
      const nodes: number[] = []
      for (let k = 0; k < len; k++) nodes.push(customers[buf[k]])
      return nodes
    },
    eachOrder(fn) {
      for (let mask = 1; mask < size; mask++) {
        const len = fillSlots(mask)
        fn(mask, buf, len)
      }
    },
  }
}

export function rankDepots(alpha: number, beta: number): RankRow[] {
  const weights = COMMUNITIES.map((c) => alpha * c.delivery + beta * c.pickup)
  let sumW = 0
  for (const w of weights) sumW += w
  const rows = COMMUNITIES.map((cand, j) => {
    let cost = 0
    let maxDistance = 0
    for (let i = 0; i < COMMUNITIES.length; i++) {
      const d = DIST[i][j]
      cost += weights[i] * d
      if (i !== j && d > maxDistance) maxDistance = d
    }
    return {
      id: cand.id,
      cost,
      avgDistance: sumW === 0 ? 0 : cost / sumW,
      maxDistance,
    }
  })
  rows.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
  return rows
}

export function closedLength(sequence: string[], depot = DEPOT_ID): number {
  if (sequence.length === 0) return 0
  let length = distanceById(depot, sequence[0])
  for (let i = 0; i < sequence.length - 1; i++) {
    length += distanceById(sequence[i], sequence[i + 1])
  }
  length += distanceById(sequence[sequence.length - 1], depot)
  return length
}

/** 出发时装上全部派件，每到一处减去派件、加上收件。峰值含出发时的载量。 */
export function loadProfile(sequence: string[], depot = DEPOT_ID): { maxLoad: number; profile: LoadStop[] } {
  let load = 0
  for (const id of sequence) load += community(id).delivery
  let maxLoad = load
  const profile: LoadStop[] = [{ id: depot, load }]
  for (const id of sequence) {
    const stop = community(id)
    load = load - stop.delivery + stop.pickup
    if (load > maxLoad) maxLoad = load
    profile.push({ id, load })
  }
  return { maxLoad, profile }
}

function setKey(ids: string[]): string {
  return ids.slice().sort().join(',')
}

function sameSet(a: string[], b: string[]): boolean {
  return setKey(a) === setKey(b)
}

function cycleKey(ids: string[]): string {
  const ring = ids[0] === ids[ids.length - 1] ? ids.slice(0, -1) : ids.slice()
  const rotations = (arr: string[]) => arr.map((_, i) => arr.slice(i).concat(arr.slice(0, i)).join('-'))
  const forward = rotations(ring).sort()[0]
  const backward = rotations(ring.slice().reverse()).sort()[0]
  return forward < backward ? forward : backward
}

type PeakKind = 'max'

/**
 * 同时取派的能力用「两个方向里较高的峰值」。
 * 论文报告的最大载件是某一条最短回路上的峰值；这四条路线都取到了两个方向中较高的那个。
 * 宽分组两个方向的峰值是 208 和 201，都不超过 200 的方向不存在，所以四种能力都进不了那一组。
 * 用较高峰值做约束，和「较低峰值」在这四个能力上选出的分组一致，并和论文的 186 对齐。
 */
const SIMULTANEOUS_KIND: PeakKind = 'max'

export function computeAll(): LabResults {
  const depot = COMMUNITIES.findIndex((c) => c.id === DEPOT_ID)
  const subsets = depotSubsets(DIST, depot)
  const n = subsets.customers.length
  const full = (1 << n) - 1
  const idOfSlot = subsets.customers.map((node) => COMMUNITIES[node].id)
  const del = Int32Array.from(idOfSlot.map((id) => community(id).delivery))
  const pick = Int32Array.from(idOfSlot.map((id) => community(id).pickup))

  const sumDel = new Int32Array(1 << n)
  const sumPick = new Int32Array(1 << n)
  for (let mask = 1; mask < 1 << n; mask++) {
    const bit = mask & -mask
    const slot = 31 - Math.clz32(bit)
    const rest = mask ^ bit
    sumDel[mask] = sumDel[rest] + del[slot]
    sumPick[mask] = sumPick[rest] + pick[slot]
  }

  const peakForward = new Int32Array(1 << n)
  const peakReverse = new Int32Array(1 << n)
  subsets.eachOrder((mask, slots, len) => {
    peakForward[mask] = peakOn(slots, len, del, pick, false)
    peakReverse[mask] = peakOn(slots, len, del, pick, true)
  })

  const idsOf = (mask: number) => {
    const ids: string[] = []
    for (let slot = 0; slot < n; slot++) {
      if (mask & (1 << slot)) ids.push(idOfSlot[slot])
    }
    return ids
  }

  const fits = (mask: number, cap: number, kind: 'delivery' | PeakKind) => {
    if (kind === 'delivery') return sumDel[mask] <= cap
    return Math.max(peakForward[mask], peakReverse[mask]) <= cap
  }

  const search = (cap: number, kind: 'delivery' | PeakKind) => {
    let best = Number.POSITIVE_INFINITY
    let bestMask = -1
    for (let mask = 1; mask < full; mask++) {
      const comp = full ^ mask
      if (mask > comp) continue
      if (!fits(mask, cap, kind) || !fits(comp, cap, kind)) continue
      const cost = subsets.tourCost[mask] + subsets.tourCost[comp]
      if (cost < best) {
        best = cost
        bestMask = mask
      }
    }
    if (bestMask < 0) throw new Error(`能力 ${cap} 在约束「${kind}」下没有可行分组`)
    return { cost: best, mask: bestMask }
  }

  const orient = (mask: number, paper: string[]) => {
    const nodeOrder = subsets.order(mask)
    const idByNode = new Map(COMMUNITIES.map((c, index) => [index, c.id]))
    const natural = nodeOrder.map((node) => idByNode.get(node)!)
    const optimal = subsets.tourCost[mask]
    if (sameSet(natural, paper) && Math.abs(closedLength(paper) - optimal) <= 1e-4) {
      return paper.slice()
    }
    return natural
  }

  const presentCourier = (mask: number, paper: PaperCourier): CourierResult => {
    const sequence = orient(mask, paper.sequence)
    const length = closedLength(sequence)
    if (Math.abs(length - subsets.tourCost[mask]) > 1e-4) {
      throw new Error(`展示路线长度 ${length} 与最短路 ${subsets.tourCost[mask]} 不一致`)
    }
    const load = loadProfile(sequence)
    return {
      sequence,
      deliveries: sumDel[mask],
      pickups: sumPick[mask],
      length,
      maxLoad: load.maxLoad,
      loadProfile: load.profile,
      paperSequence: paper.sequence,
      paperDeliveries: paper.deliveries,
      paperPickups: paper.pickups,
      paperLength: paper.length.value,
      paperLengthText: paper.length.text,
      paperMaxLoad: paper.maxLoad,
    }
  }

  const presentPlan = (cap: number, kind: 'delivery' | PeakKind, paper: PaperPlan): PlanResult => {
    const found = search(cap, kind)
    const comp = full ^ found.mask
    const groupA = idsOf(found.mask)
    const wantA = paper.couriers[0].sequence
    const maskA = sameSet(groupA, wantA) ? found.mask : comp
    const maskB = full ^ maskA
    const couriers: [CourierResult, CourierResult] = [
      presentCourier(maskA, paper.couriers[0]),
      presentCourier(maskB, paper.couriers[1]),
    ]
    return {
      capacity: cap,
      totalLength: couriers[0].length + couriers[1].length,
      paperTotalLength: paper.total.value,
      paperTotalText: paper.total.text,
      couriers,
    }
  }

  const singleNodes = subsets.order(full)
  const idByNode = new Map(COMMUNITIES.map((c, index) => [index, c.id]))
  const naturalVisits = singleNodes.map((node) => idByNode.get(node)!)
  const naturalLength = closedLength(naturalVisits)
  if (Math.abs(naturalLength - subsets.tourCost[full]) > 1e-6) {
    throw new Error(`最短回路复原长度 ${naturalLength} 与 DP ${subsets.tourCost[full]} 不一致`)
  }
  let visits = [DEPOT_ID, ...naturalVisits]
  if (cycleKey(visits) === cycleKey(SINGLE_VISITS) && Math.abs(subsets.tourCost[full] - SINGLE_TOTAL.value) <= 1e-4) {
    visits = SINGLE_VISITS.slice()
  }
  const legs = buildLegs(visits, SINGLE_LEGS)

  const presets: PresetResult[] = SENSITIVITY.map((preset) => {
    const ranking = rankDepots(preset.alpha, preset.beta)
    const equal = preset.alpha === 1 && preset.beta === 1
    return {
      name: preset.name,
      alpha: preset.alpha,
      beta: preset.beta,
      bestId: ranking[0].id,
      paperBestId: DEPOT_ID,
      paperCost: preset.cost.value,
      paperCostText: preset.cost.text,
      ranking,
      paperAvgDistance: equal ? EQUAL_AVG.value : null,
      paperAvgText: equal ? EQUAL_AVG.text : null,
      paperMaxDistance: equal ? EQUAL_MAX.value : null,
      paperMaxText: equal ? EQUAL_MAX.text : null,
      paperSecondId: equal ? EQUAL_SECOND_ID : null,
      paperSecondCost: equal ? EQUAL_SECOND_COST.value : null,
      paperSecondText: equal ? EQUAL_SECOND_COST.text : null,
    }
  })

  const a = community('A')
  const b = community('B')
  const r = community('R')
  const q = community('Q')

  return {
    checks: [
      { name: 'A–B', computed: distanceById(a.id, b.id), paper: PAPER_AB.value, paperText: PAPER_AB.text },
      { name: 'R–Q', computed: distanceById(r.id, q.id), paper: PAPER_RQ.value, paperText: PAPER_RQ.text },
    ],
    presets,
    single: {
      visits,
      legs,
      total: legs[legs.length - 1]?.cumulative ?? 0,
      paperTotal: SINGLE_TOTAL.value,
      paperTotalText: SINGLE_TOTAL.text,
      paperRoundedText: SINGLE_ROUNDED.text,
    },
    delivery: [200, 195].map((cap) => presentPlan(cap, 'delivery', WIDE_PLAN)).concat(
      [190, 186].map((cap) => presentPlan(cap, 'delivery', TIGHT_PLAN)),
    ),
    simultaneous: SIMULTANEOUS_CAPACITIES.map((cap) => presentPlan(cap, SIMULTANEOUS_KIND, TIGHT_PLAN)),
  }
}

function peakOn(
  slots: Int16Array,
  len: number,
  del: Int32Array,
  pick: Int32Array,
  reverse: boolean,
): number {
  let load = 0
  for (let k = 0; k < len; k++) load += del[slots[k]]
  let maxLoad = load
  if (!reverse) {
    for (let k = 0; k < len; k++) {
      load = load - del[slots[k]] + pick[slots[k]]
      if (load > maxLoad) maxLoad = load
    }
  } else {
    for (let k = len - 1; k >= 0; k--) {
      load = load - del[slots[k]] + pick[slots[k]]
      if (load > maxLoad) maxLoad = load
    }
  }
  return maxLoad
}

function buildLegs(visits: string[], paper: PaperLeg[]): Leg[] {
  const ring = [...visits, visits[0]]
  const legs: Leg[] = []
  let cumulative = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const segment = distanceById(ring[i], ring[i + 1])
    cumulative += segment
    legs.push({
      from: ring[i],
      to: ring[i + 1],
      distance: segment,
      cumulative,
      paperDistance: null,
      paperCumulative: null,
    })
  }
  if (paper.length === legs.length && paper.every((leg, i) => leg.from === legs[i].from && leg.to === legs[i].to)) {
    for (let i = 0; i < legs.length; i++) {
      legs[i].paperDistance = paper[i].distance
      legs[i].paperCumulative = paper[i].cumulative
    }
  }
  return legs
}

export function verify(results: LabResults): string[] {
  const problems: string[] = []
  const check = (name: string, got: number, paper: number, eps = 0.02) => {
    const diff = Math.abs(got - paper)
    if (!(diff < eps)) problems.push(`${name}：本次 ${got}，论文 ${paper}，相差 ${diff}`)
  }

  for (const item of results.checks) check(item.name, item.computed, item.paper, 1e-9)

  for (const preset of results.presets) {
    if (preset.bestId !== 'R') problems.push(`${preset.name} 的最优不是 R，而是 ${preset.bestId}`)
    check(`${preset.name} 成本`, preset.ranking[0].cost, preset.paperCost, 1e-4)
    if (preset.ranking[0].id !== preset.bestId) problems.push(`${preset.name} 排名第一与 bestId 不一致`)
  }

  const equal = results.presets.find((preset) => preset.name === '派收同权')
  if (!equal) {
    problems.push('缺少派收同权')
  } else {
    check('平均距离', equal.ranking[0].avgDistance, EQUAL_AVG.value, 1e-6)
    check('最大距离', equal.ranking[0].maxDistance, EQUAL_MAX.value, 1e-6)
    if (equal.ranking[1]?.id !== 'S') problems.push(`第二名是 ${equal.ranking[1]?.id}，论文是 S`)
    check('S 的成本', equal.ranking[1].cost, EQUAL_SECOND_COST.value, 1e-4)
  }

  check('单人总长', results.single.total, SINGLE_TOTAL.value, 1e-4)
  check('单人总长（两位小数）', results.single.total, SINGLE_ROUNDED.value)
  if (cycleKey(results.single.visits) !== cycleKey(SINGLE_VISITS)) {
    problems.push(`单人路线 ${results.single.visits.join('-')} 与论文回路不同`)
  }
  if (results.single.legs.some((leg) => leg.paperDistance === null)) {
    problems.push('单人路段没有逐段对齐论文')
  } else {
    for (const leg of results.single.legs) {
      check(`${leg.from}-${leg.to}`, leg.distance, leg.paperDistance ?? 0, 1e-6)
      check(`${leg.from}-${leg.to} 累计`, leg.cumulative, leg.paperCumulative ?? 0, 1e-4)
    }
  }

  const expectPlan = (plan: PlanResult, paper: PaperPlan) => {
    check(`能力 ${plan.capacity} 总长`, plan.totalLength, paper.total.value)
    plan.couriers.forEach((courier, index) => {
      const expected = paper.couriers[index]
      const tag = `能力 ${plan.capacity} 快递员 ${index + 1}`
      if (!sameSet(courier.sequence, expected.sequence)) {
        problems.push(`${tag} 集合是 ${courier.sequence.join(',')}，论文是 ${expected.sequence.join(',')}`)
      }
      if (courier.deliveries !== expected.deliveries) problems.push(`${tag} 派件 ${courier.deliveries} ≠ ${expected.deliveries}`)
      if (courier.pickups !== expected.pickups) problems.push(`${tag} 收件 ${courier.pickups} ≠ ${expected.pickups}`)
      if (courier.maxLoad !== expected.maxLoad) problems.push(`${tag} 最大载件 ${courier.maxLoad} ≠ ${expected.maxLoad}`)
      check(`${tag} 路线`, courier.length, expected.length.value, 1e-4)
    })
    const covered = new Set(plan.couriers.flatMap((courier) => courier.sequence))
    if (covered.size !== 19 || covered.has('R')) problems.push(`能力 ${plan.capacity} 没有正好覆盖除 R 以外的 19 个小区`)
  }

  for (const plan of results.delivery) {
    const paper = plan.capacity >= 195 ? WIDE_PLAN : TIGHT_PLAN
    expectPlan(plan, paper)
  }
  for (const plan of results.simultaneous) {
    expectPlan(plan, TIGHT_PLAN)
    const peak = Math.max(plan.couriers[0].maxLoad, plan.couriers[1].maxLoad)
    if (peak !== 186) problems.push(`能力 ${plan.capacity} 同时取派峰值 ${peak} ≠ 186`)
  }

  return problems
}
