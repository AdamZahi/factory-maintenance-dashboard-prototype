import { useRef, useState } from 'react'
import { format, startOfWeek } from 'date-fns'
import { Card, CardHeader, Button, Badge } from './ui/Primitives'
import { useInspections } from '../hooks/useData'
import { downloadWeekExport, importWorkbook, readWorkbookFromFile } from '../lib/excel'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'

export function ImportExport() {
  const { items: inspections, saveMany } = useInspections()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importSummary, setImportSummary] = useState<{ count: number; warnings: string[] } | null>(null)
  const [exportWeek, setExportWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setBusy(true)
    setImportSummary(null)
    try {
      const wb = await readWorkbookFromFile(file)
      const result = importWorkbook(wb)
      if (result.records.length > 0) saveMany(result.records)
      setImportSummary({ count: result.records.length, warnings: result.warnings })
    } catch (err) {
      setImportSummary({ count: 0, warnings: [`Erreur de lecture du fichier : ${(err as Error).message}`] })
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => {
    const weekRecords = inspections.filter((r) => {
      const weekStart = format(startOfWeek(new Date(r.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      return weekStart === format(startOfWeek(new Date(exportWeek), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    })
    downloadWeekExport(weekRecords, { weekStartDate: exportWeek, usine: 'SBM Tunisie' })
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Importer un fichier Excel" subtitle="Fiches hebdomadaires existantes (même modèle que le fichier papier)" />
        <div className="space-y-4 p-5">
          <div
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[--color-graphite-200] p-8 text-center hover:border-[--color-amber-signal]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
          >
            <FileSpreadsheet className="h-8 w-8 text-[--color-graphite-500]" />
            <p className="text-sm text-[--color-graphite-700]">Glissez-déposez un fichier .xlsx ici</p>
            <p className="text-xs text-[--color-graphite-500]">ou</p>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <Upload className="h-3.5 w-3.5" /> Choisir un fichier
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
          </div>

          {busy && <p className="text-xs text-[--color-graphite-500]">Lecture du fichier…</p>}

          {importSummary && (
            <div className="space-y-2 rounded-lg border border-[--color-graphite-200] p-3 text-sm">
              {importSummary.count > 0 ? (
                <p className="flex items-center gap-2 text-[--color-status-normal]">
                  <CheckCircle2 className="h-4 w-4" /> {importSummary.count} jour(s) d'inspection importés
                </p>
              ) : (
                <p className="flex items-center gap-2 text-[--color-status-critical]">
                  <AlertCircle className="h-4 w-4" /> Aucune donnée importée
                </p>
              )}
              {importSummary.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-xs text-[--color-graphite-500]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[--color-status-warning]" /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Exporter une semaine" subtitle="Génère le même modèle que la fiche papier administrative" />
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Semaine contenant</label>
            <input type="date" value={exportWeek} onChange={(e) => setExportWeek(e.target.value)} className="w-full rounded-lg border border-[--color-graphite-200] px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-[--color-graphite-500]">
            Semaine du {format(startOfWeek(new Date(exportWeek), { weekStartsOn: 1 }), 'dd/MM/yyyy')} — export au format .xlsx, mise en page identique à la fiche de contrôle actuelle.
          </p>
          <Badge>{inspections.filter((r) => format(startOfWeek(new Date(r.date), { weekStartsOn: 1 }), 'yyyy-MM-dd') === format(startOfWeek(new Date(exportWeek), { weekStartsOn: 1 }), 'yyyy-MM-dd')).length} inspection(s) sur cette semaine</Badge>
          <Button variant="primary" className='p-0.5 m-0.5 cursor-pointer bg-green-700 hover:bg-green-800' onClick={handleExport}>
            <Download className="h-4 w-4" /> Exporter en Excel
          </Button>
        </div>
      </Card>
    </div>
  )
}
