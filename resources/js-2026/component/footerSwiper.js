import Swiper from 'swiper';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';

export default class FooterSwiper {
  constructor() {
    this.bannerSwiper = null;
    this.agencySwiper = null;
  }

  init() {
    this.initAgencySwiper();
    this.bindControlEvents();
  }

  initAgencySwiper() {
    const agencyElement = document.querySelector('[data-swiper="agency"]');
    if (!agencyElement) return;

    this.agencySwiper = new Swiper(agencyElement, {
      modules: [Navigation, Autoplay],
      loop: true,
      autoplay: {
        delay: 3000,
        disableOnInteraction: false,
      },
      navigation: {
        nextEl: '.footer-agency-next',
        prevEl: '.footer-agency-prev',
      },
      slidesPerView: 'auto',
      spaceBetween: 40,
      centeredSlides: true,
      speed: 600,
      breakpoints: {
        320: {
          slidesPerView: 2,
          spaceBetween: 20,
          centeredSlides: false,
        },
        768: {
          slidesPerView: 4,
          spaceBetween: 30,
          centeredSlides: false,
        },
        1024: {
          slidesPerView: 6,
          spaceBetween: 40,
          centeredSlides: true,
        }
      }
    });

    // 자동재생 상태 추적
    this.isAutoplayRunning = true;
  }

  bindControlEvents() {
    // 재생/정지 버튼 이벤트
    const pauseBtn = document.querySelector('[data-action="pause"]');
    const playBtn = document.querySelector('[data-action="play"]');

    if (pauseBtn && playBtn) {
      pauseBtn.addEventListener('click', () => {
        this.pauseAutoplay();
        pauseBtn.style.display = 'none';
        playBtn.style.display = 'flex';
        pauseBtn.classList.remove('active');
        playBtn.classList.add('active');
      });

      playBtn.addEventListener('click', () => {
        this.resumeAutoplay();
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
        playBtn.classList.remove('active');
        pauseBtn.classList.add('active');
      });

      // 초기 상태 설정
      pauseBtn.classList.add('active');
    }
  }

  pauseAutoplay() {
    if (this.agencySwiper && this.isAutoplayRunning) {
      this.agencySwiper.autoplay.stop();
      this.isAutoplayRunning = false;
    }
  }

  resumeAutoplay() {
    if (this.agencySwiper && !this.isAutoplayRunning) {
      this.agencySwiper.autoplay.start();
      this.isAutoplayRunning = true;
    }
  }

  destroy() {
    if (this.bannerSwiper) {
      this.bannerSwiper.destroy(true, true);
      this.bannerSwiper = null;
    }
    if (this.agencySwiper) {
      this.agencySwiper.destroy(true, true);
      this.agencySwiper = null;
    }
  }

  // 특정 슬라이드로 이동
  goToSlide(swiperType, index) {
    if (swiperType === 'banner' && this.bannerSwiper) {
      this.bannerSwiper.slideTo(index);
    } else if (swiperType === 'agency' && this.agencySwiper) {
      this.agencySwiper.slideTo(index);
    }
  }

  // 자동재생 제어
  toggleAutoplay(swiperType, enable = true) {
    const swiper = swiperType === 'banner' ? this.bannerSwiper : this.agencySwiper;
    if (!swiper) return;

    if (enable) {
      swiper.autoplay.start();
    } else {
      swiper.autoplay.stop();
    }
  }
}

// 사용법:
// const footerSwiper = new FooterSwiper();
// footerSwiper.init();