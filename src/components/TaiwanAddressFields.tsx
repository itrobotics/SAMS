// 可重用的臺灣地址輸入元件：縣市 | 行政區 | 地址（自由文字）
// 縣市/行政區皆為 dropdown，選縣市後行政區清單連動更新。

import { useEffect } from 'react';
import { formStyles } from './formStyles';
import { TAIWAN_CITIES, TAIWAN_DISTRICTS } from '../data/taiwanDistricts';

export interface AddressValue {
  city: string;
  district: string;
  address: string;
}

interface TaiwanAddressFieldsProps {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  disabled?: boolean;
  required?: boolean;
  cityLabel?: string;
}

export function TaiwanAddressFields({
  value,
  onChange,
  disabled = false,
  required = false,
  cityLabel,
}: TaiwanAddressFieldsProps) {
  const districts = value.city ? (TAIWAN_DISTRICTS[value.city] ?? []) : [];

  // 切換縣市時若行政區不在新清單中則清空
  useEffect(() => {
    if (value.city && value.district && !TAIWAN_DISTRICTS[value.city]?.includes(value.district)) {
      onChange({ ...value, district: '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.city]);

  return (
    <div style={wrapStyle}>
      {cityLabel && <span style={labelHintStyle}>{cityLabel}</span>}
      <div style={rowStyle}>
        <select
          aria-label="縣市"
          style={{ ...formStyles.select, flex: '0 0 110px' }}
          value={value.city}
          onChange={(e) => onChange({ ...value, city: e.target.value, district: '' })}
          disabled={disabled}
          required={required}
        >
          <option value="">縣市</option>
          {TAIWAN_CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="行政區"
          style={{ ...formStyles.select, flex: '0 0 110px' }}
          value={value.district}
          onChange={(e) => onChange({ ...value, district: e.target.value })}
          disabled={disabled || districts.length === 0}
          required={required && !!value.city}
        >
          <option value="">行政區</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input
          aria-label="地址"
          style={{ ...formStyles.input, flex: 1, minWidth: 0 }}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="路/街/巷/號"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const rowStyle: React.CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'center' };
const labelHintStyle: React.CSSProperties = { fontSize: '0.82rem', color: '#6b7280' };
