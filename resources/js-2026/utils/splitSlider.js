export default class SplitSlider {
  constructor(opt) {
    this.id = opt.id;
    this.wrap = document.querySelector(`[data-map="${this.id}"]`);
    if (!this.wrap) {
      return false;
    }
    this.divides = this.wrap.querySelectorAll('[data-map-btn]');
    this.divide_items = this.wrap.querySelectorAll('[data-map-area]');
    this.divide_adds = document.querySelectorAll('[data-map-add]');
    this.isDragging = false;
    this.activeDivide = null;
  }

  start() {
    if (!this.wrap) {
      return false;
    }
    this.divides.forEach((el, i) => {
      el.dataset.n = i;
      el.addEventListener('mousedown', this.actStart);
      el.addEventListener('touchstart', this.actStart);
    });

    window.addEventListener('mousemove', this.actMove);
    window.addEventListener('mouseup', this.actEnd);
    window.addEventListener('touchmove', this.actMove);
    window.addEventListener('touchend', this.actEnd);
  }

  actStart = (e) => {
    e.preventDefault();
    this.isDragging = true;
    this.activeDivide = e.currentTarget;
    this.wrap.style.cursor = 'grabbing';
  }

  actMove = (e) => {
    if (!this.isDragging || !this.activeDivide) return;
    const _left = this.wrap.getBoundingClientRect().left;
    const x = e.clientX || (e.targetTouches && e.targetTouches[0].clientX);
    let per = ((x - _left) / this.wrap.offsetWidth) * 100;
    per = Math.min(100, Math.max(0, per));
    const _per = 100 - per;

    this.divide_items[0].style.width = `${per}%`;
    this.divide_items[1].style.width = `${_per}%`;
    this.divide_adds[0].style.width = `${per}%`;
    this.divide_adds[1].style.width = `${_per}%`;
  }

  actEnd = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.activeDivide = null;
    this.wrap.style.cursor = '';
  }
}
