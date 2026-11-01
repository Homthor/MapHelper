import React from 'react';
import {
  Compass,
  Download,
  Eye,
  EyeOff,
  Highlighter,
  Layers,
  MapPin,
  MousePointer,
  Route,
  Settings,
  Spline,
  Upload,
} from 'lucide-react';
import { ActiveTool, BaseMapType, MapBookmark } from '../types';

interface ToolbarProps {
  cityName?: string;
  onOpenCityModal: () => void;
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  onImportOsmSigns?: () => void;
  baseMap: BaseMapType;
  onSelectBaseMap: (base: BaseMapType) => void;
  studyMode: boolean;
  onToggleStudyMode: () => void;
  bookmarks: MapBookmark[];
  onSelectBookmark: (bm: MapBookmark) => void;
  onAddBookmark: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onOpenSettings: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  cityName,
  onOpenCityModal,
  activeTool,
  onSelectTool,
  onImportOsmSigns,
  baseMap,
  onSelectBaseMap,
  studyMode,
  onToggleStudyMode,
  bookmarks,
  onSelectBookmark,
  onAddBookmark,
  onExportJson,
  onImportJson,
  onOpenSettings,
}) => {
  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <div className="toolbar-brand">
          <span>MapHelper</span>
          <button
            type="button"
            onClick={onOpenCityModal}
            className="brand-badge city-badge"
            title="Нажмите, чтобы выбрать или сменить город"
          >
            📍 {cityName || 'Выбрать город'}
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Editing Tools */}
        <button
          onClick={() => onSelectTool('select')}
          className={`btn btn-tool ${activeTool === 'select' ? 'active' : ''}`}
          title="Выбор и настройка объектов на карте (Esc)"
        >
          <MousePointer size={16} />
          <span>Выбор</span>
        </button>

        <button
          onClick={() => onSelectTool('draw_road')}
          className={`btn btn-tool ${activeTool === 'draw_road' ? 'active' : ''}`}
          title="Рисовать многополосный участок дороги"
        >
          <Route size={16} />
          <span>+ Дорога</span>
        </button>

        <button
          onClick={() => onSelectTool('draw_turn')}
          className={`btn btn-tool ${activeTool === 'draw_turn' ? 'active' : ''}`}
          title="Нарисовать траекторию поворота или разворота"
        >
          <Spline size={16} />
          <span>+ Разворот</span>
        </button>

        <button
          onClick={() => onSelectTool('draw_marker')}
          className={`btn btn-tool ${activeTool === 'draw_marker' ? 'active' : ''}`}
          title="Маркер-выделитель: рисовать полупрозрачной кистью или линией поверх карты"
        >
          <Highlighter size={16} />
          <span>+ Маркер</span>
        </button>

        <button
          onClick={() => onSelectTool('add_pin')}
          className={`btn btn-tool ${activeTool === 'add_pin' ? 'active' : ''}`}
          title="Поставить экзаменационную метку (знак, ловушка, остановка)"
        >
          <MapPin size={16} />
          <span>+ Метка</span>
        </button>

        {onImportOsmSigns && (
          <button
            onClick={onImportOsmSigns}
            className="btn btn-tool"
            title="Автоматически загрузить дорожные знаки (уступи дорогу, стоп, светофоры, камеры) из OpenStreetMap в видимой области"
          >
            <Download size={15} />
            <span>Знаки OSM</span>
          </button>
        )}

        <button
          onClick={() => onSelectTool('panorama')}
          className={`btn btn-tool ${activeTool === 'panorama' ? 'active' : ''}`}
          title="Кликните на дорогу, чтобы открыть уличную панораму и дорожные знаки"
        >
          <Compass size={16} />
          <span>Панорама</span>
        </button>
      </div>

      <div className="toolbar-group">
        {/* Study Mode: Toggle hints */}
        <button
          onClick={onToggleStudyMode}
          className={`btn btn-tool btn-study ${studyMode ? 'active' : ''}`}
          title={
            studyMode
              ? 'Режим самопроверки активен (подсказки скрыты). Нажмите для показа.'
              : 'Скрыть цвета лучших полос для проверки своей памяти'
          }
        >
          {studyMode ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{studyMode ? 'Самопроверка: ВКЛ' : 'Скрыть цвета'}</span>
        </button>

        <div className="toolbar-divider" />

        {/* Base Map Switcher */}
        <div className="toolbar-group" title="Слой карты">
          <Layers size={16} className="text-muted" />
          <select
            className="select-control"
            value={baseMap}
            onChange={(e) => onSelectBaseMap(e.target.value as BaseMapType)}
          >
            <option value="scheme">Яндекс Схема (разметка HD)</option>
            <option value="satellite">Яндекс Спутник</option>
            <option value="hybrid">Яндекс Гибрид</option>
          </select>
        </div>

        {/* Bookmarks */}
        <div className="toolbar-group" title="Быстрые закладки">
          <select
            className="select-control"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value === '__add__') {
                onAddBookmark();
              } else if (e.target.value) {
                const bm = bookmarks.find((b) => b.id === e.target.value);
                if (bm) onSelectBookmark(bm);
              }
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              📍 Закладки маршрутов...
            </option>
            {bookmarks.map((bm) => (
              <option key={bm.id} value={bm.id}>
                {bm.title}
              </option>
            ))}
            <option value="__add__">+ Сохранить текущий вид...</option>
          </select>
        </div>

        <div className="toolbar-divider" />

        {/* Export / Import / Settings */}
        <button
          onClick={onExportJson}
          className="btn btn-ghost btn-sm"
          title="Экспортировать карту в JSON файл"
        >
          <Download size={15} />
          <span>Экспорт</span>
        </button>

        <button
          onClick={onImportJson}
          className="btn btn-ghost btn-sm"
          title="Импортировать карту из JSON файла"
        >
          <Upload size={15} />
          <span>Импорт</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="btn btn-ghost btn-icon"
          title="Настройки (API-ключ Яндекса и очистка)"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
