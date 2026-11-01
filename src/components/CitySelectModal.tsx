import React, { useEffect, useState } from 'react';
import { Check, Loader2, MapPin, Search, X } from 'lucide-react';
import { LatLngPoint } from '../types';

interface CitySelectModalProps {
  currentCity?: string;
  onSelectCity: (cityName: string, center: LatLngPoint, zoom?: number) => void;
  onClose: () => void;
}

interface PopularCity {
  name: string;
  lat: number;
  lng: number;
  zoom?: number;
}

const POPULAR_CITIES: PopularCity[] = [
  { name: 'Москва', lat: 55.7558, lng: 37.6176, zoom: 14 },
  { name: 'Санкт-Петербург', lat: 59.9343, lng: 30.3351, zoom: 14 },
  { name: 'Новосибирск', lat: 55.0084, lng: 82.9357, zoom: 14 },
  { name: 'Екатеринбург', lat: 56.8389, lng: 60.6057, zoom: 14 },
  { name: 'Казань', lat: 55.7887, lng: 49.1221, zoom: 14 },
  { name: 'Нижний Новгород', lat: 56.2965, lng: 43.9361, zoom: 14 },
  { name: 'Челябинск', lat: 55.1644, lng: 61.4368, zoom: 14 },
  { name: 'Красноярск', lat: 56.0153, lng: 92.8932, zoom: 14 },
  { name: 'Самара', lat: 53.1959, lng: 50.1002, zoom: 14 },
  { name: 'Уфа', lat: 54.7388, lng: 55.9721, zoom: 14 },
  { name: 'Ростов-на-Дону', lat: 47.2357, lng: 39.7015, zoom: 14 },
  { name: 'Краснодар', lat: 45.0393, lng: 38.9872, zoom: 14 },
  { name: 'Воронеж', lat: 51.6615, lng: 39.2003, zoom: 14 },
  { name: 'Смоленск', lat: 54.7826, lng: 32.0453, zoom: 15 },
  { name: 'Минск', lat: 53.9006, lng: 27.559, zoom: 14 },
];

export const CitySelectModal: React.FC<CitySelectModalProps> = ({
  currentCity,
  onSelectCity,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ display_name: string; lat: string; lon: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search via OpenStreetMap Nominatim
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=6&addressdetails=1`;
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'ru',
          },
        });
        if (!res.ok) throw new Error('Ошибка связи с геокодером');
        const data = await res.json();
        setResults(data);
      } catch (err: any) {
        setError('Не удалось найти город. Проверьте интернет или выберите из списка.');
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (name: string, lat: number, lng: number, zoom: number = 15) => {
    onSelectCity(name, { lat, lng }, zoom);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} className="text-blue" />
            <span>Выбор города для работы с картой</span>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              <Search size={16} className="text-muted" />
              <input
                type="text"
                autoFocus
                placeholder="Введите ваш город (например: Казань, Тверь, Саратов)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  width: '100%',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              {loading && <Loader2 size={16} className="animate-spin text-blue" />}
              {query && !loading && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {results.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  maxHeight: 220,
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {results.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const cityName = item.name || item.display_name.split(',')[0];
                      handleSelect(cityName, parseFloat(item.lat), parseFloat(item.lon), 15);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: idx < results.length - 1 ? '1px solid var(--border-color)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <MapPin size={14} className="text-muted" />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.name || item.display_name.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.display_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-avoid)' }}>{error}</div>}
          </div>

          {/* Quick Popular Cities */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
              Быстрый выбор города:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {POPULAR_CITIES.map((c) => {
                const isSelected = currentCity === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelect(c.name, c.lat, c.lng, c.zoom ?? 14)}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isSelected && <Check size={12} />}
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
