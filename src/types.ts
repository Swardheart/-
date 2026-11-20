export interface RankRow {
  id: string
  cost: number
  avgDistance: number
  maxDistance: number
}

export interface PresetResult {
  name: string
  alpha: number
  beta: number
  bestId: string
  paperBestId: string
  paperCost: number
  paperCostText: string
  ranking: RankRow[]
  paperAvgDistance: number | null
  paperAvgText: string | null
  paperMaxDistance: number | null
  paperMaxText: string | null
  paperSecondId: string | null
  paperSecondCost: number | null
  paperSecondText: string | null
}

export interface Leg {
  from: string
  to: string
  distance: number
  cumulative: number
  paperDistance: number | null
  paperCumulative: number | null
}

export interface LoadStop {
  id: string
  load: number
}

export interface CourierResult {
  sequence: string[]
  deliveries: number
  pickups: number
  length: number
  maxLoad: number
  loadProfile: LoadStop[]
  paperSequence: string[]
  paperDeliveries: number
  paperPickups: number
  paperLength: number
  paperLengthText: string
  paperMaxLoad: number
}

export interface PlanResult {
  capacity: number
  totalLength: number
  paperTotalLength: number
  paperTotalText: string
  couriers: [CourierResult, CourierResult]
}

export interface DistanceCheck {
  name: string
  computed: number
  paper: number
  paperText: string
}

export interface LabResults {
  checks: DistanceCheck[]
  presets: PresetResult[]
  single: {
    visits: string[]
    legs: Leg[]
    total: number
    paperTotal: number
    paperTotalText: string
    paperRoundedText: string
  }
  delivery: PlanResult[]
  simultaneous: PlanResult[]
}
