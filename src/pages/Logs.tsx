import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { operationLogs } from '../data/users'
import { formatDateTime } from '../data/random'
import type { OperationLog } from '../types'

const categories: OperationLog['category'][] = ['등록', '수정', '삭제', '조회', '스케줄링', '설정변경']

const categoryStyle: Record<OperationLog['category'], string> = {
  등록: 'bg-blue-50 text-blue-700',
  수정: 'bg-amber-50 text-amber-700',
  삭제: 'bg-red-50 text-red-700',
  조회: 'bg-slate-100 text-slate-600',
  스케줄링: 'bg-purple-50 text-purple-700',
  설정변경: 'bg-teal-50 text-teal-700',
}

export function Logs() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'전체' | OperationLog['category']>('전체')

  const filtered = useMemo(
    () =>
      operationLogs.filter((l) => {
        const matchQuery =
          l.userName.toLowerCase().includes(query.toLowerCase()) ||
          l.target.toLowerCase().includes(query.toLowerCase()) ||
          l.detail.toLowerCase().includes(query.toLowerCase())
        const matchCategory = category === '전체' || l.category === category
        return matchQuery && matchCategory
      }),
    [query, category],
  )

  return (
    <div>
      <PageHeader
        title="운영정보 로그 관리"
        description="사용자 주요 행위, 배치작업 스케줄링 및 플랫폼 환경 설정 변경 이력을 통합 관리합니다."
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['전체', ...categories] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사용자, 대상, 내용 검색"
              className="w-64 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="max-h-[640px] overflow-y-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">시각</th>
                <th className="px-4 py-2.5 font-medium">구분</th>
                <th className="px-4 py-2.5 font-medium">대상</th>
                <th className="px-4 py-2.5 font-medium">처리자</th>
                <th className="px-4 py-2.5 font-medium">상세내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDateTime(l.timestamp)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${categoryStyle[l.category]}`}>
                      {l.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{l.target}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.userName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{l.detail}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
