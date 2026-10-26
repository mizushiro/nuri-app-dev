import {
  uiForecastExe,
  dailyForecastExe,
  sunMoonExe,
  airQualityExe,
  livingIndicesExe,
} from "./ui-forecast.js";
import { showToast } from "./ui-toast.js";
import { applyLanguage } from "./allmenu.js";

/**
 * 날씨 메인 통합 데이터 관리자 (WeatherMainManager)
 * - 기준 계층: 지역(Location) > 오늘날씨정보(Today) > 일주일치정보(Weekly)
 * - 상단 Swiper 이동 시 전체 화면(시간별 예보, 일별 예보, 일출일몰, 대기질, 생활기상지수 등)을
 *   해당 지역 데이터로 동적 갱신
 */
export const WeatherMainManager = {
  data: null,
  currentLocationIndex: 0,
  swiperInstance: null,
  chartOptions: {},

  /**
   * 초기화 함수
   * @param {Object} options
   * @param {string} [options.jsonUrl='../resources/json/weather.json']
   * @param {Object} [options.chartOptions={}]
   */
  init: async (options = {}) => {
    const jsonUrl = options.jsonUrl || "../resources/json/weather.json";
    WeatherMainManager.chartOptions = {
      ...options.chartOptions,
      ...(options.viewMode ? { viewMode: options.viewMode } : {}),
      ...options.forecastOptions,
    };

    try {
      const response = await fetch(jsonUrl);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const json = await response.json();
      WeatherMainManager.data = json;

      // 1. 상단 Swiper 슬라이드 동적 렌더링
      WeatherMainManager.renderSummarySwiperSlides(json.locations);

      // 2. 상단 Swiper 생성 및 슬라이드 체인지 이벤트 연동
      WeatherMainManager.initSummarySwiper();

      // 3. 꽃가루 필터 라디오 변경 이벤트 연동
      WeatherMainManager.bindPollenEvents();

      // 4. 즐겨찾기 토글 이벤트 연동
      WeatherMainManager.bindFavoriteEvents();

      // 5. 초기 선택 지역(0번) 데이터 화면 전체 반영
      WeatherMainManager.renderLocation(0);

      return json;
    } catch (err) {
      console.error("[WeatherMainManager] 날씨 데이터 로드 오류:", err);
    }
  },

  /**
   * 상단 스와이퍼 슬라이드 DOM 생성
   * @param {Array} locations
   */
  renderSummarySwiperSlides: (locations) => {
    const wrapper = document.querySelector(
      ".nr__summary-swiper .swiper-wrapper",
    );
    if (!wrapper || !Array.isArray(locations)) return;

    let slidesHtml = "";
    locations.forEach((loc, idx) => {
      const cur = loc.today.current;
      const sub = loc.today.subMetrics;
      const alert = loc.today.specialReport;
      const hour = new Date().getHours();
      const isNight = hour >= 18 || hour < 6;
      let displayIcon = cur.icon;
      if (isNight) {
        if (displayIcon === "NB01") displayIcon = "NB12";
        else if (displayIcon === "NB02") displayIcon = "NB13";
      }

      slidesHtml += `
        <div class="swiper-slide" data-location-id="${loc.id}" data-location-index="${idx}">
          <div class="nr__main-summary-area">
            <!-- S : 현재 날씨 및 기온 카드 -->
            <div class="nr__summary-card nr__summary-card--main nr__weather-detail-card" data-diaplay-item="info">
              <div class="nr__summary-card-head">
                <div class="nr__summary-location">
                  <i class="icon-aspect-location-w" data-size="16" aria-hidden="true"></i>
                  <strong class="text-14 nr__loc-name" data-weight="600" data-text-shadow="true">${loc.location.fullName}</strong>
                  <div class="nr__summary-actions">
                    <input type="checkbox" id="place_favorites_${loc.id}" class="sr_only nr__fav-checkbox" data-location-id="${loc.id}" ${loc.location.isFavorite ? "checked" : ""}>
                    <label for="place_favorites_${loc.id}" aria-label="즐겨찾기" class="nr__summary-circle-btn nr__btn-star">
                      <i class="icon-mask-star" data-size="22" aria-hidden="true"></i>
                    </label>
                    <button type="button" class="nr__summary-circle-btn" aria-label="검색">
                      <i class="icon-aspect-search-w" data-size="16" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
                <a href="https://www.weather.go.kr/wnuri-map/html/map.html" target="_blank" class="nr__btn-nury">
                  <span>날씨지도</span>
                </a>
              </div>
              <div class="nr__summary-weather">
                <i class="icon-aspect-${displayIcon}" data-size="80" aria-hidden="true"></i>
                <div class="nr__summary-temp">
                  <span class="text-68" data-weight="600" data-text-shadow="true">${cur.temp}</span>
                  <span class="text-34 mt-4" data-weight="600" data-text-shadow="true">°C</span>
                </div>
              </div>
              <div class="nr__summary-feel text-18" data-weight="500" data-text-shadow="true">
                <span>체감온도 <strong data-weight="600">${cur.feelTemp}°</strong></span>
                <span class="nr__summary-slash" aria-hidden="true">/</span>
                <span>${cur.tempDiffText}</span>
              </div>
            </div>
            <!-- E : 현재 날씨 및 기온 카드 -->

            <!-- S : 습도 / 강수량 / 바람 상세 카드 -->
            <div class="nr__summary-grid">
              <!-- 습도 -->
              <div class="nr__summary-card nr__summary-card--sub">
                <div class="nr__summary-sub-head">
                  <span class="text-14" data-weight="700">습도</span>
                  <span class="nr__summary-icon-circle">
                    <i class="icon-aspect-main3" data-size="18" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="nr__summary-sub-val">
                  <strong class="text-21" data-weight="700">${sub.humidity}</strong>
                  <span class="text-16" data-weight="700">%</span>
                </div>
              </div>
              <!-- 시간당 강수량 -->
              <div class="nr__summary-card nr__summary-card--sub">
                <div class="nr__summary-sub-head">
                  <span class="text-13" data-weight="700">시간당 강수량</span>
                  <span class="nr__summary-icon-circle">
                    <i class="icon-aspect-main4" data-size="18" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="nr__summary-sub-val">
                  <strong class="text-21" data-weight="700">${sub.hourlyPrecip}</strong>
                  <span class="text-16" data-weight="700">mm</span>
                </div>
              </div>
              <!-- 바람 -->
              <div class="nr__summary-card nr__summary-card--sub">
                <div class="nr__summary-sub-head">
                  <span class="text-14" data-weight="700">바람</span>
                  <span class="nr__summary-icon-circle">
                    <i class="icon-aspect-main5" data-size="18" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="nr__summary-sub-val nr__summary-sub-val--wind">
                  <span class="nr__summary-wind-dir">
                    <span class="text-12" data-weight="700" data-text-color="w/60">${sub.wind.direction}</span>
                    <span class="nr__summary-arrow" aria-hidden="true" style="display:inline-block; transform: rotate(${sub.wind.angle}deg);">▲</span>
                  </span>
                  <div class="nr__summary-wind-speed">
                    <strong class="text-21" data-weight="700">${sub.wind.speed}</strong>
                    <span class="text-16" data-weight="700">${sub.wind.unit || "m/s"}</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- E : 습도 / 강수량 / 바람 상세 카드 -->

            <!-- S : 특보 날씨 알림 카드 -->
            ${alert && alert.active
          ? `
            <div class="nr__summary-card nr__summary-card--alert">
              <div class="nr__summary-alert-head">
                <i class="icon-aspect-warning-w" data-size="18" aria-hidden="true"></i>
                <strong class="text-14" data-weight="500" data-text-color="w/80">${alert.title}</strong>
              </div>
              <p class="text-16" data-weight="600" data-line-h="1.25">
                ${alert.message}
              </p>
            </div>
            `
          : `
            <div class="nr__summary-card nr__summary-card--alert nr__summary-card--alert-none">
              <div class="nr__summary-alert-head">
                <i class="icon-aspect-warning-w" data-size="18" aria-hidden="true"></i>
                <strong class="text-14" data-weight="500" data-text-color="w/80">기상 특보</strong>
              </div>
              <p class="text-16" data-weight="600" data-line-h="1.25">
                현재 발효 중인 기상특보가 없습니다.
              </p>
            </div>
            `
        }
            <!-- E : 특보 날씨 알림 카드 -->
          </div>
        </div>
      `;
    });

    wrapper.innerHTML = slidesHtml;
    if (document.documentElement.getAttribute('lang') === 'en') {
      applyLanguage('en');
    }
  },

  /**
   * 상단 요약 카드 Swiper 인스턴스 생성 및 스와이프 이벤트 연결
   */
  initSummarySwiper: () => {
    if (typeof Swiper === "undefined") {
      console.warn(
        "[WeatherMainManager] Swiper 라이브러리를 찾을 수 없습니다.",
      );
      return;
    }

    if (WeatherMainManager.swiperInstance) {
      WeatherMainManager.swiperInstance.destroy(true, true);
    }

    WeatherMainManager.swiperInstance = new Swiper(
      ".nr__summary-swiper .swiper",
      {
        loop: true,
        spaceBetween: 12,
        pagination: {
          el: ".nr__summary-swiper .swiper-pagination",
          clickable: true,
        },
        on: {
          realIndexChange: function () {
            const index = this.realIndex;
            if (typeof index !== "number" || isNaN(index)) return;
            if (index === WeatherMainManager.currentLocationIndex) return;
            WeatherMainManager.renderLocation(index);
          },
        },
      },
    );
  },

  /**
   * 특정 지역 인덱스의 전체 날씨 정보를 화면에 렌더링
   * @param {number} index - 위치 배열 인덱스
   * @param {boolean} [force=false] - 동일 인덱스여도 강제 재렌더링 여부
   */
  renderLocation: (index, force = false) => {
    if (
      !WeatherMainManager.data ||
      !Array.isArray(WeatherMainManager.data.locations)
    )
      return;
    if (
      !force &&
      WeatherMainManager._isRendered &&
      WeatherMainManager.currentLocationIndex === index
    ) {
      return;
    }
    WeatherMainManager._isRendered = true;
    WeatherMainManager.currentLocationIndex = index;
    const loc = WeatherMainManager.data.locations[index];
    if (!loc) return;

    // 1. 상단 일시 및 퀵 특보 태그 업데이트
    WeatherMainManager.renderTopMeta(loc);

    // 2. 시간별 예보(주간카드 + 가로 스크롤/차트) 업데이트
    WeatherMainManager.renderHourlyForecast(loc);

    // 3. 일별 예보(7일치 요약 리스트) 업데이트
    WeatherMainManager.renderDailyForecast(loc);

    // 4. 일출일몰 · 월출월몰 정보 업데이트
    WeatherMainManager.renderSunMoon(loc);

    // 5. 대기질 정보(초미세, 미세, 오존 게이지) 업데이트
    WeatherMainManager.renderAirQuality(loc);

    // 6. 생활기상지수(자외선, 대기정체, 꽃가루) 업데이트
    WeatherMainManager.renderLivingIndices(loc);

    if (document.documentElement.getAttribute('lang') === 'en') {
      applyLanguage('en');
    }
  },

  /**
   * 1. 상단 일시 및 퀵 특보 버튼 업데이트
   */
  renderTopMeta: (loc) => {
    const timeEl = document.querySelector(".nr__summary-time");
    if (timeEl && loc.location.updatedAt) {
      timeEl.textContent = loc.location.updatedAt;
    }

    const alertBtnsContainer = document.querySelector(
      ".nr__summary-alert-btns",
    );
    if (alertBtnsContainer && Array.isArray(loc.location.quickAlerts)) {
      alertBtnsContainer.innerHTML = loc.location.quickAlerts
        .map(
          (alert) => `
        <a href="${alert.link}" ${alert.target ? 'target="_blank"' : ""} class="nr__summary-alert-btn ${alert.active ? "is-active" : ""}" >
          <i class="${alert.icon || "icon-aspect-main1"}" data-size="20" aria-hidden="true"></i>
          <span class="text-14" data-weight="600">${alert.name}</span>
        </a>
      `,
        )
        .join("");
    }
  },

  /**
   * 2. 시간별 예보(주간 슬라이드 + 시간별 그리드/차트) 업데이트
   */
  renderHourlyForecast: (loc) => {
    if (loc.weekly && Array.isArray(loc.weekly.days)) {
      uiForecastExe(
        "hourly-forecast-day",
        loc.weekly.days,
        WeatherMainManager.chartOptions,
      );
    }
  },

  /**
   * 3. 일별 예보 목록 및 날짜 범위 갱신
   */
  renderDailyForecast: (loc) => {
    if (loc.weekly && Array.isArray(loc.weekly.days)) {
      dailyForecastExe("#section-daily", loc.weekly.days);
    }
  },

  /**
   * 4. 일출일몰 · 월출월몰 갱신
   */
  renderSunMoon: (loc) => {
    if (loc && loc.today && loc.today.astro) {
      sunMoonExe("#section-sun-moon", loc.today.astro);
    }
  },

  /**
   * 5. 대기질 정보(초미세먼지, 미세먼지, 오존) 갱신
   */
  renderAirQuality: (loc) => {
    if (loc && loc.today && loc.today.airQuality) {
      airQualityExe("#section-air", loc.today.airQuality);
    }
  },

  /**
   * 6. 생활기상지수(자외선, 대기정체, 꽃가루) 갱신
   */
  renderLivingIndices: (loc) => {
    if (loc && loc.today && loc.today.livingIndices) {
      livingIndicesExe(
        {
          uv: "#section-uv",
          airStagnation: "#section-stagnation",
          pollen: "#section-pollen",
        },
        loc.today.livingIndices,
      );
    }
  },

  /**
   * 꽃가루 목록을 현재 라디오 선택 상태에 맞춰 갱신
   */
  renderPollenList: (loc) => {
    if (loc && loc.today && loc.today.livingIndices) {
      livingIndicesExe({ pollen: "#section-pollen" }, loc.today.livingIndices);
    }
  },

  /**
   * 꽃가루 필터 라디오 변경 이벤트 바인딩
   */
  bindPollenEvents: () => {
    const pollenRadios = document.querySelectorAll('input[name="pollen"]');
    pollenRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (WeatherMainManager.data) {
          const loc =
            WeatherMainManager.data.locations[
            WeatherMainManager.currentLocationIndex
            ];
          if (loc) {
            WeatherMainManager.renderPollenList(loc);
            if (document.documentElement.getAttribute('lang') === 'en') {
              applyLanguage('en');
            }
          }
        }
      });
    });
  },

  /**
   * 즐겨찾기 변경 이벤트 바인딩 (Swiper loop 복제 슬라이드 동기화 및 토스트 팝업 실행)
   */
  bindFavoriteEvents: () => {
    document.addEventListener("click", (e) => {
      const label = e.target.closest(
        ".nr__summary-actions label, .nr__btn-star",
      );
      if (label) {
        e.preventDefault();
        const actions = label.closest(".nr__summary-actions");
        const checkbox = actions?.querySelector(".nr__fav-checkbox");

        let isActive = false;
        let locId = null;
        let targetLoc = null;

        if (checkbox) {
          locId = checkbox.dataset.locationId;
          isActive = !checkbox.checked;

          // 동일 locationId를 가진 모든 슬라이드(클론 포함)의 체크박스 상태 동기화
          document
            .querySelectorAll(`.nr__fav-checkbox[data-location-id="${locId}"]`)
            .forEach((cb) => {
              cb.checked = isActive;
            });

          if (
            WeatherMainManager.data &&
            Array.isArray(WeatherMainManager.data.locations)
          ) {
            targetLoc = WeatherMainManager.data.locations.find(
              (l) => l.id === locId,
            );
            if (targetLoc) {
              targetLoc.location.isFavorite = isActive;
              console.log(
                `[WeatherMainManager] 즐겨찾기 상태 변경: ${targetLoc.location.fullName} -> ${targetLoc.location.isFavorite}`,
              );
            }
          }
        } else {
          // 체크박스가 없는 단순 버튼 형태의 .nr__btn-star 토글 지원
          isActive = label.classList.toggle("active");
          label.setAttribute("aria-pressed", isActive ? "true" : "false");
        }

        // 현재 선택된 지역명 추출
        const cardEl =
          label.closest(".nr__weather-detail-card") ||
          label.closest(".nr__summary-card") ||
          document.querySelector(".nr__weather-detail-card") ||
          document.querySelector(".nr__summary-card");

        const locName =
          targetLoc?.location?.fullName ||
          cardEl?.querySelector(".nr__loc-name")?.textContent.trim() ||
          document.querySelector(".nr__loc-name")?.textContent.trim() ||
          document
            .querySelector(".nr__summary-location strong")
            ?.textContent.trim() ||
          "현재 지역";

        // 토스트 메시지 생성
        const message = isActive
          ? `${locName}이 관심지역에 등록되었습니다.`
          : `${locName}이 관심지역에서 삭제되었습니다.`;

        // 날씨 상세 카드(.nr__weather-detail-card) 상단에 토스트 팝업 띄우기
        showToast(message, {
          target: "body",
          position: "card-top",
          duration: 3000,
          type: "warning",
        });
      }
    });
  },

  /**
   * 단독 .nr__btn-star 요소 바인딩 참고용 함수
   */
  initBookmark: () => {
    const starBtn = document.querySelector(".nr__btn-star");
    if (!starBtn) return;

    starBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // 활성화 상태 토글
      const isActive = starBtn.classList.toggle("active");
      starBtn.setAttribute("aria-pressed", isActive ? "true" : "false");

      // 현재 선택된 지역명 추출 (예: "인천광역시 중구 전동")
      const locName =
        document.querySelector(".nr__loc-name")?.textContent.trim() ||
        "현재 지역";

      // 토스트 메시지 생성
      const message = isActive
        ? `${locName}이 관심지역에 등록되었습니다.`
        : `${locName}이 관심지역에서 삭제되었습니다.`;

      // 날씨 상세 카드(.nr__weather-detail-card) 상단에 토스트 팝업 띄우기
      showToast(message, {
        target: ".nr__weather-detail-card",
        position: "card-top",
        duration: 3000,
        type: "warning",
      });
    });
  },
};
