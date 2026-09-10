import type { Equipment, RiskLevel } from '../types'
import { tenants } from './tenants'
import { mulberry32, pick, randInt, daysAgo } from './random'

const rng = mulberry32(1337)

const equipmentTypesByBiz: Record<string, string[]> = {
  석유화학: ['저장탱크', '반응기', '증류탑', '배관 매니폴드', '냉각설비'],
  정유: ['상압증류탑', '수소화탈황설비', '유황회수설비', '저장탱크', '이송펌프'],
  '발전·에너지': ['ESS 랙', '변전설비', '보일러', '터빈', '태양광 인버터'],
  정밀화학: ['반응기', '혼합조', '저장탱크', '집진설비', '폐수처리설비'],
  '가스저장·물류': ['LNG 저장탱크', '기화기', '압축기', '하역설비', '배관 매니폴드'],
}

const riskLevels: RiskLevel[] = ['안전', '안전', '안전', '주의', '경고', '위험']

export const equipment: Equipment[] = tenants.flatMap((tenant) => {
  const types = equipmentTypesByBiz[tenant.businessType] ?? ['일반설비']
  return Array.from({ length: tenant.equipmentCount }, (_, i) => {
    const type = pick(rng, types)
    const idx = i + 1
    return {
      id: `EQ-${tenant.id}-${String(idx).padStart(3, '0')}`,
      tenantId: tenant.id,
      name: `${type} #${idx}`,
      type,
      location: `${tenant.name} ${randInt(rng, 1, 5)}공구`,
      installedDate: daysAgo(randInt(rng, 200, 1800)).slice(0, 10),
      status: pick(rng, ['가동중', '가동중', '가동중', '정지', '점검중']) as Equipment['status'],
      riskLevel: pick(rng, riskLevels),
      sensorIds: [],
    } satisfies Equipment
  })
})
