import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { computeAll, verify } from '../src/model.ts'

const started = performance.now()
const results = computeAll()
const elapsed = performance.now() - started
const out = new URL('../src/generated/results.json', import.meta.url)
mkdirSync(dirname(out.pathname), { recursive: true })
writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`)

const equal = results.presets[0]
console.log(`计算完成，用时 ${(elapsed / 1000).toFixed(2)} s`)
console.log(`同权最优 ${equal.bestId}，成本 ${equal.ranking[0].cost}`)
console.log(`单人总长 ${results.single.total}`)
for (const plan of results.delivery) {
  const groups = plan.couriers.map((courier) => courier.sequence.join(',')).join(' || ')
  console.log(`派送 能力 ${plan.capacity} 总长 ${plan.totalLength} 载件 ${plan.couriers.map((c) => c.maxLoad).join('/')} ${groups}`)
}
for (const plan of results.simultaneous) {
  console.log(
    `取派 能力 ${plan.capacity} 总长 ${plan.totalLength} 载件 ${plan.couriers.map((c) => c.maxLoad).join('/')}`,
  )
}

const problems = verify(results)
if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`已写入 ${out.pathname}`)
