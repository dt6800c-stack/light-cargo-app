/**
 * 位置情報取得モジュール
 * Geolocation API + Nominatim逆ジオコーディング
 */
const Geo = (() => {
  'use strict';

  const OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000, // キャッシュ10秒（旧60秒→精度向上）
  };

  /**
   * 現在位置を取得し、住所に変換する
   * @returns {Promise<{latlng: string, address: string}>}
   */
  async function getCurrentPosition() {
    const coords = await getCoordinates();
    if (!coords.success) {
      return { latlng: '', address: coords.error };
    }

    const latlng = `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
    const address = await reverseGeocode(coords.lat, coords.lng);
    console.log(`[Geo] 精度: ${coords.accuracy}m, 座標: ${latlng}, 住所: ${address}`);
    return { latlng, address };
  }

  function getCoordinates() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ success: false, error: '位置情報非対応' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          success: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        }),
        (err) => {
          const msgs = {
            1: '位置情報: 許可なし',
            2: '位置情報: 取得不可',
            3: '位置情報: タイムアウト',
          };
          resolve({ success: false, error: msgs[err.code] || '位置情報: 取得失敗' });
        },
        OPTIONS
      );
    });
  }

  /**
   * Nominatim APIで逆ジオコーディング（座標→住所）
   */
  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja&zoom=16&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LightCargoApp/1.0' },
      });
      if (!res.ok) return `${lat.toFixed(4)},${lng.toFixed(4)}`;

      const data = await res.json();
      const a = data.address;
      if (a) {
        const state = a.state || a.province || '';
        const city = a.city || a.town || a.village || a.county || '';
        const suburb = a.suburb || a.neighbourhood || a.quarter || '';
        if (state && city) {
          return suburb ? `${state}${city}${suburb}` : `${state}${city}`;
        }
      }
      return data.display_name || `${lat.toFixed(4)},${lng.toFixed(4)}`;
    } catch (e) {
      console.warn('[Geo] 逆ジオコーディング失敗:', e);
      return `${lat.toFixed(4)},${lng.toFixed(4)}`;
    }
  }

  return { getCurrentPosition };
})();
