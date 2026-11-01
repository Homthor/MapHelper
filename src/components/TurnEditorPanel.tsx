import React from 'react';
import { Spline, Trash2, X } from 'lucide-react';
import { TurnKind, TurnStatus, TurnTrajectory } from '../types';

interface TurnEditorPanelProps {
  turn: TurnTrajectory;
  onUpdateTurn: (updated: TurnTrajectory) => void;
  onDeleteTurn: (turnId: string) => void;
  onClose: () => void;
}

export const TurnEditorPanel: React.FC<TurnEditorPanelProps> = ({
  turn,
  onUpdateTurn,
  onDeleteTurn,
  onClose,
}) => {
  return (
    <aside className="editor-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Spline size={18} className="text-blue" />
          <span>Траектория манёвра</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        <div className="editor-section">
          <label className="section-label">Тип манёвра</label>
          <select
            className="select-control"
            value={turn.kind}
            onChange={(e) =>
              onUpdateTurn({ ...turn, kind: e.target.value as TurnKind })
            }
          >
            <option value="uturn">↶ Разворот</option>
            <option value="left">↰ Поворот налево</option>
            <option value="right">↱ Поворот направо</option>
          </select>
        </div>

        <div className="editor-section">
          <label className="section-label">Статус манёвра для экзамена</label>
          <div className="status-buttons" style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn-status ${
                turn.status === 'best' ? 'active-best' : ''
              }`}
              onClick={() => onUpdateTurn({ ...turn, status: 'best' })}
            >
              🟢 Рекомендуется
            </button>
            <button
              className={`btn-status ${
                turn.status === 'caution' ? 'active-normal' : ''
              }`}
              onClick={() => onUpdateTurn({ ...turn, status: 'caution' })}
            >
              🟡 С осторожностью
            </button>
            <button
              className={`btn-status ${
                turn.status === 'forbidden' ? 'active-avoid' : ''
              }`}
              onClick={() => onUpdateTurn({ ...turn, status: 'forbidden' })}
            >
              🔴 Запрещено / Ошибка
            </button>
          </div>
        </div>

        <div className="editor-section">
          <label className="section-label">Название манёвра</label>
          <input
            type="text"
            className="input-text"
            value={turn.title}
            onChange={(e) => onUpdateTurn({ ...turn, title: e.target.value })}
            placeholder="например: Разворот на регулируемом перекрёстке"
          />
        </div>

        <div className="editor-section">
          <label className="section-label">Подробное описание / Траектория</label>
          <textarea
            rows={4}
            className="textarea-control"
            value={turn.note}
            onChange={(e) => onUpdateTurn({ ...turn, note: e.target.value })}
            placeholder="например: Выезжать на перекрёсток с левым поворотником, разворачиваться по дальнему радиусу, уступить встречным..."
          />
        </div>

        <div className="editor-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="section-label">Масштаб / Толщина линии и стрелки</label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
              {Math.round((turn.scale ?? 1) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.1}
            value={turn.scale ?? 1}
            onChange={(e) =>
              onUpdateTurn({ ...turn, scale: Number(e.target.value) })
            }
            style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
          />
        </div>

        <div className="editor-section">
          <span className="section-label">Перемещение на карте</span>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Перетаскивайте за 3 точки на карте (<b>Начало</b>, <b>Изгиб дуги</b>, <b>Конец</b>) или за центральный значок <b>✥</b>, чтобы сдвинуть весь разворот целиком.
          </p>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <button
            onClick={() => onDeleteTurn(turn.id)}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-avoid)', width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={14} />
            <span>Удалить траекторию манёвра</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
