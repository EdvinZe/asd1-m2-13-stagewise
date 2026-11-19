(function (root) {
  'use strict';
  class RehearsalTimer {
    constructor(now = () => performance.now()) {
      this.now = now;
      this.reset();
    }
    reset(seconds = 0) {
      this.elapsed = seconds * 1000;
      this.startedAt = null;
    }
    start() {
      if (this.startedAt === null) this.startedAt = this.now();
    }
    pause() {
      if (this.startedAt !== null) {
        this.elapsed += this.now() - this.startedAt;
        this.startedAt = null;
      }
      return this.seconds();
    }
    seconds() {
      return Math.min(
        7200,
        Math.floor(
          (this.elapsed + (this.startedAt === null ? 0 : this.now() - this.startedAt)) / 1000,
        ),
      );
    }
    get running() {
      return this.startedAt !== null;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { RehearsalTimer };
  root.StageTimer = RehearsalTimer;
})(globalThis);
