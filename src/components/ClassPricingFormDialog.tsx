// 班級定價新增 / 編輯表單

import { useEffect, useState, type FormEvent } from 'react';

import { Modal } from './Modal';
import { formStyles } from './formStyles';
import { useAuth } from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import { subscribeClasses } from '../services/classes';
import { createClassPricing, updateClassPricing } from '../services/classPricing';
import type { ClassDoc } from '../types/class';
import {
  PRICE_TYPES,
  PRICE_TYPE_LABELS,
  type ClassPricingDoc,
  type PriceType,
} from '../types/classPricing';

interface Props {
  open: boolean;
  initial: ClassPricingDoc | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ClassPricingFormDialog({ open, initial, onClose, onSaved }: Props) {
  const isEdit = !!initial;
  const { user } = useAuth();
  const { branches } = useBranches(true);

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [classId, setClassId] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('per_class');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 訂閱可選班級（依角色 / 分校過濾）。
  useEffect(() => {
    if (!user) return;
    const branchIds = user.role === 'hq_admin' ? undefined : user.branchIds;
    if (user.role !== 'hq_admin' && (!branchIds || branchIds.length === 0)) {
      setClasses([]);
      return;
    }
    return subscribeClasses({ branchIds, activeOnly: true }, setClasses);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    setClassId(initial?.classId ?? '');
    setPrice(initial ? String(initial.price) : '');
    setPriceType(initial?.priceType ?? 'per_class');
    setNotes(initial?.notes ?? '');
    setActive(initial?.active ?? true);
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!user) return;
    if (!classId) return setError('請選擇班級');
    const klass = classes.find((c) => c.classId === classId);
    if (!klass) return setError('找不到班級資料，請重新選擇');
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return setError('定價必須為大於等於 0 的數字');
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && initial) {
        await updateClassPricing(initial.pricingId, {
          classId: klass.classId,
          branchId: klass.branchId,
          className: klass.name,
          price: priceNum,
          priceType,
          notes,
          active,
        });
      } else {
        await createClassPricing({
          classId: klass.classId,
          branchId: klass.branchId,
          className: klass.name,
          price: priceNum,
          priceType,
          notes,
          active,
          createdBy: user.userId,
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

  const branchName = (id: string) => branches.find((b) => b.branchId === id)?.name ?? id;

  return (
    <Modal open={open} title={isEdit ? '編輯定價' : '新增定價'} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        {error && <div style={formStyles.error}>{error}</div>}

        <div style={formStyles.field}>
          <label style={formStyles.label}>
            班級<span style={formStyles.required}>*</span>
          </label>
          <select
            style={formStyles.select}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={submitting || isEdit}
            required
          >
            <option value="">請選擇</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.classId} - {c.name}（{branchName(c.branchId)}）
              </option>
            ))}
          </select>
          {isEdit && (
            <span style={formStyles.hint}>編輯時不可變更班級；如需變更請新增另一筆定價</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>
              定價（每人 TWD）<span style={formStyles.required}>*</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              style={formStyles.input}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="例：3000"
              disabled={submitting}
              required
            />
          </div>
          <div style={{ ...formStyles.field, flex: 1 }}>
            <label style={formStyles.label}>
              計費方式<span style={formStyles.required}>*</span>
            </label>
            <select
              style={formStyles.select}
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType)}
              disabled={submitting}
              required
            >
              {PRICE_TYPES.map((pt) => (
                <option key={pt} value={pt}>{PRICE_TYPE_LABELS[pt]}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={formStyles.field}>
          <label style={formStyles.label}>備註</label>
          <textarea
            style={formStyles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例：寒假特惠價、團報優惠等"
            disabled={submitting}
          />
        </div>

        <div style={formStyles.field}>
          <label style={{ ...formStyles.label, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={submitting}
            />
            啟用此定價（取消勾選等同停用，將不納入營收計算）
          </label>
        </div>

        <div style={formStyles.actions}>
          <button type="button" style={formStyles.btnSecondary} onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="submit" style={formStyles.btnPrimary} disabled={submitting}>
            {submitting ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
