import React from 'react';
import { Compass, MapPin, Trash2, X } from 'lucide-react';
import { ExamPin, PinCategory } from '../types';

interface PinEditorPanelProps {
  pin: ExamPin;
  onUpdatePin: (updated: ExamPin) => void;
  onDeletePin: (pinId: string) => void;
  onOpenPanorama: (pin: ExamPin) => void;
  onClose: () => void;
}

export const PinEditorPanel: React.FC<PinEditorPanelProps> = ({
  pin,
  onUpdatePin,
  onDeletePin,
  onOpenPanorama,
  onClose,
}) => {
  return (
    <aside className="editor-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <MapPin size={18} className="text-blue" />
          <span>Экзаменационная метка</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        <div className="editor-section">
          <label className="section-label">Категория метки</label>
          <select
            className="select-control"
            value={pin.category}
            onChange={(e) =>
              onUpdatePin({ ...pin, category: e.target.value as PinCategory })
            }
          >
            <option value="gibdd">🚔 МРЭО ГИБДД / Старт маршрута</option>
            <option value="uturn">↶ Место для разворота</option>
            <option value="stop_allowed">🅿️ Разрешённое место остановки</option>
            <option value="stop_forbidden">🚫 Остановка запрещена</option>
            <option value="trap">⚠️ Ловушка экзаменатора / Скрытый знак</option>
            <option value="speed">🚀 Скоростной режим / Разгон до 40/60</option>
          </select>
        </div>

        <div className="editor-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="section-label">Масштаб значка на карте</label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
              {Math.round((pin.scale ?? 1) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={pin.scale ?? 1}
            onChange={(e) =>
              onUpdatePin({ ...pin, scale: Number(e.target.value) })
            }
            style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            💡 Метку можно свободно перетаскивать мышью прямо на карте.
          </p>
        </div>

        <div className="editor-section">
          <label className="section-label">Заголовок</label>
          <input
            type="text"
            className="input-text"
            value={pin.title}
            onChange={(e) => onUpdatePin({ ...pin, title: e.target.value })}
            placeholder="например: Разворот вне перекрёстка с прилегающей"
          />
        </div>

        <div className="editor-section">
          <label className="section-label">Заметки / Требования инспектора</label>
          <textarea
            rows={4}
            className="textarea-control"
            value={pin.note}
            onChange={(e) => onUpdatePin({ ...pin, note: e.target.value })}
            placeholder="Опишите знаки, видимость 100м, запреты, нюансы..."
          />
        </div>

        <div className="editor-section">
          <label className="section-label">Направление взгляда (Азимут)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(pin.heading)}
              onChange={(e) =>
                onUpdatePin({ ...pin, heading: Number(e.target.value) })
              }
              style={{ flex: 1, accentColor: 'var(--accent-blue)' }}
            />
            <span style={{ fontSize: 13, width: 40, textAlign: 'right' }}>
              {Math.round(pin.heading)}°
            </span>
          </div>
          <button
            onClick={() => onOpenPanorama(pin)}
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 6 }}
          >
            <Compass size={14} className="text-blue" />
            <span>Смотреть панораму и знаки в этой точке</span>
          </button>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <button
            onClick={() => onDeletePin(pin.id)}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-avoid)', width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={14} />
            <span>Удалить метку</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
