// 學生新增 / 編輯表單（Task 056）

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { TaiwanAddressFields, type AddressValue } from './TaiwanAddressFields';
import { useBranches } from '../hooks/useBranches';
import { subscribeOptions } from '../services/appOptions';
import { createStudent, deleteStudent, updateStudent } from '../services/students';
import {
  GENDER_LABELS,
  STUDENTS_COLLECTION,
  isValidStudentId,
  type Gender,
  type StudentDoc,
} from '../types/student';
import { OPTION_KEYS } from '../types/appOptions';
import { getNextId } from '../utils/autoId';

interface StudentFormDialogProps {
  open: boolean;
  initial: StudentDoc | null;
  defaultBranchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_ADDR: AddressValue = { city: '', district: '', address: '' };

export function StudentFormDialog({
  open,
  initial,
  defaultBranchId,
  onClose,
  onSaved,
}: StudentFormDialogProps) {
  const isEdit = !!initial;
  const { branches } = useBranches(true);
  const [relationshipOptions, setRelationshipOptions] = useState<string[]>([]);

  const [studentId, setStudentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [birthday, setBirthday] = useState('');
  const [grade, setGrade] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [mailingAddr, setMailingAddr] = useState<AddressValue>(EMPTY_ADDR);
  const [regSameAsMailing, setRegSameAsMailing] = useState(false);
  const [registeredAddr, setRegisteredAddr] = useState<AddressValue>(EMPTY_ADDR);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = subscribeOptions(OPTION_KEYS.relationships, setRelationshipOptions);
    return u;
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      getNextId('S', STUDENTS_COLLECTION).then(setStudentId).catch(() => {});
    } else {
      setStudentId(initial.studentId);
    }
    setBranchId(initial?.branchId ?? defaultBranchId ?? '');
    setName(initial?.name ?? '');
    setGender(initial?.gender ?? 'other');
    setBirthday(initial?.birthday ?? '');
    setGrade(initial?.grade ?? '');
    setParentName(initial?.parentName ?? '');
    setParentPhone(initial?.parentPhone ?? '');
    setMailingAddr({
      city: initial?.mailingCity ?? '',
      district: initial?.mailingDistrict ?? '',
      address: initial?.mailingAddress ?? '',
    });
    setRegSameAsMailing(initial?.registeredAddressSameAsMailing ?? false);
    setRegisteredAddr({
      city: initial?.registeredCity ?? '',
      district: initial?.registeredDistrict ?? '',
      address: initial?.registeredAddress ?? '',
    });
    setEmergencyContactName(initial?.emergencyContactName ?? '');
    setEmergencyContactRelation(initial?.emergencyContactRelation ?? '');
    setNotes(initial?.notes ?? '');
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial, defaultBranchId]);

  useEffect(() => {
    if (!open || isEdit) return;
    if (!branchId && branches.length === 1) setBranchId(branches[0].branchId);
  }, [open, isEdit, branchId, branches]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!isEdit && !isValidStudentId(studentId.trim())) {
      setError('學號格式錯誤（僅限英數、_、-，2-30 字元）');
      return;
    }
    if (!branchId) { setError('請選擇分校'); return; }
    if (!name.trim()) { setError('請填寫姓名'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const regAddr = regSameAsMailing ? mailingAddr : registeredAddr;
      if (isEdit && initial) {
        await updateStudent(initial.studentId, {
          branchId, name, gender, birthday,
          grade, parentName, parentPhone,
          mailingCity: mailingAddr.city,
          mailingDistrict: mailingAddr.district,
          mailingAddress: mailingAddr.address,
          registeredAddressSameAsMailing: regSameAsMailing,
          registeredCity: regAddr.city,
          registeredDistrict: regAddr.district,
          registeredAddress: regAddr.address,
          emergencyContactName, emergencyContactRelation, notes, active,
        });
      } else {
        await createStudent({
          studentId, branchId, name, gender, birthday,
          grade, parentName, parentPhone,
          mailingCity: mailingAddr.city,
          mailingDistrict: mailingAddr.district,
          mailingAddress: mailingAddr.address,
          registeredAddressSameAsMailing: regSameAsMailing,
          registeredCity: regAddr.city,
          registeredDistrict: regAddr.district,
          registeredAddress: regAddr.address,
          emergencyContactName, emergencyContactRelation, notes,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? '編輯學生' : '新增學生'} onClose={onClose} width={600}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        {/* 學號 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>學號<span style={formStyles.required}>*</span></label>
          <input
            style={{ ...formStyles.input, background: '#f9fafb' }}
            value={studentId} readOnly placeholder="載入中…"
            disabled={submitting} required
          />
          {!isEdit && <span style={formStyles.hint}>系統自動帶入，建立後不可修改。</span>}
        </div>

        {/* 分校 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>分校<span style={formStyles.required}>*</span></label>
          <select style={formStyles.select} value={branchId}
            onChange={(e) => setBranchId(e.target.value)} disabled={submitting} required>
            <option value="">請選擇</option>
            {branches.map((b) => (
              <option key={b.branchId} value={b.branchId}>{b.name}（{b.branchId}）</option>
            ))}
          </select>
        </div>

        {/* 姓名 + 性別 + 生日 */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>姓名<span style={formStyles.required}>*</span></label>
            <input style={formStyles.input} value={name}
              onChange={(e) => setName(e.target.value)} placeholder="例：王小明"
              disabled={submitting} required />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>年級</label>
            <input style={formStyles.input} value={grade}
              onChange={(e) => setGrade(e.target.value)} placeholder="例：小三"
              disabled={submitting} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>性別</label>
            <div style={{ display: 'flex', gap: '1rem', padding: '0.45rem 0' }}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <label key={g} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="gender" value={g}
                    checked={gender === g} onChange={() => setGender(g)} disabled={submitting} />
                  {GENDER_LABELS[g]}
                </label>
              ))}
            </div>
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>生日</label>
            <input type="date" style={formStyles.input} value={birthday}
              onChange={(e) => setBirthday(e.target.value)} disabled={submitting} />
          </div>
        </div>

        {/* 家長 */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>家長姓名</label>
            <input style={formStyles.input} value={parentName}
              onChange={(e) => setParentName(e.target.value)} placeholder="例：王媽媽"
              disabled={submitting} />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>家長電話</label>
            <input type="tel" style={formStyles.input} value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)} placeholder="例：09xxxxxxxx"
              disabled={submitting} />
          </div>
        </div>

        {/* 通訊地址 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>通訊地址</label>
          <TaiwanAddressFields value={mailingAddr} onChange={setMailingAddr} disabled={submitting} />
        </div>

        {/* 戶籍地址 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>戶籍地址</label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={regSameAsMailing}
              onChange={(e) => setRegSameAsMailing(e.target.checked)} disabled={submitting} />
            同通訊地址
          </label>
          {!regSameAsMailing && (
            <TaiwanAddressFields value={registeredAddr} onChange={setRegisteredAddr} disabled={submitting} />
          )}
          {regSameAsMailing && (
            <span style={formStyles.hint}>
              {mailingAddr.city}{mailingAddr.district}{mailingAddr.address || '（尚未填寫通訊地址）'}
            </span>
          )}
        </div>

        {/* 緊急聯絡人 */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 2 }}>
            <label style={formStyles.label}>緊急聯絡人</label>
            <input style={formStyles.input} value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              placeholder="姓名" disabled={submitting} />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>關係</label>
            <select style={formStyles.select} value={emergencyContactRelation}
              onChange={(e) => setEmergencyContactRelation(e.target.value)} disabled={submitting}>
              <option value="">請選擇</option>
              {relationshipOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 備註 */}
        <div style={formStyles.field}>
          <label style={formStyles.label}>備註</label>
          <textarea
            style={{ ...formStyles.input, height: 72, resize: 'vertical' }}
            value={notes} onChange={(e) => setNotes(e.target.value)}
            disabled={submitting} placeholder="其他說明…"
          />
        </div>

        {isEdit && (
          <div style={formStyles.field}>
            <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={active}
                onChange={(e) => setActive(e.target.checked)} disabled={submitting} />
              啟用此學生（取消勾選等同停用）
            </label>
          </div>
        )}

        <div style={{ ...formStyles.actions, justifyContent: 'space-between' }}>
          <div>
            {isEdit && initial && (
              <button type="button" style={formStyles.btnDanger} disabled={submitting}
                onClick={async () => {
                  if (!window.confirm(`確定要永久刪除學生「${initial.name}」？\n\n此操作無法復原，歷史出席紀錄仍會保留。`)) return;
                  setSubmitting(true);
                  try {
                    await deleteStudent(initial.studentId);
                    onSaved();
                    onClose();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '刪除失敗');
                    setSubmitting(false);
                  }
                }}>
                刪除學生
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={formStyles.btnSecondary} onClick={onClose} disabled={submitting}>
              取消
            </button>
            <button type="submit" style={formStyles.btnPrimary} disabled={submitting}>
              {submitting ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
