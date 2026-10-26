/**
 * 시간별 예보 차트 렌더링 전용 모듈 (ui-forecast-chart.js)
 * 개발팀에서 차트 스크립트/라이브러리를 독립적으로 커스텀 및 수정할 수 있도록 분리된 파일입니다.
 */

/**
 * 차트 영역 좌표 및 데이터 컨텍스트 생성 함수
 * @param {HTMLElement} container - hourly-forecast-content 컨테이너
 * @returns {Object|null}
 */
export const buildChartContext = (container, validDates = []) => {
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
		const sensoryTempVal = parseFloat(col.dataset.sensoryTemp);
		const rainProb = parseFloat(col.dataset.rainProb) || 0;
		const windDir = parseFloat(col.dataset.windDir) || 0;
		const windSpeed = parseFloat(col.dataset.windSpeed) || 0;
		const windStrength = col.dataset.windStrength || '약';
		const humidity = parseFloat(col.dataset.humidity) || 0;
		const isMin = (col.dataset.isMin === 'true');
		const minVal = col.dataset.minVal ? parseFloat(col.dataset.minVal) : undefined;
		const isMax = (col.dataset.isMax === 'true');
		const maxVal = col.dataset.maxVal ? parseFloat(col.dataset.maxVal) : undefined;

		if (!isNaN(tempVal)) {
			if (tempVal < minTemp) minTemp = tempVal;
			if (tempVal > maxTemp) maxTemp = tempVal;
		}
		if (!isNaN(sensoryTempVal)) {
			if (sensoryTempVal < minTemp) minTemp = sensoryTempVal;
			if (sensoryTempVal > maxTemp) maxTemp = sensoryTempVal;
		}
		if (minVal !== undefined && !isNaN(minVal)) {
			if (minVal < minTemp) minTemp = minVal;
		}
		if (maxVal !== undefined && !isNaN(maxVal)) {
			if (maxVal > maxTemp) maxTemp = maxVal;
		}

		const p10 = col.dataset.p10;
		const p25 = col.dataset.p25;
		const p75 = col.dataset.p75;
		const p90 = col.dataset.p90;
		const percentiles = (p10 || p90) ? { p10, p25, p75, p90 } : null;

		points.push({
			x,
			colEl: col,
			date: col.dataset.date,
			time: col.dataset.time,
			temp: isNaN(tempVal) ? 0 : tempVal,
			sensoryTemp: isNaN(sensoryTempVal) ? (isNaN(tempVal) ? 0 : tempVal) : sensoryTempVal,
			rainProb,
			windDir,
			windSpeed,
			windStrength,
			humidity,
			isMin,
			minVal,
			isMax,
			maxVal,
			percentiles
		});
	});

  if (minTemp === Infinity) minTemp = 0;
  if (maxTemp === -Infinity) maxTemp = 30;

  // 일별 최저/최고 기온 및 분위수 데이터 수집
  const dailyPoints = [];
  const dateGroups = datesWrapper.querySelectorAll('.nr__date-group');
  let minDailyTemp = Infinity;
  let maxDailyTemp = -Infinity;

  dateGroups.forEach(group => {
    const date = group.dataset.date;
    const groupRect = group.getBoundingClientRect();
    const cols = group.querySelectorAll('.nr__hourly-col:not(.nr__empty-col)');

    const dayItem = validDates ? validDates.find(d => d.date === date) : null;
    let maxT = dayItem && dayItem.maxTemp ? parseFloat(dayItem.maxTemp) : -Infinity;
    let minT = dayItem && dayItem.minTemp ? parseFloat(dayItem.minTemp) : Infinity;

    let maxCol = null;
    let minCol = null;
    let colMax = -Infinity;
    let colMin = Infinity;

    cols.forEach(col => {
      const t = parseFloat(col.dataset.temp);
      if (!isNaN(t)) {
        if (t > colMax) {
          colMax = t;
          maxCol = col;
        }
        if (t < colMin) {
          colMin = t;
          minCol = col;
        }
      }
    });

    if (maxT === -Infinity) maxT = (colMax !== -Infinity) ? colMax : 25;
    if (minT === Infinity) minT = (colMin !== Infinity) ? colMin : 15;

    const groupCenterX = (groupRect.left - wrapperRect.left) + (groupRect.width / 2);
    let maxX = groupCenterX;
    let minX = groupCenterX;

    if (maxCol) {
      const r = maxCol.getBoundingClientRect();
      maxX = (r.left - wrapperRect.left) + (r.width / 2);
    }
    if (minCol) {
      const r = minCol.getBoundingClientRect();
      minX = (r.left - wrapperRect.left) + (r.width / 2);
    }

    const pData = dayItem?.percentiles;
    const parseOrCalc = (val, fallback) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const num = parseFloat(val);
        if (!isNaN(num)) return num;
      }
      return fallback;
    };

    const maxP90 = parseOrCalc(pData?.max?.p90, +(maxT + 3.2).toFixed(1));
    const maxP75 = parseOrCalc(pData?.max?.p75, +(maxT + 1.6).toFixed(1));
    const maxP25 = parseOrCalc(pData?.max?.p25, +(maxT - 1.6).toFixed(1));
    const maxP10 = parseOrCalc(pData?.max?.p10, +(maxT - 3.2).toFixed(1));

    const minP10 = parseOrCalc(pData?.min?.p10, +(minT - 3.2).toFixed(1));
    const minP25 = parseOrCalc(pData?.min?.p25, +(minT - 1.6).toFixed(1));
    const minP75 = parseOrCalc(pData?.min?.p75, +(minT + 1.6).toFixed(1));
    const minP90 = parseOrCalc(pData?.min?.p90, +(minT + 3.2).toFixed(1));

    if (minP10 < minDailyTemp) minDailyTemp = minP10;
    if (maxP90 > maxDailyTemp) maxDailyTemp = maxP90;

    dailyPoints.push({
      date,
      dayItem,
      maxX,
      minX,
      groupCenterX,
      maxTemp: maxT,
      minTemp: minT,
      percentiles: {
        max: { p90: maxP90, p75: maxP75, p25: maxP25, p10: maxP10 },
        min: { p10: minP10, p25: minP25, p75: minP75, p90: minP90 }
      }
    });
  });

  if (minDailyTemp === Infinity) minDailyTemp = 10;
  if (maxDailyTemp === -Infinity) maxDailyTemp = 32;

  // 밴드가 위아래로 넓게 펼쳐질 수 있도록 상하 여유 마진 추가
  minDailyTemp = Math.floor(minDailyTemp - 1.5);
  maxDailyTemp = Math.ceil(maxDailyTemp + 1.5);

  // 평균기온과 최저/최고기온의 Y축 기온 스케일(높이 기준)을 통합/동기화
  // 이를 통해 동일한 기온(예: 30°C)이 두 모드 간 전환 시 항상 일치하는 수직 위치에 렌더링됨
  const unifiedMinTemp = Math.min(minTemp, minDailyTemp);
  const unifiedMaxTemp = Math.max(maxTemp, maxDailyTemp);

  return {
    datesWrapper,
    width,
    tempLayout,
    rainLayout,
    windLayout,
    humidityLayout,
    points,
    minTemp,
    maxTemp,
    dailyPoints,
    minDailyTemp,
    maxDailyTemp,
    unifiedMinTemp,
    unifiedMaxTemp
  };
};

/**
 * 1-1. 단기예보: 기온 & 체감온도 복합 선형 차트 렌더링 (SVG)
 * - 기온(실선) + 체감온도(점선)
 * - 두 개의 차트가 동일한 값이면 기온이 상위에 값 표시, 체감은 하위에 표시
 * - 값이 다른 경우 높은 기온의 수치가 위에 표시
 */
export const defaultRenderTempChart = (layer, context, validDates = [], options = {}) => {
	if (!layer || !context || !context.tempLayout) return;
	const { points, minTemp, maxTemp, width, tempLayout, datesWrapper } = context;
	const height = tempLayout.height;
	if (!points || points.length === 0) return;

	// 중기예보 팝업 레이어 숨김
	const midPopups = datesWrapper?.querySelectorAll('.nr__mid-twin-tooltip, .nr__mid-hover-layer');
	midPopups?.forEach(el => el.remove());

	const existingTooltip = datesWrapper?.querySelector('.nr__forecast-tooltip');
	if (existingTooltip) {
		existingTooltip.classList.remove('show');
	}

	const isSingleTempLine = (options.isSingleTempLine === true);

	const scaleMin = minTemp - 2;
	const scaleMax = maxTemp + 2;
	const tempRange = (scaleMax - scaleMin) || 1;
	const paddingTop = 36;
	const paddingBottom = 32;
	const usableHeight = Math.max(10, height - paddingTop - paddingBottom);

	const coords = points.map(pt => {
		const tempY = height - paddingBottom - ((pt.temp - scaleMin) / tempRange) * usableHeight;
		const sensoryY = height - paddingBottom - ((pt.sensoryTemp - scaleMin) / tempRange) * usableHeight;
		return { ...pt, tempY, sensoryY };
	});

	let tempD = '';
	let sensoryD = '';

	coords.forEach((pt, i) => {
		if (i === 0) {
			tempD += `M ${pt.x} ${pt.tempY}`;
			sensoryD += `M ${pt.x} ${pt.sensoryY}`;
		} else {
			tempD += ` L ${pt.x} ${pt.tempY}`;
			sensoryD += ` L ${pt.x} ${pt.sensoryY}`;
		}
	});

	let svgHtml = `
		<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
	`;

	if (!isSingleTempLine) {
		svgHtml += `
			<!-- 체감온도 점선 (선형 차트 모드일 때만 표시) -->
			<path d="${sensoryD}" fill="none" stroke="var(--nr-fc-sensory-line, #737b8b)" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round" />
		`;
	}

	svgHtml += `
			<!-- 기온 실선 -->
			<path d="${tempD}" fill="none" stroke="var(--nr-fc-temp-line, #20639b)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
	`;

	coords.forEach(pt => {
		if (isSingleTempLine) {
			// 막대그래프 모드: 기온 그래프 하나만 표시 (이미지 4 참고)
			svgHtml += `
				<g class="chart-point-group">
					<circle cx="${pt.x}" cy="${pt.tempY}" r="3.5" fill="var(--nr-fc-bg-card, #ffffff)" stroke="var(--nr-fc-temp-line, #20639b)" stroke-width="2" />
					<text x="${pt.x}" y="${pt.tempY - 9}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--nr-fc-text-primary, #111111)">${pt.temp}°C</text>
				</g>
			`;
		} else {
			// 선형 차트 모드: 기온 & 체감온도 복합 표시
			// 마커와 텍스트 간격 0.4rem(4px) 적용 (기온 r=5+stroke=1 -> 외경 6px, 체감 r=4+stroke=1 -> 외경 5px)
			let tempLabelY, sensoryLabelY;
			if (pt.temp > pt.sensoryTemp) {
				tempLabelY = pt.tempY - 10;
				sensoryLabelY = pt.sensoryY + 19;
			} else if (pt.temp < pt.sensoryTemp) {
				sensoryLabelY = pt.sensoryY - 9;
				tempLabelY = pt.tempY + 21;
			} else {
				// 동일한 값: 기온 상위, 체감 하위
				tempLabelY = pt.tempY - 10;
				sensoryLabelY = pt.sensoryY + 19;
			}

			svgHtml += `
				<g class="chart-point-group">
					<!-- 체감온도 마커 (회색 빈 원) -->
					<circle cx="${pt.x}" cy="${pt.sensoryY}" r="4" fill="var(--nr-fc-bg-card, #ffffff)" stroke="var(--nr-fc-sensory-line, #8E8E8E)" stroke-width="2" />
					<!-- 체감온도 텍스트 -->
					<text x="${pt.x}" y="${sensoryLabelY}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--nr-fc-text-muted, #727272)">${pt.sensoryTemp}°C</text>
					<!-- 기온 마커 (파란색 채워진 원) -->
					<circle cx="${pt.x}" cy="${pt.tempY}" r="5" fill="var(--nr-fc-bg-card, #ffffff)" stroke="var(--nr-fc-temp-line, #003763)" stroke-width="2" />
					<!-- 기온 텍스트 -->
					<text x="${pt.x}" y="${tempLabelY}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--nr-fc-text-primary, #000000)">${pt.temp}°C</text>
				</g>
			`;
		}
	});

	svgHtml += `</svg>`;
	layer.innerHTML = svgHtml;
};

/**
 * 1-2. 중기예보: 기온 선형 차트 & 분위수 밴드 & 극값 마커 및 마우스오버 레이어 렌더링 (SVG & HTML)
 * - 포인트 마우스오버 시 해당 포인트의 레이어 표출:
 *   - 일반 포인트: [기온] 레이어 (#5b7083)
 *   - 최고기온 포인트: [최고기온] 레이어 (#EB3B2E)
 *   - 최저기온 포인트: [최저기온] 레이어 (#0088FF)
 */
export const renderMidtermTempChart = (layer, context, validDates = [], options = {}) => {
	if (!layer || !context || !context.tempLayout) return;
	const { points, width, tempLayout, datesWrapper } = context;
	const height = tempLayout.height;
	if (!points || points.length === 0) return;

	// 기존 단일 툴팁 및 중기예보 팝업 레이어 정리
	const oldTooltip = datesWrapper?.querySelector('.nr__forecast-tooltip');
	if (oldTooltip) oldTooltip.style.display = 'none';

	const existingPopups = datesWrapper?.querySelectorAll('.nr__mid-twin-tooltip, .nr__mid-hover-layer');
	existingPopups?.forEach(el => el.remove());

	const parseTemp = (val, fallback = 0) => {
		if (typeof val === 'number') return val;
		if (typeof val === 'string') {
			const n = parseFloat(val);
			if (!isNaN(n)) return n;
		}
		return fallback;
	};

	// 기온 스케일 계산
	let minT = Infinity;
	let maxT = -Infinity;
	points.forEach(pt => {
		if (pt.temp < minT) minT = pt.temp;
		if (pt.temp > maxT) maxT = pt.temp;
		if (pt.minVal !== undefined && pt.minVal < minT) minT = pt.minVal;
		if (pt.maxVal !== undefined && pt.maxVal > maxT) maxT = pt.maxVal;
		if (pt.percentiles?.p10) {
			const p10Val = parseTemp(pt.percentiles.p10, pt.temp);
			if (p10Val < minT) minT = p10Val;
		}
		if (pt.percentiles?.p90) {
			const p90Val = parseTemp(pt.percentiles.p90, pt.temp);
			if (p90Val > maxT) maxT = p90Val;
		}
	});

	if (minT === Infinity) minT = 8;
	if (maxT === -Infinity) maxT = 31;

	minT = Math.floor(minT - 3);
	maxT = Math.ceil(maxT + 4);
	const tempRange = (maxT - minT) || 1;

	const paddingTop = 44;
	const paddingBottom = 42;
	const usableHeight = Math.max(10, height - paddingTop - paddingBottom);

	const getY = (val) => {
		return height - paddingBottom - ((val - minT) / tempRange) * usableHeight;
	};

	const coords = points.map(pt => {
		const y = getY(pt.temp);
		const p90Val = pt.percentiles?.p90 ? parseTemp(pt.percentiles.p90, pt.temp + 3) : (pt.temp + 3);
		const p75Val = pt.percentiles?.p75 ? parseTemp(pt.percentiles.p75, pt.temp + 1.5) : (pt.temp + 1.5);
		const p25Val = pt.percentiles?.p25 ? parseTemp(pt.percentiles.p25, pt.temp - 1.5) : (pt.temp - 1.5);
		const p10Val = pt.percentiles?.p10 ? parseTemp(pt.percentiles.p10, pt.temp - 3) : (pt.temp - 3);

		const y90 = getY(p90Val);
		const y75 = getY(p75Val);
		const y25 = getY(p25Val);
		const y10 = getY(p10Val);

		return { ...pt, y, y90, y75, y25, y10 };
	});

	// 꺾은선 패스
	let lineD = '';
	coords.forEach((pt, i) => {
		if (i === 0) lineD += `M ${pt.x} ${pt.y}`;
		else lineD += ` L ${pt.x} ${pt.y}`;
	});

	// 분위수 밴드 영역 생성 (시간별 고유 분위수 반영)
	let band1090Top = '';
	let band1090Bot = '';
	let band2575Top = '';
	let band2575Bot = '';

	coords.forEach((pt, i) => {
		if (i === 0) {
			band1090Top += `M ${pt.x} ${pt.y90}`;
			band2575Top += `M ${pt.x} ${pt.y75}`;
		} else {
			band1090Top += ` L ${pt.x} ${pt.y90}`;
			band2575Top += ` L ${pt.x} ${pt.y75}`;
		}
	});

	for (let i = coords.length - 1; i >= 0; i--) {
		const pt = coords[i];
		band1090Bot += ` L ${pt.x} ${pt.y10}`;
		band2575Bot += ` L ${pt.x} ${pt.y25}`;
	}

	const band1090Path = band1090Top + band1090Bot + ' Z';
	const band2575Path = band2575Top + band2575Bot + ' Z';

	let svgHtml = `
		<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
			<!-- 분위수 배경 밴드 -->
			<path d="${band1090Path}" fill="var(--nr-fc-temp-line, #003763)" fill-opacity="var(--nr-fc-band-opacity-outer, 0.06)" stroke="none" />
			<path d="${band2575Path}" fill="var(--nr-fc-temp-line, #003763)" fill-opacity="var(--nr-fc-band-opacity-inner, 0.16)" stroke="none" />

			<!-- 기온 꺾은선 -->
			<path d="${lineD}" fill="none" stroke="var(--nr-fc-temp-line, #003763)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
	`;

	coords.forEach((pt, i) => {
		if (pt.isMax) {
			// 최고기온 포인트: 라인은 큰 분위수 밴드(y90~y10), 마커는 작은 분위수 밴드(y75~y25)
			svgHtml += `
				<g class="chart-point-group point-max" data-index="${i}" data-time="${pt.time}">
					<line x1="${pt.x}" y1="${pt.y90}" x2="${pt.x}" y2="${pt.y10}" stroke="var(--nr-fc-temp-max-alt, #E83828)" stroke-width="2.2" stroke-linecap="round" />
					<rect x="${pt.x - 4}" y="${pt.y75}" width="8" height="${pt.y25 - pt.y75}" fill="var(--nr-fc-temp-max-alt, #E83828)" rx="1" />
					<text x="${pt.x}" y="${pt.y90 - 6}" text-anchor="middle" font-size="13" font-weight="800" fill="var(--nr-fc-temp-max-alt, #E83828)">${pt.maxVal !== undefined ? pt.maxVal : pt.temp}°C</text>
					<text x="${pt.x}" y="${pt.y10 + 16}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--nr-fc-text-primary, #111111)">${pt.temp}°C</text>
					<circle cx="${pt.x}" cy="${pt.y}" r="16" fill="transparent" pointer-events="all" class="point-hit-target" style="cursor: pointer;" />
				</g>
			`;
		} else if (pt.isMin) {
			// 최저기온 포인트: 라인은 큰 분위수 밴드(y90~y10), 마커는 작은 분위수 밴드(y75~y25)
			svgHtml += `
				<g class="chart-point-group point-min" data-index="${i}" data-time="${pt.time}">
					<line x1="${pt.x}" y1="${pt.y90}" x2="${pt.x}" y2="${pt.y10}" stroke="var(--nr-fc-temp-min-alt, #009AE1)" stroke-width="2.2" stroke-linecap="round" />
					<rect x="${pt.x - 4}" y="${pt.y75}" width="8" height="${pt.y25 - pt.y75}" fill="var(--nr-fc-temp-min-alt, #009AE1)" rx="1" />
					<text x="${pt.x}" y="${pt.y90 - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--nr-fc-text-primary, #111111)">${pt.temp}°C</text>
					<text x="${pt.x}" y="${pt.y10 + 16}" text-anchor="middle" font-size="13" font-weight="800" fill="var(--nr-fc-temp-min-alt, #009AE1)">${pt.minVal !== undefined ? pt.minVal : pt.temp}°C</text>
					<circle cx="${pt.x}" cy="${pt.y}" r="16" fill="transparent" pointer-events="all" class="point-hit-target" style="cursor: pointer;" />
				</g>
			`;
		} else {
			// 일반 기온 포인트: 원 마커, 기온 텍스트
			svgHtml += `
				<g class="chart-point-group point-normal" data-index="${i}" data-time="${pt.time}">
					<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="var(--nr-fc-temp-line, #003763)" />
					<text x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--nr-fc-text-primary, #111111)">${pt.temp}°C</text>
					<circle cx="${pt.x}" cy="${pt.y}" r="14" fill="transparent" pointer-events="all" class="point-hit-target" style="cursor: pointer;" />
				</g>
			`;
		}
	});

	svgHtml += `</svg>`;
	layer.innerHTML = svgHtml;

	// 마우스오버 레이어 컨테이너 생성 및 datesWrapper에 삽입
	const hoverLayer = document.createElement('div');
	hoverLayer.className = 'nr__mid-hover-layer';
	hoverLayer.style.display = 'none';
	datesWrapper.appendChild(hoverLayer);

	let hideTimeout = null;

	const getPercentilesData = (pt, type, dayItem) => {
		if (pt.percentiles && (pt.percentiles.p90 || pt.percentiles.p10)) {
			const formatVal = (v) => (v !== undefined && v !== null && `${v}`.includes('°C') ? `${v}` : `${v}°C`);
			return {
				p90: formatVal(pt.percentiles.p90),
				p75: formatVal(pt.percentiles.p75),
				p25: formatVal(pt.percentiles.p25),
				p10: formatVal(pt.percentiles.p10)
			};
		}
		if (type === 'max') {
			return dayItem?.percentiles?.max || {
				p90: `${pt.maxVal !== undefined ? pt.maxVal : pt.temp}°C`,
				p75: `${pt.maxVal !== undefined ? pt.maxVal : pt.temp}°C`,
				p25: `${(pt.maxVal !== undefined ? pt.maxVal : pt.temp) - 1}°C`,
				p10: `${(pt.maxVal !== undefined ? pt.maxVal : pt.temp) - 1}°C`
			};
		}
		if (type === 'min') {
			return dayItem?.percentiles?.min || {
				p10: `${pt.minVal !== undefined ? pt.minVal : pt.temp}°C`,
				p25: `${(pt.minVal !== undefined ? pt.minVal : pt.temp) - 0.5}°C`,
				p75: `${(pt.minVal !== undefined ? pt.minVal : pt.temp) - 1}°C`,
				p90: `${(pt.minVal !== undefined ? pt.minVal : pt.temp) - 1.5}°C`
			};
		}
		// 일반 기온: dayItem의 분위수 데이터가 있거나 해당 온도를 기준으로 10/25/75/90 분위수 산출
		if (dayItem?.percentiles?.temp && Math.abs(pt.temp - 30) <= 2) {
			return dayItem.percentiles.temp;
		}
		return {
			p90: `${(pt.temp + 1.5).toFixed(1).replace('.0', '')}°C`,
			p75: `${(pt.temp + 0.8).toFixed(1).replace('.0', '')}°C`,
			p25: `${(pt.temp - 0.8).toFixed(1).replace('.0', '')}°C`,
			p10: `${(pt.temp - 1.5).toFixed(1).replace('.0', '')}°C`
		};
	};

	const showPointLayer = (pt) => {
		clearTimeout(hideTimeout);
		const dayItem = validDates.find(d => d.date === pt.date);

		let type = 'temp';
		let title = '기온';
		let cardClass = 'card-temp';

		if (pt.isMax) {
			type = 'max';
			title = '최고기온';
			cardClass = 'card-max';
		} else if (pt.isMin) {
			type = 'min';
			title = '최저기온';
			cardClass = 'card-min';
		}

		const p = getPercentilesData(pt, type, dayItem);

		let listHtml = '';
		if (type === 'min') {
			listHtml = `
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>10</span> 분위</span> <strong class="nr__subcard-val">${p.p10}</strong></div>
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>25</span> 분위</span> <strong class="nr__subcard-val">${p.p25}</strong></div>
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>75</span> 분위</span> <strong class="nr__subcard-val">${p.p75}</strong></div>
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>90</span> 분위</span> <strong class="nr__subcard-val">${p.p90}</strong></div>
			`;
		} else {
			listHtml = `
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>90</span> 분위</span> <strong class="nr__subcard-val">${p.p90}</strong></div>
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>75</span> 분위</span> <strong class="nr__subcard-val">${p.p75}</strong></div>
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>25</span> 분위</span> <strong class="nr__subcard-val">${p.p25}</strong></div>
				<div class="nr__subcard-row"><span class="nr__subcard-label"><span>10</span> 분위</span> <strong class="nr__subcard-val">${p.p10}</strong></div>
			`;
		}

		hoverLayer.innerHTML = `
			<div class="nr__mid-subcard ${cardClass}">
				<div class="nr__subcard-header">${title}</div>
				<div class="nr__subcard-list">
					${listHtml}
				</div>
			</div>
		`;

		const cardW = 112;
		const gap = 12;

		// 뷰포트 내 포인트의 상대적 위치 계산
		const viewport = datesWrapper.closest('.nr__hourly-scroll-viewport');
		const scrollLeft = viewport ? viewport.scrollLeft : 0;
		const viewportWidth = viewport ? viewport.clientWidth : width;
		const pointViewportX = pt.x - scrollLeft;

		// 포인트가 뷰포트 우측 절반에 위치하거나 차트 우측 끝에 가까우면 포인트의 좌측에 노출,
		// 그렇지 않고 좌측 절반에 위치하면 포인트의 우측에 노출
		const showOnLeft = (pointViewportX > viewportWidth / 2) || (pt.x + cardW + gap > width - 6);

		let left;
		if (showOnLeft) {
			left = Math.round(pt.x - cardW - gap);
			// 좌측 공간이 부족하면 우측으로 반전
			if (left < 6 && (pt.x + cardW + gap <= width - 6)) {
				left = Math.round(pt.x + gap);
			}
		} else {
			left = Math.round(pt.x + gap);
			// 우측 공간이 부족하면 좌측으로 반전
			if (left + cardW > width - 6 && (pt.x - cardW - gap >= 6)) {
				left = Math.round(pt.x - cardW - gap);
			}
		}

		// 최종 안전 클램핑
		if (left < 6) left = 6;
		if (left + cardW > width - 6) left = width - cardW - 6;

		hoverLayer.setAttribute('data-side', showOnLeft ? 'left' : 'right');

		const top = Math.round(tempLayout.topOffset + 4);

		hoverLayer.style.left = `${left}px`;
		hoverLayer.style.top = `${top}px`;
		hoverLayer.style.display = 'block';
	};

	const hidePointLayer = () => {
		hideTimeout = setTimeout(() => {
			hoverLayer.style.display = 'none';
		}, 200);
	};

	hoverLayer.addEventListener('mouseenter', () => {
		clearTimeout(hideTimeout);
	});
	hoverLayer.addEventListener('mouseleave', () => {
		hidePointLayer();
	});

	// 포인트 마커 호버 이벤트 바인딩 (포인트점에 마우스오버 시에만 레이어 노출)
	const pointGroups = layer.querySelectorAll('.chart-point-group');
	pointGroups.forEach(grp => {
		const idx = parseInt(grp.dataset.index, 10);
		const pt = coords[idx];
		if (!pt) return;

		grp.addEventListener('mouseenter', () => {
			showPointLayer(pt);
		});
		grp.addEventListener('mouseleave', () => {
			hidePointLayer();
		});
		grp.addEventListener('click', (e) => {
			e.stopPropagation();
			showPointLayer(pt);
		});
	});
};

/**
 * 1-2. 최저/최고 기온 선형 차트 & 분위수 밴드 렌더링 (SVG)
 */
export const renderMinMaxTempChart = (layer, context, validDates = [], options = {}) => {
  if (!layer || !context || !context.tempLayout) return;
  const { dailyPoints, unifiedMinTemp, unifiedMaxTemp, minDailyTemp, maxDailyTemp, width, tempLayout, datesWrapper } = context;
  const height = tempLayout.height;
  if (!dailyPoints || dailyPoints.length === 0) return;

  const paddingTop = 32;
  const paddingBottom = 28;
  const usableHeight = Math.max(10, height - paddingTop - paddingBottom);
  // 평균기온 차트와 Y축 스케일 기준을 통일하여 30°C 등 동일 온도의 위치를 일치시킴
  const scaleMin = (unifiedMinTemp !== undefined) ? unifiedMinTemp : minDailyTemp;
  const scaleMax = (unifiedMaxTemp !== undefined) ? unifiedMaxTemp : maxDailyTemp;
  const tempRange = (scaleMax - scaleMin) || 1;

  const getY = (val) => {
    return height - paddingBottom - ((val - scaleMin) / tempRange) * usableHeight;
  };

  // 최고기온 및 최저기온 포인트 좌표 계산
  const maxCoords = dailyPoints.map(pt => ({
    x: pt.maxX,
    y: getY(pt.maxTemp),
    p90Y: getY(pt.percentiles.max.p90),
    p75Y: getY(pt.percentiles.max.p75),
    p25Y: getY(pt.percentiles.max.p25),
    p10Y: getY(pt.percentiles.max.p10),
    data: pt,
    type: 'max'
  }));

  const minCoords = dailyPoints.map(pt => ({
    x: pt.minX,
    y: getY(pt.minTemp),
    p90Y: getY(pt.percentiles.min.p90),
    p75Y: getY(pt.percentiles.min.p75),
    p25Y: getY(pt.percentiles.min.p25),
    p10Y: getY(pt.percentiles.min.p10),
    data: pt,
    type: 'min'
  }));

  // Line Path 생성기 (직선)
  const createBezierPath = (pts, yProp = 'y') => {
    if (!pts || pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0][yProp]}`;
    let d = `M ${pts[0].x} ${pts[0][yProp]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i][yProp]}`;
    }
    return d;
  };

  // Band Path 생성기 (상단 직선 -> 하단 직선 역순 닫기)
  const createBandPath = (pts, topProp, botProp) => {
    if (!pts || pts.length === 0) return '';
    if (pts.length === 1) return '';
    let d = `M ${pts[0].x} ${pts[0][topProp]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i][topProp]}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last[botProp]}`;
    for (let i = pts.length - 2; i >= 0; i--) {
      d += ` L ${pts[i].x} ${pts[i][botProp]}`;
    }
    d += ' Z';
    return d;
  };

  // 최고기온 분위수 밴드 패스
  const maxBand1090 = createBandPath(maxCoords, 'p90Y', 'p10Y');
  const maxBand2575 = createBandPath(maxCoords, 'p75Y', 'p25Y');

  // 최저기온 분위수 밴드 패스 (minCoords에서 온도가 높은 p90이 상단, p10이 하단)
  const minBand1090 = createBandPath(minCoords, 'p90Y', 'p10Y');
  const minBand2575 = createBandPath(minCoords, 'p75Y', 'p25Y');

  // 최고/최저 실선 패스
  const maxLine = createBezierPath(maxCoords, 'y');
  const minLine = createBezierPath(minCoords, 'y');

  let svgHtml = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- 최고기온 분위수 배경 밴드 (10~90분위 연한 밴드, 25~75분위 진한 밴드) -->
      <path d="${maxBand1090}" fill="var(--nr-fc-temp-line, #003763)" fill-opacity="var(--nr-fc-band-opacity-outer, 0.06)" stroke="none" />
      <path d="${maxBand2575}" fill="var(--nr-fc-temp-line, #003763)" fill-opacity="var(--nr-fc-band-opacity-inner, 0.16)" stroke="none" />

      <!-- 최저기온 분위수 배경 밴드 (10~90분위 연한 밴드, 25~75분위 진한 밴드) -->
      <path d="${minBand1090}" fill="var(--nr-fc-temp-line, #003763)" fill-opacity="var(--nr-fc-band-opacity-outer, 0.06)" stroke="none" />
      <path d="${minBand2575}" fill="var(--nr-fc-temp-line, #003763)" fill-opacity="var(--nr-fc-band-opacity-inner, 0.16)" stroke="none" />

      <!-- 최고/최저 실선 -->
      <path d="${maxLine}" fill="none" stroke="var(--nr-fc-temp-max, #EB3B2E)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${minLine}" fill="none" stroke="var(--nr-fc-temp-line, #003763)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  `;

  // 최고기온 포인트 & 라벨
  maxCoords.forEach((pt, idx) => {
    svgHtml += `
      <g class="chart-point-group" data-type="max" data-index="${idx}">
        <circle class="chart-point-circle" cx="${pt.x}" cy="${pt.y}" r="3.5" fill="var(--nr-fc-bg-card, #ffffff)" stroke="var(--nr-fc-temp-max, #EB3B2E)" stroke-width="2.2" />
        <text x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--nr-fc-text-primary, #111111)">${pt.data.maxTemp}°C</text>
        <circle class="nr__chart-hit-point" cx="${pt.x}" cy="${pt.y}" r="16" fill="transparent" data-type="max" data-index="${idx}" />
      </g>
    `;
  });

  // 최저기온 포인트 & 라벨
  minCoords.forEach((pt, idx) => {
    svgHtml += `
      <g class="chart-point-group" data-type="min" data-index="${idx}">
        <circle class="chart-point-circle" cx="${pt.x}" cy="${pt.y}" r="3.5" fill="var(--nr-fc-bg-card, #ffffff)" stroke="var(--nr-fc-temp-min, #0088FF)" stroke-width="2.2" />
        <text x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--nr-fc-text-primary, #111111)">${pt.data.minTemp}°C</text>
        <circle class="nr__chart-hit-point" cx="${pt.x}" cy="${pt.y}" r="16" fill="transparent" data-type="min" data-index="${idx}" />
      </g>
    `;
  });

  svgHtml += `</svg>`;
  layer.innerHTML = svgHtml;

  // 툴팁 엘리먼트 준비
  let tooltipEl = datesWrapper.querySelector('.nr__forecast-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'nr__forecast-tooltip';
    datesWrapper.appendChild(tooltipEl);
  }

  let hideTimer = null;

  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const scheduleHide = () => {
    cancelHide();
    hideTimer = setTimeout(() => {
      if (tooltipEl) {
        tooltipEl.classList.remove('show');
      }
    }, 180);
  };

  // 툴팁 영역 위에 마우스가 머무르면 닫히지 않고 유지, 벗어나면 닫히도록 바인딩
  if (!tooltipEl._hasHoverEvents) {
    tooltipEl.addEventListener('mouseenter', () => {
      cancelHide();
    });
    tooltipEl.addEventListener('mouseleave', () => {
      scheduleHide();
    });
    tooltipEl._hasHoverEvents = true;
  }

  // PC 호버 및 모바일 터치 이벤트 바인딩
  const hitPoints = layer.querySelectorAll('.nr__chart-hit-point');
  hitPoints.forEach(hit => {
    const type = hit.dataset.type;
    const idx = parseInt(hit.dataset.index);
    const targetCoord = (type === 'max') ? maxCoords[idx] : minCoords[idx];
    if (!targetCoord) return;

    const showTooltip = () => {
      cancelHide();
      const p = targetCoord.data.percentiles[type];
      const isMax = (type === 'max');

      let html = '';
      if (isMax) {
        html = `
          <div class="nr__tooltip-header header-max">최고기온</div>
          <div class="nr__tooltip-list">
            <div class="nr__tooltip-row"><span class="nr__tt-label">90 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-max">${p.p90}°C</strong></div>
            <div class="nr__tooltip-row"><span class="nr__tt-label">75 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-max">${p.p75}°C</strong></div>
            <div class="nr__tooltip-row"><span class="nr__tt-label">25 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-max">${p.p25}°C</strong></div>
            <div class="nr__tooltip-row"><span class="nr__tt-label">10 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-max">${p.p10}°C</strong></div>
          </div>
        `;
        tooltipEl.className = 'nr__forecast-tooltip type-max show';
      } else {
        html = `
          <div class="nr__tooltip-header header-min">최저기온</div>
          <div class="nr__tooltip-list">
            <div class="nr__tooltip-row"><span class="nr__tt-label">10 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-min">${p.p10}°C</strong></div>
            <div class="nr__tooltip-row"><span class="nr__tt-label">25 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-min">${p.p25}°C</strong></div>
            <div class="nr__tooltip-row"><span class="nr__tt-label">75 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-min">${p.p75}°C</strong></div>
            <div class="nr__tooltip-row"><span class="nr__tt-label">90 <span class="nr__tt-unit">분위</span></span> <strong class="nr__tt-val val-min">${p.p90}°C</strong></div>
          </div>
        `;
        tooltipEl.className = 'nr__forecast-tooltip type-min show';
      }
      tooltipEl.innerHTML = html;

      // 위치 계산: 높이를 기온 영역 중간으로 고정하고, 가로 위치에 따라 좌/우 동적 표출
      const tooltipW = tooltipEl.offsetWidth || 140;
      const tooltipH = tooltipEl.offsetHeight || 136;

      // 1. 높이 위치: 기온 영역(tempLayout)의 수직 중간으로 고정
      const tempAreaCenterY = tempLayout.topOffset + (tempLayout.height / 2);
      const top = Math.round(tempAreaCenterY - (tooltipH / 2));

      // 2. 가로 위치: 현재 뷰포트 내 가로 위치에 따라 좌/우 동적 결정
      const viewport = datesWrapper.closest('.nr__hourly-scroll-viewport');
      let isRenderLeft = false;

      if (viewport) {
        const viewportScrollLeft = viewport.scrollLeft;
        const viewportWidth = viewport.clientWidth;
        // 뷰포트 화면 기준 포인트 상대 X좌표
        const screenX = targetCoord.x - viewportScrollLeft;

        // 포인트가 화면 우측(55% 이상)에 위치하거나 우측 여유 공간이 좁으면 좌측으로 표출
        if (screenX + 14 + tooltipW > viewportWidth || screenX > viewportWidth * 0.55) {
          isRenderLeft = true;
        }
      } else {
        // fallback: 전체 width 기준 우측 경계 체크
        if (targetCoord.x + 14 + tooltipW > width) {
          isRenderLeft = true;
        }
      }

      let left = isRenderLeft
        ? Math.round(targetCoord.x - tooltipW - 14)
        : Math.round(targetCoord.x + 14);

      // 전체 wrapper 경계 안전 클램핑
      if (left < 4) left = 4;
      if (left + tooltipW > width - 4) left = width - tooltipW - 4;

      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
    };

    hit.addEventListener('mouseenter', showTooltip);
    hit.addEventListener('mouseleave', scheduleHide);
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      showTooltip();
    });
  });

  // 외부 클릭 시 툴팁 숨김
  if (!datesWrapper._hasDocClickTooltip) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nr__chart-hit-point') && !e.target.closest('.nr__forecast-tooltip')) {
        const tip = datesWrapper.querySelector('.nr__forecast-tooltip');
        if (tip) {
          cancelHide();
          tip.classList.remove('show');
        }
      }
    });
    datesWrapper._hasDocClickTooltip = true;
  }
};

/**
 * 2. 강수확률 막대 차트 렌더링 (SVG)
 * 막대그래프가 셀 내부의 .nr__cell-rain-chart-group으로 직접 렌더링되므로 기본 SVG 렌더러는 비워둡니다.
 */
export const defaultRenderRainChart = (layer, context) => {
	if (!layer) return;
	layer.innerHTML = '';
};

/**
 * 3. 풍향/풍속 차트 렌더링 (SVG 화살표, 풍속 선 그래프 & 텍스트)
 */
export const defaultRenderWindChart = (layer, context, validDates, options = {}) => {
	if (!layer || !context || !context.windLayout) return;
	const { points, width, windLayout } = context;
	const height = windLayout.height;
	if (!points || points.length === 0) return;

	const isBarChartMode = options.isBarChartMode ?? Boolean(layer.closest('.nr__mode-bar-chart'));
	const isShortTerm = options.forecastTab ? (options.forecastTab !== 'mid') : !Boolean(layer.closest('.nr__tab-mid'));
	const is3h = (options.currentInterval === 3) || (options.interval === 3) || Boolean(layer.closest('.nr__interval-3h'));

	// 단기예보 / 그래프형태 / 3시간간격 일 때: 풍향 화살표와 풍속 강도만 노출, 풍속 차트와 숫자 비노출
	const isSimpleWind = isShortTerm && isBarChartMode && is3h;

	if (isSimpleWind) {
		const targetHeight = (height && height > 0) ? height : 70;
		layer.style.height = `${targetHeight}px`;

		const centerY = targetHeight / 2;
		const arrowY = centerY - 12;
		const strengthY = centerY + 14;

		let svgHtml = `
			<svg width="${width}" height="${targetHeight}" viewBox="0 0 ${width} ${targetHeight}" xmlns="http://www.w3.org/2000/svg">
		`;

		points.forEach(pt => {
			svgHtml += `
				<g class="wind-item">
					<!-- 풍향 화살표 (가로 10, 높이 13) -->
					<g transform="translate(${pt.x}, ${arrowY}) rotate(${pt.windDir})">
						<path d="M 0 -8 L 5 5 L 0 3 L -5 5 Z" fill="var(--nr-fc-text-primary, #000)" />
					</g>
					<!-- 풍속 강도 -->
					<text x="${pt.x}" y="${strengthY}" text-anchor="middle" font-size="14" font-weight="500" fill="var(--nr-fc-text-primary, #000)">${pt.windStrength}</text>
				</g>
			`;
		});

		svgHtml += `</svg>`;
		layer.innerHTML = svgHtml;
		return;
	}

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
			<path d="${lineD}" fill="none" stroke="var(--nr-fc-primary, #009AE1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	`;

	coords.forEach(pt => {
		// 0.4rem (약 4px) 간격 계산
		// 포인트 원 반지름 3.5px
		const arrowY = pt.y - 14.5;    // 포인트 원 상단 위 풍향 화살표
		const speedY = pt.y + 18;      // 포인트 원 하단 풍속 숫자
		const strengthY = pt.y + 34;   // 풍속 숫자 아래 풍속 강도 텍스트

		svgHtml += `
			<g class="wind-item">
				<!-- 풍향 화살표 (가로 10, 높이 13) -->
				<g transform="translate(${pt.x}, ${arrowY}) rotate(${pt.windDir})">
					<path d="M 0 -8 L 5 5 L 0 3 L -5 5 Z" fill="var(--nr-fc-text-primary, #000)" />
				</g>
				<!-- 풍속 차트 포인트 원 -->
				<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="var(--nr-fc-bg-card, #ffffff)" stroke="var(--nr-fc-primary, #009AE1)" stroke-width="2" />
				<!-- 풍속 숫자 -->
				<text x="${pt.x}" y="${speedY}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--nr-fc-text-primary, #000)">${pt.windSpeed}</text>
				<!-- 풍속 강도 -->
				<text x="${pt.x}" y="${strengthY}" text-anchor="middle" font-size="14" font-weight="500" fill="var(--nr-fc-text-primary, #000)">${pt.windStrength}</text>
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
					<stop offset="0%" stop-color="#009AE1" stop-opacity="0.25"/>
					<stop offset="100%" stop-color="#009AE1" stop-opacity="0.0"/>
				</linearGradient>
			</defs>
			<path d="${areaD}" fill="url(#humidityGrad)" />
			<path d="${d}" fill="none" stroke="#009AE1" stroke-width="2" stroke-linecap="round" />
	`;

	coords.forEach(pt => {
		svgHtml += `
			<g class="chart-point-group">
				<circle cx="${pt.x}" cy="${pt.y}" r="3" fill="var(--nr-fc-bg-card, #ffffff)" stroke="#009AE1" stroke-width="2" />
				<text x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--nr-fc-text-primary, #000)">${pt.prob}%</text>
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
  const context = buildChartContext(container, validDates);
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
		if (options.forecastTab === 'mid') {
			renderMidtermTempChart(tempLayer, context, validDates, options);
		} else if (options.tempType === 'minmax') {
			renderMinMaxTempChart(tempLayer, context, validDates, options);
		} else {
			const fn = typeof options.renderTempChart === 'function' ? options.renderTempChart : (typeof window[options.renderTempChart] === 'function' ? window[options.renderTempChart] : defaultRenderTempChart);
			fn(tempLayer, context, validDates, options);
		}
	}

	// 단기예보일 때만 강수확률, 풍향/풍속, 습도 차트 렌더링
	if (options.forecastTab !== 'mid') {
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
	}
};
