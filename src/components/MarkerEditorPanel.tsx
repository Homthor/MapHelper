import React from 'react';
import { Highlighter, Trash2, X } from 'lucide-react';
import { MarkerStroke } from '../types';

export const MARKER_COLOR_PALETTE = [
  { color: '#10b981', label: 'Зелёный (Разрешено / Ориентир)' },
  { color: '#f59e0b', label: 'Жёлтый (Внимание)' },
  { color: '#ef4444', label: 'Красный (Запрет / Опасность)' },
  { color: '#3b82f6', label: 'Синий (Траектория / Полоса)' },
  { color: '#a855f7', label: 'Фиолетовый (Особая зона)' },
  { color: '#ffffff', label: 'Белый (Разметка)' },
];

interface MarkerEditorPanelProps {
  marker: MarkerStroke;
  onUpdateMarker: (updated: MarkerStroke) => void;
  onDeleteMarker: (markerId: string) => void;
  onClose: () => void;
}

export const MarkerEditorPanel: React.FC<MarkerEditorPanelProps> = ({
  marker,
  onUpdateMarker,
  onDeleteMarker,
  onClose,
}) => {
  return (
    <aside className="editor-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Highlighter size={18} className="text-blue" />
          <span>Маркер-выделитель</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        {/* Color Picker */}
        <div className="editor-section">
          <label className="section-label">Цвет маркера</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {MARKER_COLOR_PALETTE.map((item) => (
              <button
                key={item.color}
                type="button"
                onClick={() => onUpdateMarker({ ...marker, color: item.color })}
                title={item.label}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  border:
                    marker.color === item.color
                      ? '3px solid #ffffff'
                      : '2px solid rgba(255,255,255,0.25)',
                  boxShadow:
                    marker.color === item.color
                      ? `0 0 10px ${item.color}`
                      : 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        {/* Width / Scale */}
        <div className="editor-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="section-label">Толщина / Масштаб линии</label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
              {marker.width} px
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={36}
            step={1}
            value={marker.width}
            onChange={(e) =>
              onUpdateMarker({ ...marker, width: Number(e.target.value) })
            }
            style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <label className="section-label">Прозрачность маркера</label>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {Math.round(marker.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.15}
            max={0.95}
            step={0.05}
            value={marker.opacity}
            onChange={(e) =>
              onUpdateMarker({ ...marker, opacity: Number(e.target.value) })
            }
            style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
          />
        </div>

        {/* Options: Dashed & Arrow End */}
        <div className="editor-section">
          <label className="section-label">Оформление линии</label>
          <label className="layer-item" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={Boolean(marker.dashed)}
              onChange={(e) =>
                onUpdateMarker({ ...marker, dashed: e.target.checked })
              }
            />
            <span>Пунктирная линия</span>
          </label>
          <label className="layer-item" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={Boolean(marker.arrowEnd)}
              onChange={(e) =>
                onUpdateMarker({ ...marker, arrowEnd: e.target.checked })
              }
            />
            <span>Показывать стрелку направления на конце</span>
          </label>
        </div>

        {/* Title & Note */}
        <div className="editor-section">
          <label className="section-label">Подпись (при наведении)</label>
          <input
            type="text"
            className="input-text"
            value={marker.title || ''}
            onChange={(e) => onUpdateMarker({ ...marker, title: e.target.value })}
            placeholder="например: Сплошная перед пешеходным переходом"
          />
        </div>

        <div className="editor-section">
          <label className="section-label">Заметка</label>
          <textarea
            rows={3}
            className="textarea-control"
            value={marker.note || ''}
            onChange={(e) => onUpdateMarker({ ...marker, note: e.target.value })}
            placeholder="Комментарий к выделенному участку..."
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            💡 На карте можно перетащить всю линию маркера за центральный значок <b>✥</b> или подправить её крайние точки.
          </p>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <button
            onClick={() => onDeleteMarker(marker.id)}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-avoid)', width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={14} />
            <span>Удалить линию маркера</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
