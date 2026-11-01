import React from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Plus,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import { LaneConfig, LaneStatus, RoadSection, RoadStrip } from '../types';

interface RoadEditorPanelProps {
  strip: RoadStrip;
  sectionIndex: number;
  onUpdateStrip: (updated: RoadStrip) => void;
  onDeleteStrip: (stripId: string) => void;
  onSplitSection: (sectionIndex: number) => void;
  onClose: () => void;
}

export const RoadEditorPanel: React.FC<RoadEditorPanelProps> = ({
  strip,
  sectionIndex,
  onUpdateStrip,
  onDeleteStrip,
  onSplitSection,
  onClose,
}) => {
  const currentSection: RoadSection | undefined = strip.sections[sectionIndex];
  if (!currentSection) return null;

  const handleUpdateLaneStatus = (offsetIndex: number, status: LaneStatus) => {
    const updatedSections = [...strip.sections];
    const targetSection = { ...updatedSections[sectionIndex] };
    targetSection.lanes = targetSection.lanes.map((l) =>
      l.offsetIndex === offsetIndex ? { ...l, status } : l
    );
    updatedSections[sectionIndex] = targetSection;
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleAddLeftPocket = () => {
    const minOffset = Math.min(...currentSection.lanes.map((l) => l.offsetIndex));
    const newLane: LaneConfig = {
      offsetIndex: minOffset - 1,
      status: 'avoid',
      label: 'Карман слева',
    };
    const updatedSections = [...strip.sections];
    const targetSection = { ...updatedSections[sectionIndex] };
    targetSection.lanes = [newLane, ...targetSection.lanes];
    updatedSections[sectionIndex] = targetSection;
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleAddRightPocket = () => {
    const maxOffset = Math.max(...currentSection.lanes.map((l) => l.offsetIndex));
    const newLane: LaneConfig = {
      offsetIndex: maxOffset + 1,
      status: 'avoid',
      label: 'Карман справа',
    };
    const updatedSections = [...strip.sections];
    const targetSection = { ...updatedSections[sectionIndex] };
    targetSection.lanes = [...targetSection.lanes, newLane];
    updatedSections[sectionIndex] = targetSection;
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleRemoveLane = (offsetIndex: number) => {
    if (currentSection.lanes.length <= 1) return;
    const updatedSections = [...strip.sections];
    const targetSection = { ...updatedSections[sectionIndex] };
    targetSection.lanes = targetSection.lanes.filter(
      (l) => l.offsetIndex !== offsetIndex
    );
    // Also remove lane changes connected to this lane
    targetSection.laneChanges = targetSection.laneChanges.filter(
      (c) =>
        c.fromOffsetIndex !== offsetIndex && c.toOffsetIndex !== offsetIndex
    );
    updatedSections[sectionIndex] = targetSection;
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleAddLaneChange = () => {
    if (currentSection.lanes.length < 2) return;
    const fromOffset = currentSection.lanes[0].offsetIndex;
    const toOffset = currentSection.lanes[1].offsetIndex;
    const updatedSections = [...strip.sections];
    const targetSection = { ...updatedSections[sectionIndex] };
    targetSection.laneChanges = [
      ...targetSection.laneChanges,
      {
        id: crypto.randomUUID(),
        fromOffsetIndex: fromOffset,
        toOffsetIndex: toOffset,
        progress: 0.5,
      },
    ];
    updatedSections[sectionIndex] = targetSection;
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleRemoveLaneChange = (id: string) => {
    const updatedSections = [...strip.sections];
    const targetSection = { ...updatedSections[sectionIndex] };
    targetSection.laneChanges = targetSection.laneChanges.filter(
      (c) => c.id !== id
    );
    updatedSections[sectionIndex] = targetSection;
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleUpdateSectionNote = (note: string) => {
    const updatedSections = [...strip.sections];
    updatedSections[sectionIndex] = {
      ...updatedSections[sectionIndex],
      note,
    };
    onUpdateStrip({ ...strip, sections: updatedSections });
  };

  const handleUpdateStripName = (name: string) => {
    onUpdateStrip({ ...strip, name });
  };

  return (
    <aside className="editor-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <ArrowLeftRight size={18} className="text-blue" />
          <span>Секция дороги #{sectionIndex + 1}</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        {/* Strip general info */}
        <div className="editor-section">
          <label className="section-label">Название улицы / участка</label>
          <input
            type="text"
            className="input-text"
            value={strip.name}
            onChange={(e) => handleUpdateStripName(e.target.value)}
            placeholder="например: Рославльское шоссе (в центр)"
          />
        </div>

        {/* Scale / Lane Width & Opacity */}
        <div className="editor-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="section-label">Ширина полосы (Масштаб)</label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
              {strip.laneWidthMeters.toFixed(1)} м
            </span>
          </div>
          <input
            type="range"
            min={0.8}
            max={4.5}
            step={0.1}
            value={strip.laneWidthMeters}
            onChange={(e) =>
              onUpdateStrip({ ...strip, laneWidthMeters: Number(e.target.value) })
            }
            style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <label className="section-label">Прозрачность полос</label>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {Math.round((strip.opacity ?? 0.5) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.15}
            max={0.9}
            step={0.05}
            value={strip.opacity ?? 0.5}
            onChange={(e) =>
              onUpdateStrip({ ...strip, opacity: Number(e.target.value) })
            }
            style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            💡 На карте можно перетаскивать узловые точки дороги (белые кружки) или сдвинуть всю дорогу целиком за значок <b>✥</b> в центре.
          </p>
        </div>

        {/* Lane configuration */}
        <div className="editor-section">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="section-label">
              Полосы движения ({currentSection.lanes.length})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={handleAddLeftPocket}
                className="btn btn-secondary btn-sm"
                title="Добавить карман слева (для левого поворота)"
              >
                + Слева
              </button>
              <button
                onClick={handleAddRightPocket}
                className="btn btn-secondary btn-sm"
                title="Добавить карман справа (для выезда/разгона/автобусной)"
              >
                + Справа
              </button>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Полосы отсортированы слева направо по ходу движения. Выберите статус
            для каждой полосы:
          </p>

          <div className="lanes-list">
            {currentSection.lanes.map((lane, idx) => {
              const laneNum = idx + 1;
              return (
                <div
                  key={lane.offsetIndex}
                  className={`lane-row status-${lane.status}`}
                >
                  <div className="lane-info">
                    <span>
                      Полоса {laneNum}{' '}
                      {lane.label ? `(${lane.label})` : ''}
                    </span>
                  </div>

                  <div className="status-buttons">
                    <button
                      className={`btn-status ${
                        lane.status === 'best' ? 'active-best' : ''
                      }`}
                      onClick={() =>
                        handleUpdateLaneStatus(lane.offsetIndex, 'best')
                      }
                      title="🟢 Лучшая / Безопасная полоса для экзамена"
                    >
                      Лучшая
                    </button>
                    <button
                      className={`btn-status ${
                        lane.status === 'normal' ? 'active-normal' : ''
                      }`}
                      onClick={() =>
                        handleUpdateLaneStatus(lane.offsetIndex, 'normal')
                      }
                      title="🔵 Обычная / Допустимая полоса"
                    >
                      Обычная
                    </button>
                    <button
                      className={`btn-status ${
                        lane.status === 'avoid' ? 'active-avoid' : ''
                      }`}
                      onClick={() =>
                        handleUpdateLaneStatus(lane.offsetIndex, 'avoid')
                      }
                      title="🔴 Избегать (поворотная, ловушка, автобусная полоса)"
                    >
                      Избегать
                    </button>
                    {currentSection.lanes.length > 1 && (
                      <button
                        className="btn-icon btn-sm"
                        onClick={() => handleRemoveLane(lane.offsetIndex)}
                        title="Удалить эту полосу"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Split section */}
        <div className="editor-section">
          <span className="section-label">Разбиение участка</span>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Разделите этот участок пополам, чтобы настроить разное количество
            полос или статус до и после перекрёстка.
          </p>
          <button
            onClick={() => onSplitSection(sectionIndex)}
            className="btn btn-secondary btn-sm"
          >
            <Split size={14} />
            <span>Разбить секцию посередине</span>
          </button>
        </div>

        {/* Lane change arrows */}
        <div className="editor-section">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="section-label">Стрелки перестроения</span>
            <button
              onClick={handleAddLaneChange}
              disabled={currentSection.lanes.length < 2}
              className="btn btn-secondary btn-sm"
              title="Добавить подсказку 'Перестроиться здесь'"
            >
              <Plus size={14} />
              <span>Перестроение</span>
            </button>
          </div>

          {currentSection.laneChanges.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Нет стрелок перестроения на этом участке. Нажмите «+ Перестроение»,
              чтобы указать, где безопасно перестроиться.
            </p>
          ) : (
            <div className="changes-list">
              {currentSection.laneChanges.map((change, chIdx) => (
                <div key={change.id} className="change-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowRight size={13} className="text-blue" />
                    <span>
                      Полоса {currentSection.lanes.findIndex(l => l.offsetIndex === change.fromOffsetIndex) + 1}
                      {' → '}
                      Полоса {currentSection.lanes.findIndex(l => l.offsetIndex === change.toOffsetIndex) + 1}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      className="select-control"
                      style={{ padding: '2px 4px', fontSize: 11 }}
                      value={change.toOffsetIndex}
                      onChange={(e) => {
                        const newTo = Number(e.target.value);
                        const updatedSections = [...strip.sections];
                        const targetSection = { ...updatedSections[sectionIndex] };
                        targetSection.laneChanges = targetSection.laneChanges.map(
                          (c) => (c.id === change.id ? { ...c, toOffsetIndex: newTo } : c)
                        );
                        updatedSections[sectionIndex] = targetSection;
                        onUpdateStrip({ ...strip, sections: updatedSections });
                      }}
                    >
                      {currentSection.lanes.map((l, lIdx) => (
                        <option key={l.offsetIndex} value={l.offsetIndex}>
                          в пол. {lIdx + 1}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleRemoveLaneChange(change.id)}
                      className="btn-icon btn-sm"
                      title="Удалить стрелку"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section note */}
        <div className="editor-section">
          <label className="section-label">Заметка / Совет инструктора</label>
          <textarea
            rows={3}
            className="textarea-control"
            value={currentSection.note || ''}
            onChange={(e) => handleUpdateSectionNote(e.target.value)}
            placeholder="например: Заблаговременно занять средний ряд, так как правый заканчивается или уходит под стрелку..."
          />
        </div>

        {/* Delete strip button */}
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <button
            onClick={() => onDeleteStrip(strip.id)}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-avoid)', width: '100%', justifyContent: 'center' }}
          >
            <Trash2 size={14} />
            <span>Удалить всю улицу ({strip.points.length} точек)</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
