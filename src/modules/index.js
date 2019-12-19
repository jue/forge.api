import { Utils } from "../utils/utils";
import { MarkupExtension } from "./markup.extension";
import { HeatmapExtension } from "./heatmap.extension";
import { EventsEmitter } from "../utils/events-emitter";
import { EventTool } from "../utils/event-tool";

import { Markup3dExtension } from "./markup3d.extension";

export class Seal extends EventsEmitter {

  /**
   * @constructor
   * @param ele {HTMLElement}
   * @param options {Object}
   */
  constructor(ele, options = {}) {

    super();

    //this.markups = MarkupExtension.list;
    this.models = [];

    this.markupExtension = null;
    this.markup3dExtension = null;
    this.heatmapExtension = null;
    this.eventTool = null;

    this.viewer = new Autodesk.Viewing.Private.GuiViewer3D(ele, {}); // With toolbar

    Autodesk.Viewing.Initializer(options, () => {
      this.viewer.initialize();
      this.emit('initialized');

      if (options.docid) {
        this.loadModel(options.docid).then(data => {
          this.emit('model.loaded', data);
          this.init();
        })
      }
    });
  }

  init() {

    this.viewer.container.style.position = 'relative';

    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, (e) => {
      this.emit('geometry.loaded', e);
    });

    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {

      this.emit('objectTree.created');

      this.viewer.loadExtension(HeatmapExtension.ExtensionId, { max: 1 }).then(res => {
        this.heatmapExtension = res;
        this.emit('extension.heatmap.loaded', res);
      });

      this.viewer.loadExtension(MarkupExtension.ExtensionId).then(res => {
        this.markupExtension = res;
        this.emit('extension.markup.loaded', res);
      });

      this.viewer.loadExtension(Markup3dExtension.ExtensionId).then(res => {
        this.markup3dExtension = res;
        this.emit('extension.markup3d.loaded', res);
      });

    });

    //this.viewer.setProgressiveRendering(false);
    //this.viewer.setGhosting(false);

    this._bindEvents();

  }

  _bindEvents() {
    this.eventTool = new EventTool(this.viewer);
    this.eventTool.activate();

    this.eventTool.on('singleclick', () => {
      const hitTest = this.viewer.clientToWorld(
        event.canvasX,
        event.canvasY,
        true);

      this.emit('click', hitTest);
    })
  }

  /**
   * 获取instanceTree
   * 需要在 objectTree.created 事件出发后方能正常获取
   * @returns {{dbId, name}}
   */
  getInstanceTree() {
    if (this.viewer && this.viewer.model) {
      return Utils.buildModelTree(this.viewer.model);
    }
    return null;
  }

  /**
   * 切换模型
   * @param url {string}
   * @param removeOthers {boolean} 是否删除其它模型
   * @param options {Object}
   * @return {Promise<T>}
   */
  loadModel(url, removeOthers = true, options = {}) {

    if (removeOthers && this.models.length) {
      this.viewer.tearDown();
      //todo loadSpainner 存在bug
      this.viewer.impl.api.loadSpinner.remove();
      this.models = [];
      this.viewer.start();
    }

    return new Promise((resolve, reject) => {

      this.viewer.loadModel(url, options, (data) => {
        this.viewer.fitToView(true);
        this.models.push(data);
        resolve(data);
      }, (err) => {
        reject(err);
      })

    })

  }

  /**
   * todo 待测试 待检验
   * 批量加载模型，并放置到相应位置
   * @param arr {Array<string> | Array<{url:string,options:Object}>>}
   * @returns {Promise<any>}
   */
  loadModelsBatch(arr) {

    let index = 0;
    const length = arr.length;

    const _this = this;

    this.viewer.tearDown();

    return new Promise((resolve, reject) => {

      doLoad();

      function doLoad() {
        if (index < length) {
          const url = Utils.isString(arr[index]) ? arr[index] : arr[index].url;
          let lastOffset;

          if (index > 0) {
            lastOffset = _this.models[index - 1].getData().globalOffset;
          }
          let options = arr[index]['options'] || { globalOffset: lastOffset };

          _this.loadModel(url, false, options).then(res => {
            index++;
            doLoad()
          }, err => {
            reject(err);
          })
        } else {
          resolve(_this.models)
        }
      }
    })

    //this.loadModel(arr.url, true)
  }

  /**
   *
   * @param externalId
   * @returns {Promise<any>}
   */

  getDbIdByExternalId(externalId) {

    return new Promise((resolve, reject) => {
      this.viewer.model.getExternalIdMapping((map) => {
        resolve(map[externalId])
      })
    })
  }

  /**
   * 根据dbId获取externalID
   * @param dbId
   * @returns {Promise<any>}
   */
  getExternalIdByDbId(dbId) {

    return new Promise((resolve, reject) => {
      this.viewer.getProperties(dbId, (res) => {
        const result = res && res.externalId;
        resolve(result)
      }, (err) => {
        reject(err);
      })
    })

  }

  /**
   * 获取选中Node 的dbid数组
   * @return {Array<dbid>}
   */
  getDbIdsBySelection() {
    return this.viewer.getSelection();
  }

  /**
   * 是否显示ghosting
   * @param isGhosting {boolean}
   */
  setGhosting(isGhosting = true) {
    this.viewer.setGhosting(isGhosting);
  }

  /**
   * 单独显示部分构件
   * @param dbIds {Array}
   * @param showGhosting {boolean}
   */
  isolate(dbIds, showGhosting = true) {
    this.setGhosting(showGhosting);
    this.viewer.isolate(dbIds)
  }

  /**
   * 显示全部构件
   */
  showAll() {
    this.viewer.showAll();
  }

  /**
   * 获取选中Node 基本信息
   * @return {Promise<T>}
   */
  getNodeInfoBySelection() {
    const dbid = this.viewer.getSelection()[0];

    return new Promise((resolve, reject) => {
      if (dbid > -1) {
        this.viewer.getProperties(dbid, (res) => {
          resolve(res)
        }, (err) => {
          reject(err);
        })
      } else {
        reject(null);
      }
    })

  }

  /**
   * 获取当前state；
   * @param filter {Object} 过滤器
   * @return {Viewstate}
   */
  getCurrentState(filter) {
    return this.viewer.getState(filter);
  }

  /**
   * 获取当前state 截图
   * @return {Promise<blob>}
   */
  getScreenShot(width = 0, height = 0) {

    return new Promise((resolve, reject) => {
      this.viewer.getScreenShot(width, height, (res) => {
        resolve(res)
      })
    })

  }

  /**
   * 重置state
   * @param state
   * @param filter
   * @param immediate
   */
  restoreState(state, filter, immediate) {

    this.viewer.restoreState(state, filter, immediate);

  }

  fitToView(dbIdArr) {

    this.viewer.fitToView(dbIdArr);

  }

  /**
   * todo rgba
   * @param dbIds {Array<number>>|number}
   * @param colorsStr {string} 如 #ccc #ff00fc rgb(255,0,0),暂不支持rgba
   */
  setThemingColor(dbIds, colorsStr) {

    if (!Utils.isArray(dbIds)) {
      dbIds = [dbIds];
    }
    const color = new THREE.Color(colorsStr);
    dbIds.forEach(dbId => {
      this.viewer.setThemingColor(dbId, new THREE.Vector4(color.r, color.g, color.b, 1));
    })
  }

  /**
   * 清除整个模型themingColor
   * 目前不方便单独clear
   */
  clearThemingColors() {
    if (this.model) {
      this.viewer.clearThemingColors(this.model);
    }
  }

  /**
   * 显示/隐藏tooBar
   * @param visible {boolean}
   */
  setToolBarVisible(visible = true) {

    const toolbar = this.viewer.getToolbar();

    if (toolbar) {
      //  debugger;
      const container = toolbar.container;
      container.style.display = visible ? "block" : 'none';

    }
  }
}