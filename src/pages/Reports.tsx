import { useState } from 'react'
import { Download, PlayCircle, FileBarChart } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { safetyReports } from '../data/reports'
import { formatDateTime } from '../data/random'
import type { SafetyReport } from '../types'

export function Reports() {
  const [reports, setReports] = useState<SafetyReport[]>(safetyReports)

  function generateNow(id: string) {
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: '생성완료', lastGeneratedAt: new Date().toISOString() } : r,
      ),
    )
  }

  function download(report: SafetyReport) {
    const content = [
      `제목: ${report.title}`,
      `템플릿: ${report.templateName}`,
      `배포주기: ${report.schedule}`,
      `수신자: ${report.recipients.join(', ')}`,
      `생성일시: ${report.lastGeneratedAt ? formatDateTime(report.lastGeneratedAt) : '-'}`,
      '',
      '※ 본 문서는 여수 스마트 산업단지 통합 안전관리 플랫폼에서 더미 데이터로 생성된 예시 리포트입니다.',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="안전 리포트 생성·관리"
        description="공통 리포트 템플릿, 배포 스케줄, 수신자를 관리하고 스케줄에 따라 정기 리포트를 자동 생성·발송합니다."
      />

      <div className="grid grid-cols-1 gap-4">
        {reports.map((r) => (
          <Card key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <FileBarChart size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{r.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {r.templateName} · {r.schedule} 배포
                </p>
                <p className="mt-1 text-[11px] text-slate-400">수신자: {r.recipients.join(', ')}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  최근 생성: {r.lastGeneratedAt ? formatDateTime(r.lastGeneratedAt) : '이력 없음'} · 다음 예정:{' '}
                  {formatDateTime(r.nextScheduledAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <Badge>{r.status}</Badge>
              <div className="flex gap-2">
                <button
                  onClick={() => generateNow(r.id)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <PlayCircle size={13} /> 즉시 생성
                </button>
                <button
                  onClick={() => download(r)}
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Download size={13} /> 다운로드
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
