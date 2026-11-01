import React, { useEffect, useRef, useState } from 'react';
import { Compass, ExternalLink, Key, X } from 'lucide-react';
import { LatLngPoint } from '../types';

interface PanoramaPanelProps {
  point: LatLngPoint;
  heading: number;
  onHeadingChange: (newHeading: number) => void;
  yandexApiKey?: string;
  onClose: () => void;
  onOpenSettings: () => void;
}

declare global {
  interface Window {
    ymaps?: any;
  }
}

export const PanoramaPanel: React.FC<PanoramaPanelProps> = ({
  point,
  heading,
  onHeadingChange,
  yandexApiKey,
  onClose,
  onOpenSettings,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const yandexPanoramaUrl = `https://yandex.ru/maps/?ll=${point.lng.toFixed(6)}%2C${point.lat.toFixed(
    6
  )}&z=19&l=stv%2Csta&panorama%5Bpoint%5D=${point.lng.toFixed(6)}%2C${point.lat.toFixed(
    6
  )}&panorama%5Bdirection%5D=${Math.round(heading)}%2C0&panorama%5Bspan%5D=90%2C45`;

  const yandexMirrorsUrl = `https://yandex.ru/maps/?ll=${point.lng.toFixed(6)}%2C${point.lat.toFixed(
    6
  )}&z=19&l=mrc`;

  const widgetIframeUrl = `https://yandex.ru/map-widget/v1/?ll=${point.lng.toFixed(
    6
  )}%2C${point.lat.toFixed(
    6
  )}&z=18&l=stv%2Csta&panorama%5Bpoint%5D=${point.lng.toFixed(6)}%2C${point.lat.toFixed(
    6
  )}&panorama%5Bdirection%5D=${Math.round(heading)}%2C0&panorama%5Bspan%5D=90%2C45`;

  useEffect(() => {
    const cleanKey = yandexApiKey?.trim();
    if (!cleanKey) {
      setApiStatus('idle');
      return;
    }

    let cancelled = false;
    setApiStatus('loading');

    const initPanorama = () => {
      if (cancelled || !window.ymaps) return;
      window.ymaps.ready(() => {
        if (cancelled) return;
        window.ymaps.panorama
          .locate([point.lat, point.lng])
          .done((panoramas: any[]) => {
            if (cancelled) return;
            if (!panoramas || panoramas.length === 0) {
              setApiStatus('empty');
              return;
            }
            if (playerInstanceRef.current) {
              try {
                playerInstanceRef.current.destroy();
              } catch {
                // ignore
              }
            }
            if (playerContainerRef.current) {
              playerContainerRef.current.innerHTML = '';
              playerInstanceRef.current = new window.ymaps.panorama.Player(
                playerContainerRef.current,
                panoramas[0],
                {
                  direction: [heading, 0],
                  Controls: ['zoomControl', 'fullscreenControl'],
                }
              );
              setApiStatus('ready');
            }
          })
          .fail((err: any) => {
            if (cancelled) return;
            setApiStatus('error');
            setErrorMsg(err?.message || 'Не удалось загрузить панораму через API.');
          });
      });
    };

    const existingScript = document.getElementById('ymaps-js-api-script') as HTMLScriptElement | null;
    if (window.ymaps) {
      initPanorama();
    } else {
      if (existingScript) {
        existingScript.remove();
      }
      const script = document.createElement('script');
      script.id = 'ymaps-js-api-script';
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(cleanKey)}&lang=ru_RU`;
      script.async = true;
      script.onload = initPanorama;
      script.onerror = () => {
        if (!cancelled) {
          setApiStatus('error');
          setErrorMsg('Ошибка загрузки скрипта Яндекс.Карт 2.1 (проверьте API-ключ).');
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [point.lat, point.lng, yandexApiKey]);

  useEffect(() => {
    if (playerInstanceRef.current && apiStatus === 'ready') {
      try {
        playerInstanceRef.current.setDirection([heading, 0]);
      } catch {
        // ignore
      }
    }
  }, [heading, apiStatus]);

  return (
    <div className="panorama-panel">
      <div className="panorama-header">
        <div className="panorama-title">
          <Compass size={18} className="text-blue" />
          <span>
            Уличная панорама и знаки ({point.lat.toFixed(5)}, {point.lng.toFixed(5)})
          </span>
        </div>

        <div className="panorama-controls">
          <label className="heading-control" title="Азимут (направление взгляда по дороге)">
            <span>Азимут: {Math.round(heading)}°</span>
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(heading)}
              onChange={(e) => onHeadingChange(Number(e.target.value))}
            />
          </label>

          <a
            href={yandexPanoramaUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-secondary"
            title="Открыть 360° Панораму в полной вкладке Яндекс Карт"
          >
            <ExternalLink size={14} />
            <span>Панорама 360°</span>
          </a>

          <a
            href={yandexMirrorsUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-primary"
            title="Открыть Яндекс Зеркала (свежие фото с видеорегистраторов для проверки новых знаков)"
          >
            <ExternalLink size={14} />
            <span>Яндекс Зеркала (свежие знаки)</span>
          </a>

          {!yandexApiKey?.trim() && (
            <button
              onClick={onOpenSettings}
              className="btn btn-sm btn-ghost"
              title="Указать бесплатный API-ключ Яндекса для прямого управления панорамой"
            >
              <Key size={14} />
              <span>API-ключ</span>
            </button>
          )}

          <button onClick={onClose} className="btn-icon" title="Закрыть панель панорамы">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="panorama-body">
        {yandexApiKey?.trim() ? (
          <>
            {apiStatus === 'loading' && (
              <div className="panorama-placeholder">Загрузка панорамы Яндекс API...</div>
            )}
            {apiStatus === 'empty' && (
              <div className="panorama-placeholder">
                В этой точке нет 360° панорамы Яндекса. Сдвиньте точку на проезжую часть или нажмите{' '}
                <a href={yandexMirrorsUrl} target="_blank" rel="noreferrer">
                  «Яндекс Зеркала»
                </a>
                .
              </div>
            )}
            {apiStatus === 'error' && (
              <div className="panorama-placeholder">
                <span>{errorMsg}</span>
                <iframe
                  title="Yandex Panorama Widget"
                  src={widgetIframeUrl}
                  className="panorama-iframe"
                  allowFullScreen
                />
              </div>
            )}
            <div
              ref={playerContainerRef}
              className="panorama-player"
              style={{ display: apiStatus === 'ready' ? 'block' : 'none' }}
            />
          </>
        ) : (
          <iframe
            key={`${point.lat.toFixed(5)}-${point.lng.toFixed(5)}-${Math.round(heading / 15)}`}
            title="Yandex Street View Widget"
            src={widgetIframeUrl}
            className="panorama-iframe"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
};
