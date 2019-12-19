import {MultiModelExtensionBase} from "../extension/multi-model-extension-base";

import {Utils} from "../utils/utils";
import {simpleheat} from "../utils/simpleheat";
import {EventTool} from "../utils/event-tool";
import {Heatmap} from "./heatmap";

export class HeatmapExtension extends MultiModelExtensionBase {
  static get ExtensionId() {
    return 'JueForge.Extension.Heatmap'
  }

  constructor(viewer, options = {}) {
    super(viewer, options = {});

    this.map = new Map();

    this.eventTool = new EventTool(this.viewer);

    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {

    })
  }

  //
  get dataFlat() {
    const result = [];
    this.map.forEach((heatmap, key) => {
      heatmap.data.forEach(arr => {
        let pointParsed = heatmap._parseFlatToPoint({x: arr[0], y: arr[1]});
        result.push({dbId: key, point: {x: pointParsed.x, y: pointParsed.y}, value: arr[2]});
      })

    });
    return result;
  }

  get data() {
    const result = {};
    this.map.forEach((heatmap, key) => {
      result[key] = heatmap.data.map(arr=>{
        let pointParsed = heatmap._parseFlatToPoint({x: arr[0], y: arr[1]});
        return [pointParsed.x,pointParsed.y,arr[2]];
      })

    });
    return result;
  }

  updateAll() {
    this.map.forEach((item, key) => {
      this.update(key);
    })
  }

  update(dbId) {
    const heatmap = this.map.get(dbId);
    heatmap && heatmap.draw();
  }

  remove(dbId) {
    const heatmap = this.map.get(dbId);
    heatmap && heatmap.remove();
    this.map.delete(dbId);

  }

  removeAll() {
    this.map.forEach((item, key) => {
      this.remove(key);
    })
  }

  /**
   *
   * @param point {{x:number,y:number}}
   * @param dbId {number}
   * @param value {float|int} 0-1
   */
  add(point, dbId, value = 0.5) {

    if (point, dbId) {
      Utils.getFragIdByDbId(this.viewer, dbId).then(id => {
        let heatmap;
        if (!this.map.has(dbId)) {
          heatmap = new Heatmap(this.viewer, id);
          if (heatmap) {
            this.map.set(dbId, heatmap);
          }
        } else {
          heatmap = this.map.get(dbId);
        }
        heatmap && heatmap.add(point, dbId, value);
      });
    }
  }

  load() {
    super.load();
    this.eventTool.activate();
    return true;
  }

  unload() {
    this.eventTool.deactivate();
    super.unload();
    return true;
  }

}

Autodesk.Viewing.theExtensionManager.registerExtension(HeatmapExtension.ExtensionId, HeatmapExtension);