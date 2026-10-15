/**
 * 시간별 예보 차트 렌더링 전용 모듈 (ui-forecast-chart.js)
 * 개발팀에서 차트 스크립트/라이브러리를 독립적으로 커스텀 및 수정할 수 있도록 분리된 파일입니다.
 */

/**
 * 차트 영역 좌표 및 데이터 컨텍스트 생성 함수
 * @param {HTMLElement} container - hourly-forecast-content 컨테이너
 * @returns {Object|null}
 */
export const buildChartContext = (container) => {
  const datesWrapper = container.querySelector('.nr__hourly-dates-wrapper');
  if (!datesWrapper) return null;

  const tempCols = datesWrapper.querySelectorAll('.nr__hourly-col:not(.nr__empty-col)');
  if (!tempCols.length) return null;

  const wrapperRect = datesWrapper.getBoundingClientRect();
  const width = Math.max(datesWrapper.scrollWidth, datesWrapper.offsetWidth);

  // 셀 레이아웃 구하기
  const firstTempCell = datesWrapper.querySelector('.nr__cell-temp-chart');
  const firstRainCell = datesWrapper.querySelector('.nr__cell-rain-chart');
  const firstWindCell = datesWrapper.querySelector('.nr__cell-wind-chart');
  const firstHumidityCell = datesWrapper.querySelector('.nr__cell-humidity-chart');

  const getCellLayout = (cellEl) => {
    if (!cellEl) return null;
    const r = cellEl.getBoundingClientRect();
    return {
      topOffset: r.top - wrapperRect.top,
      height: r.height
    };
  };

  const tempLayout = getCellLayout(firstTempCell);
  const rainLayout = getCellLayout(firstRainCell);
  const windLayout = getCellLayout(firstWindCell);
  const humidityLayout = getCellLayout(firstHumidityCell);

  const points = [];
  let minTemp = Infinity;
  let maxTemp = -Infinity;

  tempCols.forEach(col => {
    const colRect = col.getBoundingClientRect();
    const x = (colRect.left - wrapperRect.left) + (colRect.width / 2);

    const tempVal = parseFloat(col.dataset.temp);
    const rainProb = parseFloat(col.dataset.rainProb) || 0;
    const windDir = parseFloat(col.dataset.windDir) || 0;
    const windSpeed = parseFloat(col.dataset.windSpeed) || 0;
    const windStrength = col.dataset.windStrength || '약';
    const humidity = parseFloat(col.dataset.humidity) || 0;

    if (!isNaN(tempVal)) {
      if (tempVal < minTemp) minTemp = tempVal;
      if (tempVal > maxTemp) maxTemp = tempVal;
    }

    points.push({
      x,
      colEl: col,
      date: col.dataset.date,
      time: col.dataset.time,
      temp: isNaN(tempVal) ? 0 : tempVal,
      rainProb,
      windDir,
      windSpeed,
      windStrength,
      humidity
    });
  });

  if (minTemp === Infinity) minTemp = 0;
  if (maxTemp === -Infinity) maxTemp = 30;

  return {
    datesWrapper,
    width,
    tempLayout,
    rainLayout,
    windLayout,
    humidityLayout,
    points,
    minTemp,
    maxTemp
  };
};

/**
 * 1. 기온 선형 차트 렌더링 (SVG)
 */
export const defaultRenderTempChart = (layer, context) => {
  if (!layer || !context || !context.tempLayout) return;
  const { points, minTemp, maxTemp, width, tempLayout } = context;
  const height = tempLayout.height;
  if (!points || points.length === 0) return;

  const tempRange = (maxTemp - minTemp) || 1;
  const paddingTop = 32;
  const paddingBottom = 28;
  const usableHeight = Math.max(10, height - paddingTop - paddingBottom);

  const coords = points.map(pt => {
    const y = height - paddingBottom - ((pt.temp - minTemp) / tempRange) * usableHeight;
    return { ...pt, y };
  });

  let d = '';

  coords.forEach((pt, i) => {
    if (i === 0) {
      d += `M ${pt.x} ${pt.y}`;
    } else {
      d += ` L ${pt.x} ${pt.y}`;
    }
  });

  let svgHtml = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="${d}" fill="none" stroke="#0056BD" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  `;

  coords.forEach(pt => {
    svgHtml += `
      <g class="chart-point-group">
        <circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#ffffff" stroke="#0056BD" stroke-width="2" />
        <text x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--text-theme1)">${pt.temp}°C</text>
      </g>
    `;
  });

  svgHtml += `</svg>`;
  layer.innerHTML = svgHtml;
};

/**
 * 2. 강수확률 막대 차트 렌더링 (SVG)
 */
export const defaultRenderRainChart = (layer, context) => {
  if (!layer || !context || !context.rainLayout) return;
  const { points, width, rainLayout } = context;
  const height = rainLayout.height;
  if (!points || points.length === 0) return;

  const barWidth = 20; // 2rem (20px)
  const paddingTop = 26;
  const maxBarHeight = height - paddingTop;

  let svgHtml = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  `;

  points.forEach(pt => {
    const prob = Math.min(100, Math.max(0, pt.rainProb));
    const barH = (prob / 100) * maxBarHeight;
    const barX = pt.x - barWidth / 2;
    const barY = height - barH;

    if (prob > 0) {
      svgHtml += `
        <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="#8DC0FD" />
        <text x="${pt.x}" y="${barY - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#111111">${prob}%</text>
      `;
    } else {
      svgHtml += `
        <text x="${pt.x}" y="${height - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#111111">0%</text>
      `;
    }
  });

  svgHtml += `</svg>`;
  layer.innerHTML = svgHtml;
};

/**
 * 3. 풍향/풍속 차트 렌더링 (SVG 화살표, 풍속 선 그래프 & 텍스트)
 */
export const defaultRenderWindChart = (layer, context) => {
  if (!layer || !context || !context.windLayout) return;
  const { points, width, windLayout } = context;
  const height = windLayout.height;
  if (!points || points.length === 0) return;

  let minWind = 0;
  let maxWind = 6;
  points.forEach(pt => {
    if (pt.windSpeed > maxWind) maxWind = pt.windSpeed;
  });
  const windRange = (maxWind - minWind) || 1;
  const minY = 32; // 최고 풍속 위치
  const maxY = 48; // 최저 풍속 위치 (0m/s)

  const coords = points.map(pt => {
    const y = maxY - ((pt.windSpeed - minWind) / windRange) * (maxY - minY);
    return { ...pt, y };
  });

  let lineD = '';
  coords.forEach((pt, i) => {
    if (i === 0) lineD += `M ${pt.x} ${pt.y}`;
    else lineD += ` L ${pt.x} ${pt.y}`;
  });

  let svgHtml = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- 풍속 라인 차트 선 -->
      <path d="${lineD}" fill="none" stroke="#0088ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  `;

  coords.forEach(pt => {
    // 0.4rem (약 4px) 간격 계산
    // 포인트 원 반지름 3.5px
    const arrowY = pt.y - 14.5;    // 포인트 원 상단 4px 위 화살표
    const speedY = pt.y + 16.5;    // 포인트 원 하단 4px 아래 풍속 숫자
    const strengthY = pt.y + 29.5;  // 풍속 숫자 4px 아래 풍속 강도 텍스트

    svgHtml += `
      <g class="wind-item">
        <!-- 풍향 화살표 (포인트 원 0.4rem 위) -->
        <g transform="translate(${pt.x}, ${arrowY}) rotate(${pt.windDir})">
          <path d="M 0 -6 L 3 3.5 L 0 2 L -3 3.5 Z" fill="#111111" />
        </g>
        <!-- 풍속 차트 포인트 원 -->
        <circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#ffffff" stroke="#0088ff" stroke-width="2" />
        <!-- 풍속 숫자 (포인트 원 0.4rem 아래) -->
        <text x="${pt.x}" y="${speedY}" text-anchor="middle" font-size="12" font-weight="700" fill="#111111">${pt.windSpeed}</text>
        <!-- 풍속 강도 (숫자 0.4rem 아래) -->
        <text x="${pt.x}" y="${strengthY}" text-anchor="middle" font-size="11" font-weight="500" fill="#666666">${pt.windStrength}</text>
      </g>
    `;
  });

  svgHtml += `</svg>`;
  layer.innerHTML = svgHtml;
};

/**
 * 4. 습도 선형 차트 렌더링 (SVG)
 */
export const defaultRenderHumidityChart = (layer, context) => {
  if (!layer || !context || !context.humidityLayout) return;
  const { points, width, humidityLayout } = context;
  const height = humidityLayout.height;
  if (!points || points.length === 0) return;

  const paddingTop = 26;
  const paddingBottom = 16;
  const usableHeight = Math.max(10, height - paddingTop - paddingBottom);

  const coords = points.map(pt => {
    const prob = Math.min(100, Math.max(0, pt.humidity));
    const y = height - paddingBottom - (prob / 100) * usableHeight;
    return { ...pt, y, prob };
  });

  let d = '';
  let areaD = '';

  coords.forEach((pt, i) => {
    if (i === 0) {
      d += `M ${pt.x} ${pt.y}`;
      areaD += `M ${pt.x} ${height} L ${pt.x} ${pt.y}`;
    } else {
      d += ` L ${pt.x} ${pt.y}`;
      areaD += ` L ${pt.x} ${pt.y}`;
    }
  });

  if (coords.length > 0) {
    const lastPt = coords[coords.length - 1];
    const firstPt = coords[0];
    areaD += ` L ${lastPt.x} ${height} L ${firstPt.x} ${height} Z`;
  }

  let svgHtml = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="humidityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0288d1" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#0288d1" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#humidityGrad)" />
      <path d="${d}" fill="none" stroke="#0288d1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  `;

  coords.forEach(pt => {
    svgHtml += `
      <g class="chart-point-group">
        <circle cx="${pt.x}" cy="${pt.y}" r="3" fill="#ffffff" stroke="#0288d1" stroke-width="2" />
        <text x="${pt.x}" y="${pt.y - 7}" text-anchor="middle" font-size="11" font-weight="700" fill="#0288d1">${pt.prob}%</text>
      </g>
    `;
  });

  svgHtml += `</svg>`;
  layer.innerHTML = svgHtml;
};

/**
 * 통합 차트 렌더링 실행 함수
 * @param {HTMLElement} container
 * @param {Array} validDates
 * @param {Object} options
 */
export const renderAllForecastCharts = (container, validDates, options = {}) => {
  if (!container) return;
  const context = buildChartContext(container);
  if (!context) return;

  const tempLayer = container.querySelector('#hourly-temp-chart-layer');
  const rainLayer = container.querySelector('#hourly-rain-chart-layer');
  const windLayer = container.querySelector('#hourly-wind-chart-layer');
  const humidityLayer = container.querySelector('#hourly-humidity-chart-layer');

  const setupLayer = (layer, layout) => {
    if (!layer || !layout) return false;
    layer.style.top = `${layout.topOffset}px`;
    layer.style.height = `${layout.height}px`;
    layer.style.width = `${context.width}px`;
    layer.style.minWidth = `${context.width}px`;
    return true;
  };

  // 1. 기온 차트
  if (setupLayer(tempLayer, context.tempLayout)) {
    const fn = typeof options.renderTempChart === 'function' ? options.renderTempChart : (typeof window[options.renderTempChart] === 'function' ? window[options.renderTempChart] : defaultRenderTempChart);
    fn(tempLayer, context, validDates, options);
  }

  // 2. 강수확률 차트
  if (setupLayer(rainLayer, context.rainLayout)) {
    const fn = typeof options.renderRainChart === 'function' ? options.renderRainChart : (typeof window[options.renderRainChart] === 'function' ? window[options.renderRainChart] : defaultRenderRainChart);
    fn(rainLayer, context, validDates, options);
  }

  // 3. 풍향/풍속 차트
  if (setupLayer(windLayer, context.windLayout)) {
    const fn = typeof options.renderWindChart === 'function' ? options.renderWindChart : (typeof window[options.renderWindChart] === 'function' ? window[options.renderWindChart] : defaultRenderWindChart);
    fn(windLayer, context, validDates, options);
  }

  // 4. 습도 차트
  if (setupLayer(humidityLayer, context.humidityLayout)) {
    const fn = typeof options.renderHumidityChart === 'function' ? options.renderHumidityChart : (typeof window[options.renderHumidityChart] === 'function' ? window[options.renderHumidityChart] : defaultRenderHumidityChart);
    fn(humidityLayer, context, validDates, options);
  }
};
