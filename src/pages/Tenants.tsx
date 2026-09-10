import { useMemo, useState } from 'react'
import { Search, Plus, Trash2, X, Building2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
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
          <button
            onClick={() => setShowForm(true)}
            disabled={tenants.length >= MAX_TENANTS}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} /> 수요기업 등록
          </button>
        }
      />

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="기업명, 업종 검색"
              className="w-64 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </div>
          <p className="text-xs text-slate-400">총 {filtered.length}개사</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">기업명</th>
                <th className="px-4 py-2.5 font-medium">업종</th>
                <th className="px-4 py-2.5 font-medium">담당자</th>
                <th className="px-4 py-2.5 font-medium">설비/센서</th>
                <th className="px-4 py-2.5 font-medium">등록일</th>
                <th className="px-4 py-2.5 font-medium">운영상태</th>
                <th className="px-4 py-2.5 font-medium">위험도</th>
                <th className="px-4 py-2.5 font-medium text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setSelected(t)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-3 text-slate-600">{t.businessType}</td>
                  <td className="px-4 py-3 text-slate-600">{t.contactName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.equipmentCount}대 / {t.sensorCount}개
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.joinedDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{t.status}</td>
                  <td className="px-4 py-3">
                    <Badge dot>{t.riskLevel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeTenant(t.id)
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
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
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setSelected(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Building2 size={18} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
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
                  <div key={k} className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="font-medium text-slate-700">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">수요기업 신규 등록</h3>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">기업명</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="예) 여수신소재산업(주)"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">업종</label>
                <select
                  value={form.businessType}
                  onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  {['석유화학', '정유', '발전·에너지', '정밀화학', '가스저장·물류'].map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">주소</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="전남 여수시 ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">담당자</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">연락처</label>
                  <input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={addTenant}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
