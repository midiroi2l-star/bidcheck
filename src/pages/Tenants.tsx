import { useMemo, useState } from 'react'
import { Search, Plus, Trash2, X, Building2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { inputBase, btnPrimary, btnGhost, iconBtn } from '../components/ui/styles'
import * as tb from '../components/ui/table'
import { tenants as initialTenants } from '../data/tenants'
import { formatDate } from '../data/random'
import type { Tenant } from '../types'

const MAX_TENANTS = 20

const emptyForm = {
  name: '',
  businessType: '석유화학',
  address: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
}

export function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const filtered = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.businessType.toLowerCase().includes(query.toLowerCase()),
      ),
    [tenants, query],
  )

  function addTenant() {
    if (!form.name.trim()) return
    const newTenant: Tenant = {
      id: `T-${String(tenants.length + 1).padStart(3, '0')}`,
      name: form.name,
      businessType: form.businessType,
      address: form.address || '전남 여수시',
      lat: 34.74 + Math.random() * 0.1,
      lng: 127.64 + Math.random() * 0.1,
      status: '운영중',
      riskLevel: '안전',
      contactName: form.contactName || '미지정',
      contactPhone: form.contactPhone || '-',
      contactEmail: form.contactEmail || '-',
      joinedDate: new Date().toISOString().slice(0, 10),
      equipmentCount: 0,
      sensorCount: 0,
      digitalTwinLinked: false,
      aiPredictionLinked: false,
    }
    setTenants((prev) => [newTenant, ...prev])
    setForm(emptyForm)
    setShowForm(false)
  }

  function removeTenant(id: string) {
    setTenants((prev) => prev.filter((t) => t.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div>
      <PageHeader
        title="수요기업 관리"
        description={`여수산업단지 내 수용가 기업정보를 관리합니다. 현재 ${tenants.length}개사 등록 (최대 ${MAX_TENANTS}개사 확장 가능)`}
        action={
          <button onClick={() => setShowForm(true)} disabled={tenants.length >= MAX_TENANTS} className={btnPrimary}>
            <Plus size={16} /> 수요기업 등록
          </button>
        }
      />

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[color:var(--color-ink-3)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="기업명, 업종 검색"
              className={`${inputBase} w-64 pl-8`}
            />
          </div>
          <p className="text-xs text-[color:var(--color-ink-3)]">총 {filtered.length}개사</p>
        </div>

        <div className={tb.tableWrap}>
          <table className={`${tb.table} min-w-[900px]`}>
            <thead className={tb.thead}>
              <tr>
                <th className={tb.th}>기업명</th>
                <th className={tb.th}>업종</th>
                <th className={tb.th}>담당자</th>
                <th className={tb.th}>설비/센서</th>
                <th className={tb.th}>등록일</th>
                <th className={tb.th}>운영상태</th>
                <th className={tb.th}>위험도</th>
                <th className={`${tb.th} text-right`}>관리</th>
              </tr>
            </thead>
            <tbody className={tb.tbody}>
              {filtered.map((t) => (
                <tr key={t.id} className={`${tb.tr} cursor-pointer`} onClick={() => setSelected(t)}>
                  <td className={tb.tdStrong}>{t.name}</td>
                  <td className={tb.td}>{t.businessType}</td>
                  <td className={tb.td}>{t.contactName}</td>
                  <td className={`${tb.td} tabular`}>
                    {t.equipmentCount}대 / {t.sensorCount}개
                  </td>
                  <td className={`${tb.td} tabular`}>{formatDate(t.joinedDate)}</td>
                  <td className={tb.td}>{t.status}</td>
                  <td className={tb.td}>
                    <Badge dot>{t.riskLevel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeTenant(t.id)
                      }}
                      className={iconBtn}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[color:var(--color-ink-3)]">
                    등록된 수요기업이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[color:var(--color-bg-elevated)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3987e5]/15 text-[#7ab1f2]">
                  <Building2 size={18} />
                </div>
                <h3 className="text-sm font-bold text-[color:var(--color-ink-1)]">{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className={iconBtn}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <dl className="space-y-3 text-sm">
                {[
                  ['업종', selected.businessType],
                  ['주소', selected.address],
                  ['담당자', selected.contactName],
                  ['연락처', selected.contactPhone],
                  ['이메일', selected.contactEmail],
                  ['등록일', formatDate(selected.joinedDate)],
                  ['설비 수', `${selected.equipmentCount}대`],
                  ['센서 수', `${selected.sensorCount}개`],
                  ['디지털트윈 연계', selected.digitalTwinLinked ? '연계됨' : '미연계'],
                  ['AI 예측 연계', selected.aiPredictionLinked ? '연계됨' : '미연계'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
                    <dt className="text-[color:var(--color-ink-3)]">{k}</dt>
                    <dd className="font-medium text-[color:var(--color-ink-1)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="glass-panel relative w-full max-w-md rounded-2xl bg-[color:var(--color-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[color:var(--color-ink-1)]">수요기업 신규 등록</h3>
              <button onClick={() => setShowForm(false)} className={iconBtn}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-2)]">기업명</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputBase} w-full py-2 text-sm`}
                  placeholder="예) 여수신소재산업(주)"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-2)]">업종</label>
                <select
                  value={form.businessType}
                  onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                  className={`${inputBase} w-full py-2 text-sm`}
                >
                  {['석유화학', '정유', '발전·에너지', '정밀화학', '가스저장·물류'].map((b) => (
                    <option key={b} className="bg-[color:var(--color-surface)]">
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-2)]">주소</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={`${inputBase} w-full py-2 text-sm`}
                  placeholder="전남 여수시 ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-2)]">담당자</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className={`${inputBase} w-full py-2 text-sm`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[color:var(--color-ink-2)]">연락처</label>
                  <input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className={`${inputBase} w-full py-2 text-sm`}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className={btnGhost}>
                취소
              </button>
              <button onClick={addTenant} className={btnPrimary}>
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
