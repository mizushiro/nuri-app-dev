import { ScrollTrigger } from '../utils/utils.js';

export default class ScrollEvent {
  #id;
  #wrap;
  #items;
  #area;
  #callback;
  #scrolltrigger;
  #scrolltrigger2;

  constructor(opt) {
    this.#id = opt.id;
    this.#callback = opt.callback;
    this.#wrap = document.querySelector(`[data-scrollevent="${this.#id}"]`);
    this.#items = this.#wrap.querySelectorAll(`[data-scrollevent-item]`);
    this.#area = window;
    this.stepTop = 0;
    this.sum = this.#items.length;
    this.current = this.#items[0];
    this.currentHeight = this.current.getBoundingClientRect().height;
    this.currentTop = Math.trunc(this.current.getBoundingClientRect().top);
    this.arrayTop = [];
    this.arrayHeight = [];
    this.arrayID = [];
    this.rootMargin = opt.rootMargin;
    this.threshold = opt.threshold;
  }
  init() {
    const percent = (Number(Math.trunc((this.currentHeight -  this.currentTop) / this.currentHeight * 100)))
    this.current.querySelector('b') ? this.current.querySelector('b').textContent = percent + '%' : '';
    this.#items.forEach((item, index) => {
      item.dataset.n = index;
      this.arrayTop.push(Math.trunc(item.getBoundingClientRect().top + window.scrollY));
      this.arrayHeight.push(Math.trunc(item.getBoundingClientRect().height));
      this.arrayID.push(item.dataset.scrolleventItem);
    });
    this.#area.addEventListener('scroll', this.handlerScroll.bind(this));
    this.#scrolltrigger = new ScrollTrigger({
      targetSelector: this.#items,
      rootMargin: this.rootMargin, 
      threshold: this.threshold,  
      callback: (data) => {
        this.current = data.target;
        this.stepTop = window.scrollY;
        this.currentHeight = data.rect.height;
        this.ratio = data.ratio;

        const foundIndex = this.arrayID.indexOf(this.current.dataset.scrolleventItem);
        let value = {
          prev: null,
          current: this.current.dataset.scrolleventItem,
          next: null,
        }

        if (foundIndex !== -1) {
          value.prev = this.arrayID[foundIndex - 1]; // 이전 값
          value.next = this.arrayID[foundIndex + 1]; // 다음 값
        } else {
          console.log('찾는 값이 배열에 없습니다.');
        }
        console.log(value.current, Math.round(this.ratio) === 1 ? '이전' : '현재');

        // if (this.stepTop < this.currentHeight) {
        //   console.log('이전:', value.prev);
        //   console.log('현재:', value.current);
        // } else {
        //   console.log('이전:', value.current);
        //   console.log('현재:', value.next);
        // }
      }
    });
   
  }
  handlerScroll(e) {
    this.#items.forEach(item => {
      // 오브젝트의 위치와 높이 가져오기
      const rect = item.getBoundingClientRect();
      const itemHeight = item.offsetHeight;
      const viewportHeight = window.innerHeight;
      const root = document.documentElement;
      const name = '--' + item.dataset.scrolleventItem + '-n';
      const namePer = '--' + item.dataset.scrolleventItem + '-percent';

      // 오브젝트의 상단이 화면 하단과 오브젝트의 하단이 화면 하단 사이에 있을 때만 계산
      // (즉, 오브젝트가 화면 아래에서 서서히 나타나는 구간)
      if (rect.top <= viewportHeight && rect.bottom >= viewportHeight) {
        // 퍼센트 계산
        let percent = Math.max(0, Math.min(100, ((viewportHeight - rect.top) / itemHeight) * 100));
        const per = Math.trunc(percent);

        // 텍스트 업데이트
        if (item.querySelector('b')) {
          item.querySelector('b').textContent = per;
        }

        root.style.setProperty(namePer, `${Math.trunc(percent)}%`);
        root.style.setProperty(name, `${Math.trunc(percent) / 100}`);

         this.#callback && this.#callback({
          percent: per,
          target: item
        });
      } else {
        // 오브젝트가 화면 밖에 있을 때
        if (rect.top > viewportHeight) {
          // 화면 아래에 있으면 0%
          if (item.querySelector('b')) item.querySelector('b').textContent = '0%';
          root.style.setProperty(namePer, `0%`);
          root.style.setProperty(name, `0`);
        } else {
          // 화면 하단을 지나 위로 올라갔으면 100%
          if (item.querySelector('b')) item.querySelector('b').textContent = '100%';
          root.style.setProperty(namePer, `100%`);
          root.style.setProperty(name, `1`);
        }
      }
    });
  }
} 