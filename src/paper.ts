/** 校赛论文给出的对照数字。文本保持论文写法，数值用于误差比较。 */

export interface Figure {
  text: string
  value: number
}

export function figure(text: string): Figure {
  return { text, value: Number(text) }
}

export interface PaperLeg {
  from: string
  to: string
  distance: number
  cumulative: number
}

export interface PaperCourier {
  sequence: string[]
  deliveries: number
  pickups: number
  maxLoad: number
  length: Figure
}

export interface PaperPlan {
  capacities: number[]
  total: Figure
  couriers: [PaperCourier, PaperCourier]
}

export const PAPER_AB = figure('18.384776310850235')
export const PAPER_RQ = figure('18.060177186284744')

export const SENSITIVITY: {
  name: string
  alpha: number
  beta: number
  cost: Figure
}[] = [
  { name: '派收同权', alpha: 1, beta: 1, cost: figure('20551.115631') },
  { name: '派件优先', alpha: 1.2, beta: 0.8, cost: figure('20615.513403') },
  { name: '收件优先', alpha: 0.8, beta: 1.2, cost: figure('20486.717858') },
  { name: '仅考虑派件', alpha: 1, beta: 0, cost: figure('10436.552247') },
  { name: '仅考虑收件', alpha: 0, beta: 1, cost: figure('10114.563384') },
]

export const EQUAL_AVG = figure('27.884824465288442')
export const EQUAL_MAX = figure('61.595860250507094')
export const EQUAL_SECOND_ID = 'S'
export const EQUAL_SECOND_COST = figure('21085.231966703253')

/** 从 R 出发、最后回到 R 的访问顺序（末尾不重复 R）。 */
export const SINGLE_VISITS = [
  'R', 'Q', 'I', 'E', 'J', 'G', 'C', 'T', 'H', 'D', 'L', 'A', 'B', 'M', 'P', 'N', 'O', 'K', 'F', 'S',
]

export const SINGLE_TOTAL = figure('337.6263390235943')
export const SINGLE_ROUNDED = figure('337.63')

const SINGLE_LEG_ROWS: [string, string, string, string][] = [
  ['R', 'Q', '18.060177186284744', '18.060177186284744'],
  ['Q', 'I', '15.654072952429985', '33.71425013871473'],
  ['I', 'E', '32.10763149159402', '65.82188163030875'],
  ['E', 'J', '7.8', '73.62188163030875'],
  ['J', 'G', '6.6287253676706195', '80.25060699797938'],
  ['G', 'C', '19.325889371514055', '99.57649636949343'],
  ['C', 'T', '31.975772078246994', '131.55226844774043'],
  ['T', 'H', '5.360037313302962', '136.9123057610434'],
  ['H', 'D', '15.868522300453815', '152.7808280614972'],
  ['D', 'L', '26.129676614914313', '178.9105046764115'],
  ['L', 'A', '45.5', '224.4105046764115'],
  ['A', 'B', '18.384776310850235', '242.79528098726175'],
  ['B', 'M', '14.822280526288795', '257.6175615135505'],
  ['M', 'P', '6.62872536767062', '264.2462868812211'],
  ['P', 'N', '6.628725367670621', '270.8750122488917'],
  ['N', 'O', '9.464142856064676', '280.3391551049564'],
  ['O', 'K', '24.181397809059757', '304.52055291401615'],
  ['K', 'F', '10.720074626605916', '315.2406275406221'],
  ['F', 'S', '14.061649974309558', '329.30227751493163'],
  ['S', 'R', '8.324061508662705', '337.6263390235943'],
]

export const SINGLE_LEGS: PaperLeg[] = SINGLE_LEG_ROWS.map(([from, to, distance, cumulative]) => ({
  from,
  to,
  distance: Number(distance),
  cumulative: Number(cumulative),
}))

function courier(
  sequence: string[],
  deliveries: number,
  pickups: number,
  maxLoad: number,
  length: string,
): PaperCourier {
  return { sequence, deliveries, pickups, maxLoad, length: figure(length) }
}

/** 能力 200、195：只约束派件之和。 */
export const WIDE_PLAN: PaperPlan = {
  capacities: [200, 195],
  total: figure('352.45'),
  couriers: [
    courier(
      ['D', 'L', 'A', 'B', 'M', 'P', 'N', 'O', 'K', 'F', 'S'],
      192,
      201,
      208,
      '202.18967424546142',
    ),
    courier(
      ['T', 'H', 'C', 'G', 'J', 'E', 'I', 'Q'],
      156,
      137,
      156,
      '150.25760290384127',
    ),
  ],
}

/** 能力 190、186，以及同时取派下四种能力。 */
export const TIGHT_PLAN: PaperPlan = {
  capacities: [190, 186],
  total: figure('353.31'),
  couriers: [
    courier(
      ['S', 'F', 'K', 'I', 'E', 'J', 'G', 'C', 'Q'],
      172,
      162,
      177,
      '177.92972463951085',
    ),
    courier(
      ['O', 'N', 'P', 'M', 'B', 'A', 'L', 'D', 'H', 'T'],
      176,
      176,
      186,
      '175.38116786308348',
    ),
  ],
}

export const SIMULTANEOUS_CAPACITIES = [200, 195, 190, 186]
export const SIMULTANEOUS_PEAK = 186
