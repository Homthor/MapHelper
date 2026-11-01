import React, { useState } from 'react';
import { ExternalLink, Key, RotateCcw, X } from 'lucide-react';

interface SettingsModalProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onResetData: () => void;
  onLoadSmolenskDemo?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  onSaveApiKey,
  onResetData,
  onLoadSmolenskDemo,
  onClose,
}) => {
  const [tempKey, setTempKey] = useState(apiKey || '');

  const handleSave = () => {
    onSaveApiKey(tempKey.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} className="text-blue" />
            <span>Настройки и ключ Яндекс JS API 3.0 (Разметка дорог)</span>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div>
            <strong>1. Ваш бесплатный ключ «JavaScript API и HTTP Геокодер»</strong>
            <p style={{ marginTop: 4 }}>
              С этим ключом в MapHelper включается векторный движок{' '}
              <strong>Яндекс Карты 3.0 (vmap3)</strong> — точно с такой же{' '}
              <strong>детализированной дорожной разметкой</strong> (полосы, сплошные,
              стрелки на асфальте, переходы), как на самом сайте Яндекс Карт, а также
              интерактивные 360° Панорамы.
            </p>
            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                className="input-text"
                placeholder="Вставьте ваш API-ключ (например: a1b2c3d4-e5f6-...)"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <strong>2. Что указать в поле «Ограничение по HTTP Referer» в кабинете Яндекса:</strong>
            <p style={{ marginTop: 4 }}>
              Для работы JavaScript API 3.0 Яндекс требует заполнить поле{' '}
              <em>«Ограничение по HTTP Referer»</em> в настройках ключа на{' '}
              <a
                href="https://developer.tech.yandex.ru/services/3"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-blue)' }}
              >
                developer.tech.yandex.ru <ExternalLink size={11} />
              </a>
              . Укажите там просто одно слово:
            </p>
            <div
              style={{
                marginTop: 8,
                padding: '6px 10px',
                background: 'var(--bg-primary)',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#fff',
                userSelect: 'all',
              }}
            >
              localhost
            </div>
            <p style={{ marginTop: 6, fontSize: 11 }}>
              ⚠️ <em>Примечание:</em> после сохранения настроек ключа в кабинете Яндекса он
              активируется на серверах API 3.0 в течение <strong>5–15 минут</strong>.
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
            <strong>Управление данными карты</strong>
            <p style={{ marginTop: 4, marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>
              Вы можете полностью очистить нарисованные элементы карты или загрузить готовый демо-маршрут для ознакомления.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (window.confirm('Очистить все добавленные дороги, развороты, маркеры и метки?')) {
                    onResetData();
                    onClose();
                  }
                }}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--color-avoid)' }}
                title="Очистить все объекты, оставив город и ключ"
              >
                <RotateCcw size={14} />
                <span>Очистить все объекты на карте</span>
              </button>

              {onLoadSmolenskDemo && (
                <button
                  onClick={() => {
                    if (window.confirm('Загрузить готовый пример экзаменационного маршрута Смоленска (Тихвинка)? Текущие несохранённые объекты будут заменены.')) {
                      onLoadSmolenskDemo();
                      onClose();
                    }
                  }}
                  className="btn btn-secondary btn-sm"
                  title="Загрузить пример разметки и разворотов (МРЭО ГИБДД Смоленск)"
                >
                  <span>📋 Загрузить демо-маршрут (Смоленск)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Отмена
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Сохранить ключ
          </button>
        </div>
      </div>
    </div>
  );
};
