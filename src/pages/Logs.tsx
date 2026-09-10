import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { inputBase, filterPill } from '../components/ui/styles'
import * as tb from '../components/ui/table'
import { operationLogs } from '../data/users'
import { formatDateTime } from '../data/random'
import type { OperationLog } from '../types'

const categories: OperationLog['category'][] = ['등록', '수정', '삭제', '조회', '스케줄링', '설정변경']

const categoryStyle: Record<OperationLog['category'], string> = {
  등록: 'bg-[#3987e5]/15 text-[#7ab1f2]',
  수정: 'bg-[#fab219]/15 text-[#ffc94d]',
  삭제: 'bg-[#d03b3b]/15 text-[#ff6b6b]',
  조회: 'bg-white/[0.06] text-[color:var(--color-ink-2)]',
  스케줄링: 'bg-[#9085e9]/15 text-[#b3aaf2]',
  설정변경: 'bg-[#199e70]/15 text-[#4dd6a4]',
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['전체', ...categories] as const).map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={filterPill(category === c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[color:var(--color-ink-3)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="사용자, 대상, 내용 검색"
              className={`${inputBase} w-64 pl-8`}
            />
          </div>
        </div>

        <div className="max-h-[640px] overflow-y-auto">
          <table className={`${tb.table} min-w-[780px]`}>
            <thead className={tb.thead}>
              <tr>
                <th className={tb.th}>시각</th>
                <th className={tb.th}>구분</th>
                <th className={tb.th}>대상</th>
                <th className={tb.th}>처리자</th>
                <th className={tb.th}>상세내용</th>
              </tr>
            </thead>
            <tbody className={tb.tbody}>
              {filtered.map((l) => (
                <tr key={l.id} className={tb.tr}>
                  <td className={`${tb.td} tabular whitespace-nowrap`}>{formatDateTime(l.timestamp)}</td>
                  <td className={tb.td}>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${categoryStyle[l.category]}`}>
                      {l.category}
                    </span>
                  </td>
                  <td className={tb.tdStrong}>{l.target}</td>
                  <td className={tb.td}>{l.userName}</td>
                  <td className={tb.td}>{l.detail}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[color:var(--color-ink-3)]">
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
