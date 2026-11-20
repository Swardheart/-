import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { COMMUNITIES, DIST, distanceById } from '../src/data.ts'
import { computeAll, depotSubsets, loadProfile, rankDepots, verify } from '../src/model.ts'
import {
  EQUAL_AVG,
  EQUAL_MAX,
  EQUAL_SECOND_COST,
  PAPER_AB,
  PAPER_RQ,
  SENSITIVITY,
  SINGLE_LEGS,
  SINGLE_ROUNDED,
  SINGLE_TOTAL,
  SINGLE_VISITS,
  TIGHT_PLAN,
  WIDE_PLAN,
} from '../src/paper.ts'

const SPEC = 0.02

function close(actual: number, expected: number, eps = SPEC) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < eps, `${actual} 与 ${expected} 相差 ${diff}，容许 ${eps}`)
}

function setKey(ids: string[]): string {
  return ids.slice().sort().join(',')
}

const results = computeAll()

test('欧氏距离与论文例题一致', () => {
  close(distanceById('A', 'B'), PAPER_AB.value, 1e-12)
  close(distanceById('R', 'Q'), PAPER_RQ.value, 1e-12)
  close(distanceById('B', 'A'), PAPER_AB.value, 1e-12)
})

test('论文单人路段等于欧氏距离，累计能接上', () => {
  let cumulative = 0
  for (const leg of SINGLE_LEGS) {
    close(distanceById(leg.from, leg.to), leg.distance, 1e-9)
    cumulative += leg.distance
    close(cumulative, leg.cumulative, 1e-6)
  }
  close(cumulative, SINGLE_TOTAL.value, 1e-9)
  assert.deepEqual(
    SINGLE_LEGS.map((leg) => leg.from),
    SINGLE_VISITS,
  )
  assert.equal(SINGLE_LEGS[SINGLE_LEGS.length - 1].to, 'R')
})

test('选址公式独立复算，五种权重的最优都是 R', () => {
  for (const preset of SENSITIVITY) {
    const weights = COMMUNITIES.map((c) => preset.alpha * c.delivery + preset.beta * c.pickup)
    const sumW = weights.reduce((sum, w) => sum + w, 0)
    let bestId = ''
    let bestCost = Infinity
    const costs = new Map<string, number>()
    for (let j = 0; j < COMMUNITIES.length; j++) {
      let cost = 0
      let maxDistance = 0
      for (let i = 0; i < COMMUNITIES.length; i++) {
        cost += weights[i] * DIST[i][j]
        if (i !== j && DIST[i][j] > maxDistance) maxDistance = DIST[i][j]
      }
      costs.set(COMMUNITIES[j].id, cost)
      if (cost < bestCost) {
        bestCost = cost
        bestId = COMMUNITIES[j].id
      }
    }
    assert.equal(bestId, 'R')
    close(bestCost, preset.cost.value, 1e-4)
    const ranked = rankDepots(preset.alpha, preset.beta)
    assert.equal(ranked[0].id, 'R')
    close(ranked[0].cost, bestCost, 1e-9)
    if (preset.alpha === 1 && preset.beta === 1) {
      close(ranked[0].avgDistance, bestCost / sumW, 1e-12)
      close(ranked[0].avgDistance, EQUAL_AVG.value, 1e-6)
      let maxDistance = 0
      for (const c of COMMUNITIES) {
        if (c.id === 'R') continue
        maxDistance = Math.max(maxDistance, distanceById('R', c.id))
      }
      close(ranked[0].maxDistance, maxDistance, 1e-12)
      close(maxDistance, EQUAL_MAX.value, 1e-9)
      assert.equal(ranked[1].id, 'S')
      close(ranked[1].cost, costs.get('S') ?? 0, 1e-9)
      close(ranked[1].cost, EQUAL_SECOND_COST.value, 1e-4)
    }
  }
})

test('Held-Karp 与小规模穷举一致', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 2, y: 1 },
    { x: 3, y: 4 },
    { x: 1, y: 5 },
    { x: 6, y: 2 },
    { x: 5, y: 5 },
    { x: 4, y: 0 },
    { x: 7, y: 3 },
  ]
  const dist = points.map((a) => points.map((b) => Math.hypot(a.x - b.x, a.y - b.y)))
  const depot = 0
  const subsets = depotSubsets(dist, depot)
  const customers = subsets.customers
  const full = (1 << customers.length) - 1

  const brute = (nodes: number[]) => {
    let best = Infinity
    const perm = nodes.slice()
    const walk = (depth: number) => {
      if (depth === perm.length) {
        let length = dist[depot][perm[0]]
        for (let i = 0; i < perm.length - 1; i++) length += dist[perm[i]][perm[i + 1]]
        length += dist[perm[perm.length - 1]][depot]
        if (length < best) best = length
        return
      }
      for (let i = depth; i < perm.length; i++) {
        const tmp = perm[depth]
        perm[depth] = perm[i]
        perm[i] = tmp
        walk(depth + 1)
        perm[i] = perm[depth]
        perm[depth] = tmp
      }
    }
    walk(0)
    return best
  }

  close(subsets.tourCost[full], brute(customers), 1e-9)
  const subsetNodes = customers.slice(0, 4)
  let mask = 0
  subsetNodes.forEach((node) => {
    mask |= 1 << customers.indexOf(node)
  })
  close(subsets.tourCost[mask], brute(subsetNodes), 1e-9)

  const order = subsets.order(full)
  let walked = dist[depot][order[0]]
  for (let i = 0; i < order.length - 1; i++) walked += dist[order[i]][order[i + 1]]
  walked += dist[order[order.length - 1]][depot]
  close(walked, subsets.tourCost[full], 1e-9)
})

test('单人回路是论文那条最短路，总长 337.63 km', () => {
  close(results.single.total, SINGLE_TOTAL.value, 1e-4)
  close(results.single.total, SINGLE_ROUNDED.value)
  assert.equal(results.single.visits.join('-'), SINGLE_VISITS.join('-'))
  assert.equal(results.single.legs.length, SINGLE_LEGS.length)
  for (let i = 0; i < SINGLE_LEGS.length; i++) {
    const got = results.single.legs[i]
    const paper = SINGLE_LEGS[i]
    assert.equal(got.from, paper.from)
    assert.equal(got.to, paper.to)
    close(got.distance, paper.distance, 1e-9)
    close(got.cumulative, paper.cumulative, 1e-6)
  }
})

test('论文载重公式在给出的顺序上得到 208、156、177、186', () => {
  const expectLoad = (sequence: string[], maxLoad: number, deliveries: number, pickups: number) => {
    const load = loadProfile(sequence)
    assert.equal(load.maxLoad, maxLoad)
    assert.equal(load.profile[0].load, deliveries)
    assert.equal(
      sequence.reduce((sum, id) => sum + COMMUNITIES.find((c) => c.id === id)!.delivery, 0),
      deliveries,
    )
    assert.equal(
      sequence.reduce((sum, id) => sum + COMMUNITIES.find((c) => c.id === id)!.pickup, 0),
      pickups,
    )
  }
  for (const courier of WIDE_PLAN.couriers) {
    expectLoad(courier.sequence, courier.maxLoad, courier.deliveries, courier.pickups)
    close(closedLengthOf(courier.sequence), courier.length.value, 1e-6)
  }
  for (const courier of TIGHT_PLAN.couriers) {
    expectLoad(courier.sequence, courier.maxLoad, courier.deliveries, courier.pickups)
    close(closedLengthOf(courier.sequence), courier.length.value, 1e-6)
  }
})

test('双人派送：195 和 200 为 352.45，186 和 190 为 353.31', () => {
  for (const plan of results.delivery) {
    const paper = plan.capacity === 200 || plan.capacity === 195 ? WIDE_PLAN : TIGHT_PLAN
    assert.ok(paper.capacities.includes(plan.capacity))
    close(plan.totalLength, paper.total.value)
    close(plan.couriers[0].length + plan.couriers[1].length, paper.couriers[0].length.value + paper.couriers[1].length.value, 1e-4)
    plan.couriers.forEach((courier, index) => {
      const expected = paper.couriers[index]
      assert.equal(setKey(courier.sequence), setKey(expected.sequence))
      assert.equal(courier.deliveries, expected.deliveries)
      assert.equal(courier.pickups, expected.pickups)
      assert.equal(courier.maxLoad, expected.maxLoad)
      close(courier.length, expected.length.value, 1e-4)
      assert.equal(courier.sequence.includes('R'), false)
    })
    const covered = plan.couriers.flatMap((courier) => courier.sequence)
    assert.equal(new Set(covered).size, 19)
  }
})

test('同时取派四种能力都用 353.31 km 的分组，峰值 186', () => {
  for (const capacity of [200, 195, 190, 186]) {
    const plan = results.simultaneous.find((item) => item.capacity === capacity)
    assert.ok(plan)
    close(plan.totalLength, TIGHT_PLAN.total.value)
    plan.couriers.forEach((courier, index) => {
      const expected = TIGHT_PLAN.couriers[index]
      assert.equal(setKey(courier.sequence), setKey(expected.sequence))
      assert.equal(courier.deliveries, expected.deliveries)
      assert.equal(courier.pickups, expected.pickups)
      assert.equal(courier.maxLoad, expected.maxLoad)
      close(courier.length, expected.length.value, 1e-4)
    })
    assert.equal(Math.max(plan.couriers[0].maxLoad, plan.couriers[1].maxLoad), 186)
    assert.ok(plan.couriers[0].maxLoad <= capacity)
    assert.ok(plan.couriers[1].maxLoad <= capacity)
  }
})

test('页面数据与现场计算一致，且通过论文核对', () => {
  const saved = JSON.parse(readFileSync(new URL('../src/generated/results.json', import.meta.url), 'utf8'))
  assert.equal(saved.single.total, results.single.total)
  assert.equal(saved.presets[0].ranking[0].cost, results.presets[0].ranking[0].cost)
  assert.equal(saved.delivery[0].totalLength, results.delivery[0].totalLength)
  assert.equal(saved.simultaneous[3].couriers[1].maxLoad, results.simultaneous[3].couriers[1].maxLoad)
  const problems = verify(results)
  assert.deepEqual(problems, [])
})

function closedLengthOf(sequence: string[]): number {
  let length = distanceById('R', sequence[0])
  for (let i = 0; i < sequence.length - 1; i++) length += distanceById(sequence[i], sequence[i + 1])
  length += distanceById(sequence[sequence.length - 1], 'R')
  return length
}
