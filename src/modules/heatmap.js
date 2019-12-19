import {EventsEmitter} from "../utils/events-emitter";
import {simpleheat} from "../utils/simpleheat";
import {Utils} from "../utils/utils";

export class Heatmap extends EventsEmitter {

  constructor(viewer, fragId = 0, options = {}) {
    super();

    const defaultConfig = {
      resolution: 20,
      max: 1,
      val: 1500,
      falloff: 30,
      zPos: 0.1,
    };

    this.viewer = viewer;

    this.config = Object.assign({}, defaultConfig, options.config);

    this.bounds = null;
    this.texture = null;
    this.heat = {};
    this.data = null;
    this.plane = null;
    this.canvas = null;

    this.create(fragId)
  }

  remove() {
    this.heat.clear();
    this.draw();
  }

  add(point, dbId, value) {

    const pointParsed = this._parsePoint2Flat(point);

    this.heat.add([pointParsed.x, pointParsed.y, value]);

    this.draw();
  }

  _parsePoint2Flat(point) {

    return {x: point.x - this.bounds.bBox.min.x, y: this.bounds.bBox.max.y - point.y}
  }

  _parseFlatToPoint(flat) {
    return {x: flat.x + this.bounds.bBox.min.x, y: this.bounds.bBox.max.y - flat.y}
  }

  draw() {
    /*
        this.heat._data = this.decay(this.heat._data);
        debugger;
    */

    this.heat.draw();
    this.texture.needsUpdate = true;
    this.viewer.impl.invalidate(true, false, true);
  }

  create(fragId) {
    this.bounds = this.genBounds(fragId);

    /*if (bounds.width < 1 || bounds.height < 1) {
      throw  new Error('创建失败');
    }*/
    this.canvas = document.createElement("canvas");

    this.canvas.width = this.bounds.width;
    this.canvas.height = this.bounds.height;

    // document.body.appendChild(this.canvas);

    this.heat = simpleheat(this.canvas).max(this.config.max);
    this.heat.defaultRadius = 8;
    this.heat.defaultGradient = {
      0.15: 'blue',
      0.3: 'cyan',
      0.45: 'lime',
      0.6: 'yellow',
      0.8: 'red',
    };
    this.data = this.heat._data;

    this.texture = new THREE.Texture(this.canvas);
    this.texture.needsUpdate = true;

    this.draw();

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.1,
      opacity: 1,
      side: THREE.DoubleSide,
    });

    material.transparent = true;
    material.needsUpdate = true;

    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(this.bounds.width, this.bounds.height), material);
    this.plane.position.set(this.bounds.centerPoint.x, this.bounds.centerPoint.y, this.bounds.bBox.max.z + 0.1);

    this.viewer.impl.scene.add(this.plane);
    this.viewer.impl.invalidate(true, false, true);
    this.emit('ready', this);

  }

  decay(data) {
    return data.filter((d) => {
      d[2] -= this.config.falloff;
      return d[2] > 1;
    });
  }

  receivedData(point, value) {
    return [Math.random() * this.canvas.clientWidth,
      Math.random() * this.canvas.clientHeight,
      Math.random() * this.config.val];
  }

  genBounds(fragId) {

    const bBox = new THREE.Box3();
    this.viewer.model.getFragmentList()
      .getWorldBounds(fragId, bBox);

    const width = Math.abs(bBox.max.x - bBox.min.x);
    const height = Math.abs(bBox.max.y - bBox.min.y);
    const depth = Math.abs(bBox.max.z - bBox.min.z);

    const centerPoint = {
      x: ( bBox.max.x + bBox.min.x) / 2,
      y: ( bBox.max.y + bBox.min.y) / 2,
      z: ( bBox.max.z + bBox.min.z) / 2
    };

    return {width, height, depth, centerPoint, bBox};
  }

}