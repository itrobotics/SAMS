// 學員批次匯入 Dialog（4 步驟精靈）
//
// Step 1：上傳檔案（drag & drop 或 click）
// Step 2：欄位對應（系統欄位 ↔ 檔案欄位）+ 預覽前 5 筆
// Step 3：匯入確認（筆數 + 重複處理方式）
// Step 4：進度與結果

import { useRef, useState } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import {
  autoMatchFields,
  detectDuplicates,
  importStudents,
  parseFile,
  SYSTEM_FIELDS,
  type DuplicateInfo,
  type FieldMapping,
  type ImportResult,
  type ParseResult,
} from '../services/studentImport';

interface Props {
  open: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  branchId: string;
}

type Step = 1 | 2 | 3 | 4;

export function StudentImportDialog({ open, onClose, classId, className, branchId }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setFile(null);
    setParsed(null);
    setMapping({});
    setDuplicateAction('skip');
    setDuplicates([]);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    setError(null);
    setParsing(false);
    setDetecting(false);
    setDragOver(false);
  }

  function handleClose() {
    if (importing) return;
    reset();
    onClose();
  }

  async function handleFile(f: File) {
    setFile(f);
    setError(null);
    setParsing(true);
    try {
      const pr = await parseFile(f);
      if (pr.rows.length === 0) throw new Error('檔案沒有資料列');
      setParsed(pr);
      setMapping(autoMatchFields(pr.headers));
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失敗');
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }

  async function handleToConfirm() {
    if (!parsed) return;
    if (!mapping.name) {
      setError('請選擇「姓名」對應的欄位（必填）');
      return;
    }
    setError(null);
    setDetecting(true);
    try {
      const dupes = await detectDuplicates(parsed.rows, mapping);
      setDuplicates(dupes);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : '檢查重複時發生錯誤');
    } finally {
      setDetecting(false);
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setStep(4);
    setImporting(true);
    setProgress({ done: 0, total: parsed.rows.length });
    try {
      const res = await importStudents(
        classId,
        branchId,
        parsed.rows,
        mapping,
        duplicateAction,
        (done, total) => setProgress({ done, total }),
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '匯入時發生錯誤');
    } finally {
      setImporting(false);
    }
  }

  const stepTitles: Record<Step, string> = {
    1: '上傳檔案',
    2: `欄位對應（${parsed?.rows.length ?? 0} 筆）`,
    3: '匯入確認',
    4: '匯入結果',
  };

  return (
    <Modal
      open={open}
      title={`匯入學員 — ${stepTitles[step]}`}
      onClose={handleClose}
      width={step === 2 ? 760 : 560}
    >
      {/* Step 1：上傳 */}
      {step === 1 && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          <div
            style={{
              border: `2px dashed ${dragOver ? '#2563eb' : '#d1d5db'}`,
              borderRadius: 8,
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? '#eff6ff' : '#f9fafb',
              transition: 'border-color .15s, background .15s',
            }}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
            <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>
              拖曳或點擊上傳 CSV / Excel 檔案
            </p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              支援 .csv 與 .xlsx 格式，第一列應為欄位名稱
            </p>
          </div>

          {file && !parsing && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              已選擇：<strong>{file.name}</strong>
            </p>
          )}
          {parsing && (
            <p style={{ marginTop: '0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>
              解析中…
            </p>
          )}
          {error && <div style={formStyles.error}>{error}</div>}

          <div style={formStyles.actions}>
            <button type="button" style={formStyles.btnSecondary} onClick={handleClose}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Step 2：欄位對應 */}
      {step === 2 && parsed && (
        <div>
          {/* 資料預覽 */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
              資料預覽（前 {Math.min(5, parsed.rows.length)} 筆）
            </p>
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {parsed.headers.map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                      {parsed.headers.map((h) => (
                        <td key={h} style={tdStyle}>{row[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 欄位對應表格 */}
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
            欄位對應
          </p>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', marginBottom: '0.75rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ ...thStyle, width: 110 }}>系統欄位</th>
                  <th style={{ ...thStyle, width: 160, color: '#6b7280' }}>說明</th>
                  <th style={thStyle}>對應匯入欄位</th>
                </tr>
              </thead>
              <tbody>
                {SYSTEM_FIELDS.map((sf) => (
                  <tr key={sf.key} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ ...tdStyle, fontWeight: sf.required ? 600 : 400 }}>
                      {sf.label}
                      {sf.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                    </td>
                    <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.8rem' }}>{sf.desc}</td>
                    <td style={tdStyle}>
                      <select
                        value={mapping[sf.key] ?? ''}
                        onChange={(e) =>
                          setMapping((m) => ({ ...m, [sf.key]: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.85rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: '#fff',
                        }}
                      >
                        <option value="">（不對應）</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div style={formStyles.error}>{error}</div>}

          <div style={formStyles.actions}>
            <button type="button" style={formStyles.btnSecondary} onClick={() => { setStep(1); setError(null); }}>
              ← 上一步
            </button>
            <button
              type="button"
              style={formStyles.btnPrimary}
              onClick={handleToConfirm}
              disabled={detecting}
            >
              {detecting ? '檢查重複中…' : '下一步 →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3：確認 */}
      {step === 3 && parsed && (
        <div>
          <div style={confirmBox}>
            <p style={{ margin: '0 0 0.4rem', fontWeight: 600, fontSize: '1rem' }}>
              將匯入 <span style={{ color: '#2563eb' }}>{parsed.rows.length}</span> 筆學員
            </p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
              課程：{className}（{classId}）
            </p>
          </div>

          {duplicates.length > 0 && (
            <div style={{ ...formStyles.error, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', marginTop: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
                ⚠ 發現 {duplicates.length} 筆重複（相同電話或身分證號已存在）
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dupeAction"
                    value="skip"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                  />
                  <span>跳過重複學員（保留現有資料，仍加入班級）</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dupeAction"
                    value="update"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                  />
                  <span>更新重複學員的資料（覆蓋已對應的欄位）</span>
                </label>
              </div>
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#92400e' }}>
                  查看重複名單
                </summary>
                <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', fontSize: '0.8rem' }}>
                  {duplicates.slice(0, 20).map((d, i) => (
                    <li key={i}>
                      第 {d.rowIndex + 1} 筆 {d.name}：
                      {d.matchField === 'phone' ? '電話' : '身分證號'} {d.matchValue} 已對應 {d.existingStudentId}
                    </li>
                  ))}
                  {duplicates.length > 20 && <li>…共 {duplicates.length} 筆</li>}
                </ul>
              </details>
            </div>
          )}

          {error && <div style={{ ...formStyles.error, marginTop: '0.75rem' }}>{error}</div>}

          <div style={formStyles.actions}>
            <button type="button" style={formStyles.btnSecondary} onClick={() => setStep(2)}>
              ← 上一步
            </button>
            <button type="button" style={formStyles.btnPrimary} onClick={handleImport}>
              開始匯入
            </button>
          </div>
        </div>
      )}

      {/* Step 4：進度與結果 */}
      {step === 4 && (
        <div>
          {importing && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: '#374151', fontSize: '0.9rem' }}>
                匯入中… {progress.done} / {progress.total}
              </p>
              <div style={{ background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: 8,
                    background: '#2563eb',
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                    transition: 'width .2s',
                  }}
                />
              </div>
            </div>
          )}

          {result && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                <StatCard label="成功新增" value={result.success} color="#166534" bg="#dcfce7" />
                <StatCard label="已跳過" value={result.skipped} color="#92400e" bg="#fef9c3" />
                <StatCard label="已更新" value={result.updated} color="#1e40af" bg="#dbeafe" />
                <StatCard label="失敗" value={result.failed} color="#991b1b" bg="#fee2e2" />
              </div>

              {result.errors.length > 0 && (
                <div style={{ border: '1px solid #fecaca', borderRadius: 6, padding: '0.75rem', background: '#fef2f2' }}>
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: '#b91c1c', fontSize: '0.9rem' }}>
                    失敗原因（{result.errors.length} 筆）
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#b91c1c' }}>
                    {result.errors.map((e, i) => (
                      <li key={i}>第 {e.row} 筆（{e.name}）：{e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && !result && <div style={formStyles.error}>{error}</div>}

          <div style={formStyles.actions}>
            {!importing && (
              <button type="button" style={formStyles.btnPrimary} onClick={handleClose}>
                完成
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── 小元件 ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', color }}>{label}</span>
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ─── inline styles ────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.82rem',
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  verticalAlign: 'middle',
};

const confirmBox: React.CSSProperties = {
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: 8,
  padding: '1rem 1.25rem',
};
