const SVG_NS = "http://www.w3.org/2000/svg";

export class PacketAnimator {
  constructor(svg, layer) {
    this.svg = svg;
    this.layer = layer;
    this.packet = null;
    this.activeAnimationFrame = null;
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
    if (this.activeAnimationFrame) {
      cancelAnimationFrame(this.activeAnimationFrame);
      this.activeAnimationFrame = null;
    }

    if (this.packet && this.packet.parentNode) {
      this.packet.parentNode.removeChild(this.packet);
      this.packet = null;
    }
  }

  #createPacket(startPosition) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "packet");
    circle.setAttribute("r", "5");
    circle.setAttribute("cx", String(startPosition.x));
    circle.setAttribute("cy", String(startPosition.y));

    this.layer.appendChild(circle);
    this.packet = circle;
  }

  #setPacketPosition(position) {
    if (!this.packet) {
      return;
    }

    this.packet.setAttribute("cx", String(position.x));
    this.packet.setAttribute("cy", String(position.y));
  }

  #animateSegment(start, end, duration) {
    return new Promise((resolve) => {
      let startTime = null;

      const step = (timestamp) => {
        if (this.isCancelled) {
          resolve(false);
          return;
        }

        if (startTime === null) {
          startTime = timestamp;
        }

        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        this.#setPacketPosition({ x, y });

        if (progress < 1) {
          this.activeAnimationFrame = requestAnimationFrame(step);
        } else {
          resolve(true);
        }
      };

      this.activeAnimationFrame = requestAnimationFrame(step);
    });
  }

  async animatePath(path, positions, callbacks = {}, options = {}) {
    this.cancel();
    this.isCancelled = false;

    const { onHop, onComplete } = callbacks;
    const durationPerHop = options.durationPerHop || 900;

    if (!path || path.length === 0) {
      if (typeof onComplete === "function") {
        onComplete(false);
      }
      return false;
    }

    const startNode = path[0];
    const startPosition = positions[startNode];

    if (!startPosition) {
      if (typeof onComplete === "function") {
        onComplete(false);
      }
      return false;
    }

    this.#createPacket(startPosition);

    if (path.length === 1) {
      if (typeof onComplete === "function") {
        onComplete(true);
      }
      return true;
    }

    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      const fromPosition = positions[from];
      const toPosition = positions[to];

      if (!fromPosition || !toPosition) {
        if (typeof onComplete === "function") {
          onComplete(false);
        }
        return false;
      }

      const segmentCompleted = await this.#animateSegment(
        fromPosition,
        toPosition,
        durationPerHop
      );

      if (!segmentCompleted) {
        if (typeof onComplete === "function") {
          onComplete(false);
        }
        return false;
      }

      if (typeof onHop === "function") {
        onHop(from, to, i + 1);
      }
    }

    if (typeof onComplete === "function") {
      onComplete(true);
    }

    return true;
  }
}