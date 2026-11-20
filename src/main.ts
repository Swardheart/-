import { COMMUNITIES, community, distanceById, volume, type Community } from './data.ts'
import type { LabResults, LoadStop, PlanResult, PresetResult } from './types.ts'
import raw from './generated/results.json'

const lab = raw as LabResults

type View = 'location' | 'single' | 'dual' | 'both'

const VIEWS: { id: View; label: string }[] = [
  { id: 'location', label: '选址排名' },
  { id: 'single', label: '单人路线' },
  { id: 'dual', label: '双人派送' },
  { id: 'both', label: '同时取派' },
]

const CAPS = [186, 190, 195, 200]
const volumes = COMMUNITIES.map((item) => volume(item))
const minVol = Math.min(...volumes)
const maxVol = Math.max(...volumes)

const params = new URLSearchParams(location.search)
let view = readView(params.get('view'))
let presetIndex = readIndex(params.get('preset'), lab.presets.length)
let depotId = readId(params.get('depot'), lab.presets[presetIndex].bestId)
let selectedId = readId(params.get('select'), 'A')
let dualCap = readCap(params.get('cap'), 200)
let bothCap = readCap(params.get('cap'), view === 'both' ? 186 : 200)
if (view !== 'both' && view !== 'dual') bothCap = 186

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) throw new Error('页面缺少 #app')
const app: HTMLElement = root

app.addEventListener('click', onClick)
app.addEventListener('keydown', onKeydown)
render(false)

function readView(value: string | null): View {
  return VIEWS.some((item) => item.id === value) ? (value as View) : 'location'
}

function readIndex(value: string | null, length: number): number {
  const index = Number(value)
  return Number.isInteger(index) && index >= 0 && index < length ? index : 0
}

function readId(value: string | null, fallback: string): string {
  return value && COMMUNITIES.some((item) => item.id === value) ? value : fallback
}

function readCap(value: string | null, fallback: number): number {
  const cap = Number(value)
  return CAPS.includes(cap) ? cap : fallback
}

function onClick(event: Event) {
  const target = event.target
  if (!(target instanceof Element)) return
  const viewButton = target.closest<HTMLElement>('[data-view]')
  if (viewButton?.dataset.view) {
    view = viewButton.dataset.view as View
    render(true)
    return
  }
  const presetButton = target.closest<HTMLElement>('[data-preset]')
  if (presetButton?.dataset.preset) {
    presetIndex = Number(presetButton.dataset.preset)
    depotId = lab.presets[presetIndex].bestId
    selectedId = depotId
    render(false)
    return
  }
  const capButton = target.closest<HTMLElement>('[data-cap]')
  if (capButton?.dataset.cap) {
    const cap = Number(capButton.dataset.cap)
    if (view === 'both') bothCap = cap
    else dualCap = cap
    render(false)
    return
  }
  const depotButton = target.closest<HTMLElement>('[data-depot]')
  if (depotButton?.dataset.depot) {
    depotId = depotButton.dataset.depot
    selectedId = depotId
    render(false)
    return
  }
  const point = target.closest<HTMLElement>('[data-point]')
  if (point?.dataset.point) {
    selectedId = point.dataset.point
    render(false)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target
  if (!(target instanceof Element)) return
  if (!target.closest('[data-point]')) return
  event.preventDefault()
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function render(resetScroll: boolean) {
  const previous = resetScroll ? 0 : app.querySelector('.panel')?.scrollTop ?? 0
  app.innerHTML = page()
  const panel = app.querySelector('.panel')
  if (panel) panel.scrollTop = previous
  const query = new URLSearchParams()
  query.set('view', view)
  query.set('select', selectedId)
  if (view === 'location') {
    query.set('preset', String(presetIndex))
    query.set('depot', depotId)
  }
  if (view === 'dual') query.set('cap', String(dualCap))
  if (view === 'both') query.set('cap', String(bothCap))
  history.replaceState(null, '', `?${query}`)
}

function page(): string {
  return `<div class="desk">
    <header class="top">
      <div class="brand">
        <div class="seal" aria-hidden="true">递</div>
        <div>
          <p class="kicker">实验台 · 校赛论文对照</p>
          <h1>快递选址与路径</h1>
          <p class="top-note">20 个小区，欧氏距离。圆的大小是综合业务量。点一个小区，看派件、收件和到当前代理点的距离。</p>
        </div>
      </div>
    </header>
    <nav class="nav" aria-label="视图">
      ${VIEWS.map((item) => `<button type="button" data-view="${item.id}" aria-pressed="${view === item.id}">${item.label}</button>`).join('')}
    </nav>
    <div class="workspace">
      <section class="map-column">
        <div class="map-frame">
          ${mapSvg()}
          <div class="legend">${legend()}</div>
        </div>
        ${inspector()}
      </section>
      <section class="panel" aria-label="计算对照">${panel()}</section>
    </div>
    <footer class="foot">${footer()}</footer>
  </div>`
}

function legend(): string {
  const lines = ['<p><i class="swatch size"></i>圆的大小：综合业务量</p>', '<p><i class="swatch depot"></i>菱形：当前代理点</p>']
  if (view === 'single') lines.push('<p><i class="swatch c1"></i>单人闭合回路</p>')
  if (view === 'dual' || view === 'both') {
    lines.push('<p><i class="swatch c1"></i>快递员 1</p>', '<p><i class="swatch c2"></i>快递员 2</p>')
  }
  lines.push('<p>横坐标向右，纵坐标向上，单位 km。</p>')
  return lines.join('')
}

function activeDepot(): string {
  return view === 'location' ? depotId : 'R'
}

function bubbleRadius(item: Community): number {
  const vol = volume(item)
  if (maxVol === minVol) return 2.2
  return 1.45 + ((vol - minVol) / (maxVol - minVol)) * 1.7
}

function mapSvg(): string {
  const depot = activeDepot()
  const selected = community(selectedId)
  const depotPoint = community(depot)
  const assigned = routeOwners()
  const lines = routeLines()
  const grid = [0, 20, 40, 60, 80, 100].map((tick) => {
    const y = (100 - tick).toFixed(1)
    return `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="#c5d5cb" stroke-width="0.25" />
      <line x1="${tick}" y1="0" x2="${tick}" y2="100" stroke="#c5d5cb" stroke-width="0.25" />
      <text x="${tick}" y="104.2" text-anchor="middle" font-size="2.4" fill="#5c675f">${tick}</text>
      <text x="-1.4" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="2.4" fill="#5c675f">${tick}</text>`
  }).join('')
  const inspect = selectedId === depot
    ? ''
    : `<line x1="${selected.x}" y1="${100 - selected.y}" x2="${depotPoint.x}" y2="${100 - depotPoint.y}" stroke="#a56a12" stroke-width="0.38" stroke-dasharray="1.2 0.75" />`
  const points = COMMUNITIES.map((item) => pointMarkup(item, depot, assigned.get(item.id) ?? 0)).join('')
  return `<svg viewBox="-8 -6 118 116" role="img" aria-label="20 个小区的坐标图">
    <rect x="0" y="0" width="100" height="100" fill="#f7fbf8" stroke="#7f978a" stroke-width="0.35" />
    ${grid}
    ${lines}
    ${inspect}
    ${points}
  </svg>`
}

function routeOwners(): Map<string, 1 | 2> {
  const owners = new Map<string, 1 | 2>()
  if (view !== 'dual' && view !== 'both') return owners
  const plan = currentPlan()
  plan.couriers.forEach((courier, index) => {
    for (const id of courier.sequence) owners.set(id, (index + 1) as 1 | 2)
  })
  return owners
}

function routeLines(): string {
  const paint = (ids: string[], color: string) => {
    const points = ids.map((id) => {
      const item = community(id)
      return `${item.x},${100 - item.y}`
    }).join(' ')
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="0.7" stroke-linejoin="round" stroke-linecap="round" />`
  }
  if (view === 'single') return paint([...lab.single.visits, lab.single.visits[0]], '#1f5c45')
  if (view === 'dual' || view === 'both') {
    const plan = currentPlan()
    return plan.couriers.map((courier, index) => paint(['R', ...courier.sequence, 'R'], index === 0 ? '#1f5c45' : '#8a3d24')).join('')
  }
  return ''
}

function pointMarkup(item: Community, depot: string, owner: 0 | 1 | 2): string {
  const radius = bubbleRadius(item)
  const selected = item.id === selectedId
  const fill = owner === 2 ? '#8a3d24' : '#1f5c45'
  const vx = item.x - 50
  const vy = (100 - item.y) - 50
  const len = Math.hypot(vx, vy) || 1
  const labelAt = radius + 2.5
  const lx = (vx / len) * labelAt
  const ly = (vy / len) * labelAt
  const diamond = item.id === depot
    ? `<rect x="${-radius - 0.85}" y="${-radius - 0.85}" width="${(radius + 0.85) * 2}" height="${(radius + 0.85) * 2}" transform="rotate(45)" fill="none" stroke="#1c2420" stroke-width="0.38" />`
    : ''
  const ring = selected
    ? `<circle r="${(radius + 0.95).toFixed(2)}" fill="none" stroke="#a56a12" stroke-width="0.42" />`
    : ''
  return `<g class="point" data-point="${item.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="小区 ${item.id}，派件 ${item.delivery}，收件 ${item.pickup}" transform="translate(${item.x} ${100 - item.y})">
    <circle r="3.6" fill="transparent" />
    ${diamond}
    ${ring}
    <circle r="${radius.toFixed(2)}" fill="${fill}" opacity="0.92" />
    <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="2.8" font-weight="700" fill="#1c2420" stroke="#f7fbf8" stroke-width="0.55" paint-order="stroke">${item.id}</text>
  </g>`
}

function inspector(): string {
  const item = community(selectedId)
  const depot = activeDepot()
  const dist = distanceById(item.id, depot)
  const paper = publishedDistance(item.id, depot)
  const same = item.id === depot
  const distanceBlock = same
    ? `<p class="distance">这就是当前代理点，到自身的距离是 0。</p>`
    : `<p class="distance"><span>本次</span> <strong class="num">${displayNumber(dist, paper)}</strong> km</p>
       ${paper ? `<p class="distance"><span>论文</span> <strong class="num">${paper}</strong> km</p>` : '<p class="distance"><span>论文</span> 未单列这一对距离</p>'}`
  return `<aside class="inspector" aria-live="polite">
    <div>
      <p class="kicker">正在查看</p>
      <h2>小区 ${item.id}</h2>
      <p class="coord">坐标 (${item.x.toFixed(1)}, ${item.y.toFixed(1)}) km</p>
    </div>
    <dl class="counts">
      <div><dt>派件</dt><dd class="num">${item.delivery}</dd></div>
      <div><dt>收件</dt><dd class="num">${item.pickup}</dd></div>
      <div><dt>综合</dt><dd class="num">${volume(item)}</dd></div>
    </dl>
    <div>
      <p class="kicker">到当前代理点 ${depot}</p>
      ${distanceBlock}
    </div>
  </aside>`
}

function publishedDistance(a: string, b: string): string | null {
  const key = [a, b].sort().join('')
  if (key === 'AB') return lab.checks.find((item) => item.name === 'A–B')?.paperText ?? null
  if (key === 'QR') return lab.checks.find((item) => item.name === 'R–Q')?.paperText ?? null
  const equal = lab.presets.find((item) => item.name === '派收同权')
  if ((a === 'R' || b === 'R') && equal?.paperMaxText && Math.abs(distanceById(a, b) - Number(equal.paperMaxText)) < 1e-6) {
    return equal.paperMaxText
  }
  return null
}

function panel(): string {
  if (view === 'location') return locationPanel()
  if (view === 'single') return singlePanel()
  if (view === 'dual') return planPanel('dual')
  return planPanel('both')
}

function locationPanel(): string {
  const preset = lab.presets[presetIndex]
  const best = preset.ranking[0]
  const second = preset.ranking[1]
  return `<p class="lede">每个小区都可以做代理点。权重 w = α × 派件 + β × 收件，成本是所有小区的 w × 距离之和。平均距离 = 成本 / 权重之和。最大距离不计本点。点下面一行，就把该小区设为当前代理点。</p>
    <div class="presets" role="group" aria-label="业务权重">
      ${lab.presets.map((item, index) => `<button type="button" data-preset="${index}" aria-pressed="${index === presetIndex}"><strong>${item.name}</strong><small>α ${item.alpha.toFixed(1)} · β ${item.beta.toFixed(1)}</small></button>`).join('')}
    </div>
    <div class="metrics">
      ${metric('最优代理点', best.id, preset.paperBestId)}
      ${metric('加权成本', best.cost, preset.paperCostText)}
      ${metric('平均加权距离 km', best.avgDistance, preset.paperAvgText)}
      ${metric('最大服务距离 km', best.maxDistance, preset.paperMaxText)}
      <article class="metric span-2">
        <h3>第二名 ${second.id}</h3>
        ${pairRow('本次成本', displayNumber(second.cost, preset.paperSecondText), true)}
        ${pairRow('论文成本', preset.paperSecondText ?? '—', true, preset.paperSecondText ? ` title="论文原文 ${preset.paperSecondText}"` : '')}
        <p class="delta ${preset.paperSecondText ? deltaLabel(second.cost, preset.paperSecondText).ok ? 'ok' : 'bad' : 'ok'}">${preset.paperSecondText ? deltaLabel(second.cost, preset.paperSecondText).text : '论文只在派收同权时给出了第二名'}</p>
      </article>
    </div>
    <h2 class="block-title">五种权重</h2>
    <table>
      <thead><tr><th>情形</th><th>α</th><th>β</th><th>最优</th><th class="num">本次成本</th><th class="num">论文成本</th></tr></thead>
      <tbody>
        ${lab.presets.map((item, index) => `<tr class="${index === presetIndex ? 'active' : ''}"><td>${item.name}</td><td>${item.alpha.toFixed(1)}</td><td>${item.beta.toFixed(1)}</td><td>${item.bestId}</td><td class="num">${displayNumber(item.ranking[0].cost, item.paperCostText)}</td><td class="num">${item.paperCostText}</td></tr>`).join('')}
      </tbody>
    </table>
    <h2 class="block-title">${preset.name}的排名</h2>
    <div class="rank-head"><span>名次</span><span>小区</span><span>加权成本</span><span>平均距离</span><span>最大距离</span></div>
    ${preset.ranking.map((row, index) => rankButton(row, index, preset)).join('')}`
}

function rankButton(row: PresetResult['ranking'][number], index: number, preset: PresetResult): string {
  const marks = [
    row.id === preset.bestId ? '<span class="tag">最优</span>' : '',
    row.id === depotId ? '<span class="tag">当前</span>' : '',
  ].join('')
  return `<button type="button" class="rank" data-depot="${row.id}" aria-pressed="${row.id === depotId}">
    <span>${index + 1}</span>
    <span>${row.id}${marks}</span>
    <span class="num">${displayNumber(row.cost, row.id === preset.bestId ? preset.paperCostText : row.id === preset.paperSecondId ? preset.paperSecondText : null, 4)}</span>
    <span class="num">${row.avgDistance.toFixed(2)}</span>
    <span class="num">${row.maxDistance.toFixed(2)}</span>
  </button>`
}

function singlePanel(): string {
  const totalDelta = deltaLabel(lab.single.total, lab.single.paperTotalText)
  return `<p class="lede">一名快递员走遍 20 个小区再回到 R。回路用 Held-Karp 求最短，反向走长度相同。下表是和论文相同的方向，方便逐段对照。</p>
    <div class="metrics">
      ${metric('回路总长 km', lab.single.total, lab.single.paperTotalText)}
      ${metric('论文约数 km', lab.single.total, lab.single.paperRoundedText)}
    </div>
    <p class="path">${[...lab.single.visits, lab.single.visits[0]].join(' → ')}</p>
    <p class="delta ${totalDelta.ok ? 'ok' : 'bad'}">精确累计 ${totalDelta.text}。论文另写成 ${lab.single.paperRoundedText} km。</p>
    <h2 class="block-title">逐段距离</h2>
    <table class="legs">
      <thead><tr><th>路段</th><th class="num">本次</th><th class="num">论文</th><th class="num">本次累计</th><th class="num">论文累计</th></tr></thead>
      <tbody>
        ${lab.single.legs.map((leg) => `<tr><td>${leg.from}–${leg.to}</td><td class="num">${legDigits(leg.distance)}</td><td class="num">${leg.paperDistance === null ? '—' : legDigits(leg.paperDistance)}</td><td class="num">${legDigits(leg.cumulative)}</td><td class="num">${leg.paperCumulative === null ? '—' : legDigits(leg.paperCumulative)}</td></tr>`).join('')}
      </tbody>
    </table>`
}

function planPanel(kind: 'dual' | 'both'): string {
  const plans = kind === 'dual' ? lab.delivery : lab.simultaneous
  const cap = kind === 'dual' ? dualCap : bothCap
  const plan = plans.find((item) => item.capacity === cap) ?? plans[0]
  const wide = lab.delivery.find((item) => item.capacity === 200)!
  const tight = lab.delivery.find((item) => item.capacity === 186)!
  const intro = kind === 'dual'
    ? '代理点固定为 R，R 不进访问序列。其余 19 个小区分成两组，每组单独求「从 R 出发再回到 R」的最短回路。能力只限制一组的派件之和。'
    : '还是从 R 出发的两组最短回路。出发时装上该组全部派件，每到一个小区先卸下派件，再装上收件。最大载件是沿途峰值，含出发时的载量。'
  const note = kind === 'dual'
    ? cap >= 195
      ? `能力 ${cap} 装得下派件 192 和 156 的那一组。本次总长 ${displayNumber(plan.totalLength, plan.paperTotalText)} km，论文 ${plan.paperTotalText} km。若把这组路线改成同时取派，快递员 1 的峰值是 ${plan.couriers[0].maxLoad}，已经超过 200。`
      : `能力 ${cap} 装不下派件 192 的那一组，改用下面这组。本次总长 ${displayNumber(plan.totalLength, plan.paperTotalText)} km，论文 ${plan.paperTotalText} km。上一组的总长，本次 ${displayNumber(wide.totalLength, wide.paperTotalText)} km，论文 ${wide.paperTotalText} km。`
    : `宽分组的同时取派峰值是 ${wide.couriers[0].maxLoad}，能力 200 也放不下。四种能力都改用总长 ${tight.paperTotalText} km 的这组。调整后最大载件是 ${Math.max(plan.couriers[0].maxLoad, plan.couriers[1].maxLoad)}，论文也是 186。`
  return `<p class="lede">${intro}</p>
    <div class="caps" role="group" aria-label="能力">
      ${CAPS.map((item) => `<button type="button" data-cap="${item}" aria-pressed="${item === cap}">${item}</button>`).join('')}
    </div>
    <p class="note">${note}</p>
    <div class="metrics">
      ${metric('两组总长 km', plan.totalLength, plan.paperTotalText)}
      ${metric('调整关注的最大载件', Math.max(plan.couriers[0].maxLoad, plan.couriers[1].maxLoad), String(Math.max(plan.couriers[0].paperMaxLoad, plan.couriers[1].paperMaxLoad)))}
    </div>
    ${plan.couriers.map((courier, index) => courierCard(courier, index, kind, cap)).join('')}
    <h2 class="block-title">四种能力</h2>
    <table>
      <thead><tr><th>能力</th><th class="num">本次总长</th><th class="num">论文总长</th><th class="num">取派峰值</th></tr></thead>
      <tbody>
        ${plans.map((item) => `<tr class="${item.capacity === cap ? 'active' : ''}"><td>${item.capacity}</td><td class="num">${displayNumber(item.totalLength, item.paperTotalText)}</td><td class="num">${item.paperTotalText}</td><td class="num">${Math.max(item.couriers[0].maxLoad, item.couriers[1].maxLoad)}</td></tr>`).join('')}
      </tbody>
    </table>`
}

function courierCard(
  courier: PlanResult['couriers'][number],
  index: number,
  kind: 'dual' | 'both',
  cap: number,
): string {
  const orderNote = courier.sequence.join(',') === courier.paperSequence.join(',')
    ? '访问顺序与论文相同。'
    : `论文顺序是 ${courier.paperSequence.join(' → ')}。`
  const chart = kind === 'both' ? loadChart(courier.loadProfile, cap, index) : ''
  const rows = kind === 'both'
    ? `<table><thead><tr><th>停靠</th><th class="num">本次载件</th></tr></thead><tbody>
        ${courier.loadProfile.map((stop) => `<tr class="${stop.load === courier.maxLoad ? 'peak-row' : ''}"><td>${stop.id === 'R' ? 'R 出发' : stop.id}</td><td class="num">${stop.load}</td></tr>`).join('')}
      </tbody></table>`
    : ''
  return `<article class="courier ${index === 1 ? 'second' : ''}">
    <h3>快递员 ${index + 1}</h3>
    <p class="path">R → ${courier.sequence.join(' → ')} → R</p>
    <p class="lede">${orderNote}</p>
    <dl class="stats">
      ${stat('派件', courier.deliveries, courier.paperDeliveries)}
      ${stat('收件', courier.pickups, courier.paperPickups)}
      ${stat('路线 km', courier.length, courier.paperLengthText)}
      ${stat(kind === 'dual' ? '若改同时取派的峰值' : '最大载件', courier.maxLoad, courier.paperMaxLoad)}
    </dl>
    ${chart}
    ${rows}
  </article>`
}

function loadChart(profile: LoadStop[], capacity: number, courierIndex: number): string {
  const width = 360
  const height = 132
  const left = 36
  const right = 10
  const top = 16
  const bottom = 28
  const yMax = Math.max(capacity, ...profile.map((stop) => stop.load)) * 1.12
  const xAt = (index: number) => left + (index / Math.max(profile.length - 1, 1)) * (width - left - right)
  const yAt = (load: number) => top + (1 - load / yMax) * (height - top - bottom)
  let peakIndex = 0
  profile.forEach((stop, index) => {
    if (stop.load > profile[peakIndex].load) peakIndex = index
  })
  const line = profile.map((stop, index) => `${xAt(index).toFixed(1)},${yAt(stop.load).toFixed(1)}`).join(' ')
  const marks = new Set([0, peakIndex, profile.length - 1])
  const labels = [...marks].map((index) => {
    const anchor = index === 0 ? 'start' : index === profile.length - 1 ? 'end' : 'middle'
    const text = profile[index].id === 'R' ? '出发' : profile[index].id
    return `<text class="chart-label" x="${xAt(index).toFixed(1)}" y="${height - 8}" text-anchor="${anchor}">${text}</text>`
  }).join('')
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="快递员 ${courierIndex + 1} 的沿途载件">
    <line class="cap-line" x1="${left}" y1="${yAt(capacity).toFixed(1)}" x2="${width - right}" y2="${yAt(capacity).toFixed(1)}" />
    <text class="chart-label" x="${left}" y="${Math.max(12, yAt(capacity) - 4).toFixed(1)}">能力 ${capacity}</text>
    <polyline class="load-line" points="${line}" />
    ${profile.map((stop, index) => `<circle cx="${xAt(index).toFixed(1)}" cy="${yAt(stop.load).toFixed(1)}" r="${index === peakIndex ? 3.5 : 2.2}" class="${index === peakIndex ? 'peak' : 'stop'}" />`).join('')}
    ${labels}
  </svg>`
}

function currentPlan(): PlanResult {
  const plans = view === 'both' ? lab.simultaneous : lab.delivery
  const cap = view === 'both' ? bothCap : dualCap
  return plans.find((item) => item.capacity === cap) ?? plans[0]
}

function footer(): string {
  return lab.checks.map((item) => {
    const delta = deltaLabel(item.computed, item.paperText)
    return `<span>${item.name} <span>本次</span> <b class="num">${displayNumber(item.computed, item.paperText)}</b> <span>论文</span> <b class="num">${item.paperText}</b> <span class="delta ${delta.ok ? 'ok' : 'bad'}">${delta.text}</span></span>`
  }).join('') + '<span>绝对误差按小于 0.02 对照。</span>'
}

function metric(label: string, computed: number | string, paperText: string | null): string {
  if (typeof computed === 'string') {
    const ok = paperText === null || computed === paperText
    return `<article class="metric"><h3>${label}</h3>${pairRow('本次', computed, false)}${pairRow('论文', paperText ?? '—', false)}<p class="delta ${ok ? 'ok' : 'bad'}">${ok ? '一致' : '不一致'}</p></article>`
  }
  const delta = deltaLabel(computed, paperText)
  const full = paperText ? ` title="论文原文 ${paperText}"` : ''
  return `<article class="metric"><h3>${label}</h3>${pairRow('本次', displayNumber(computed, paperText), true)}${pairRow('论文', paperText ?? '—', true, full)}<p class="delta ${delta.ok ? 'ok' : 'bad'}">${delta.text}</p></article>`
}

function pairRow(label: string, value: string, numeric: boolean, extra = ''): string {
  const klass = numeric ? ' class="num"' : ''
  return `<div class="pair-line"><span>${label}</span><strong${klass}${extra}>${value}</strong></div>`
}

function stat(label: string, computed: number, paper: number | string): string {
  const paperText = String(paper)
  return `<div class="stat"><dt>${label}</dt><dd><span>本次</span> <b class="num">${displayNumber(computed, paperText)}</b> <span>论文</span> <b class="num">${paperText}</b></dd></div>`
}

function legDigits(value: number): string {
  return value.toFixed(6).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function displayNumber(value: number, paperText: string | null, digits = 8): string {
  if (paperText) {
    const decimals = paperText.includes('.') ? paperText.split('.')[1].length : 0
    if (decimals === 0 && Number.isInteger(value)) return String(value)
    if (decimals > 0 && decimals <= 6 && Math.abs(value - Number(paperText)) < 5e-7) return value.toFixed(decimals)
  }
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function deltaLabel(computed: number, paperText: string | null): { text: string; ok: boolean } {
  if (paperText === null) return { text: '论文未单列', ok: true }
  const diff = Math.abs(computed - Number(paperText))
  if (diff < 0.02) {
    if (diff < 1e-4) return { text: '相差 < 0.0001', ok: true }
    return { text: `相差 ${diff.toFixed(4)}`, ok: true }
  }
  return { text: `相差 ${diff.toFixed(4)}`, ok: false }
}
