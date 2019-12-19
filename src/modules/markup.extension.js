import {MultiModelExtensionBase} from "../extension/multi-model-extension-base";
import {Markup} from './markup'
import {EventTool} from "../utils/event-tool";
import "../utils/CSS2DRenderer";
import {Utils} from "../utils/utils";

export class MarkupExtension extends MultiModelExtensionBase {

  constructor(viewer, options) {

    super(viewer, options);

    this.isActive = false;

    this.eventTool = new EventTool(this.viewer);

    this.labelRenderer = null;

    this.list = [];

    this._onClick = this._onClick.bind(this);
    this._resizeContainer = this._resizeContainer.bind(this);
    this.update = this.update.bind(this);

    this.createCSS2DRenderer();

    const div = document.createElement('div');
    this.container = new THREE.CSS2DObject(div);

  }

  get listSimple() {
    return this.list.map(item => {
      return {
        id: item.id,
        innerHTML: item.element.innerHTML,
        className: item.element.className,
        point: {x: item.position.x, y: item.position.y, z: item.position.z},
        parentDbId: item.userData.parentDbId,
        others: item.userData.others,
        type: item.userData.type,
      }
    })
  }

  static get ExtensionId() {
    return 'JueForge.Extension.Markup'
  }

  // private
  load() {
    super.load();
    this.eventTool.activate();
    this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.update);
    window.addEventListener('resize', this._resizeContainer);
    return true
  }

  // private
  unload() {

    super.unload();
    this.eventTool.deactivate();
    //this.tooltip.deactivate()
    this.eventTool.off();
    this.viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.update);
    window.removeEventListener('resize', this._resizeContainer);
    return true
  }

  update() {

    this.viewer.impl.invalidate(true);
    this.labelRenderer.render(this.container, this.viewer.impl.camera);
  }

  // todo  set target.visible; and update;

  /**
   *
   * @param id
   * @param isShow? {boolean}
   */
  show(id, isShow = true) {
    const target = this.list.find(item => item.id === id);
    if (target) {
      target.element.style.display = isShow ? '' : 'none';
    }
    // this.update();
  }

  /**
   * 显示所有markup
   * @param isShow? {boolean}
   */
  showAll(isShow = true) {
    this.list.forEach(item => {
      item.element.style.display = isShow ? '' : 'none';
    });
    // this.update();
  }

  removeAll() {

    for (let i = 0, child = this.container.children[i]; i < this.container.children.length; i++) {
      while (child.children.length) {
        child.remove(child.children[0]);
      }
    }
    this.list = [];

    this.viewer.impl.sceneUpdated();
  }

  removeById(id) {
    const index = this.list.findIndex(item => item.id === id);
    let target = this.list[index];
    if (target) {
      for (let i = 0, child = this.container.children[i]; i < this.container.children.length; i++) {
        for (let j = 0, item = child.children[i]; j < child.children.length; j++) {
          if (item === target) {
            child.remove(item);
            break;
          }
        }
      }
      target = null;
      this.list.splice(index, 1);
      this.viewer.impl.sceneUpdated();
    }
  }

  setActive(isActive) {

    if (isActive) {
      this.eventTool.on('singleclick', this._onClick)
      //this.tooltip.activate()
    } else {
      this.eventTool.off('singleclick', this._onClick)
      //this.tooltip.deactivate()
    }
    this.isActive = isActive;
  }

  /**
   *
   * @param point {x,y,z} | THEE.Vector3  坐标
   * @param dbId
   * @param optionsElement? {innerHTML:string,className:string,others:Object<any>}
   */
  add(point, dbId, optionsElement, type = 1) {
    return Utils.getFragIdByDbId(this.viewer, dbId).then(fragId => {
      this._addLabelByClick({point, fragId}, optionsElement, type)
    });
  }

  addByBounds(dbIds, optionsElement) {
    const arr = [];
    dbIds.forEach(dbId => {
      arr.push(Utils.getFragIdByDbId(this.viewer, dbId));
    });

    return Promise.all(arr)
      .then(fragIds => {
        const tmpBox = new THREE.Box3();
        const nodeBox = new THREE.Box3();
        fragIds.forEach(fragId => {
          this.viewer.model.getFragmentList().getWorldBounds(fragId, tmpBox);
          nodeBox.union(tmpBox);
        });
        return nodeBox;
      })
      .then(box => {
        const center = box.center();
        const point = {x: center.x, y: center.y, z: box.max.z};
        //为第一个dbId 添加child
        return this.add(point, dbIds[0], optionsElement, 2);

      })
      .catch(e => {
        throw  new Error(e);
      })

  }

  _resizeContainer() {

    this.labelRenderer.setSize(this.viewer.clientContainer.clientWidth, this.viewer.clientContainer.clientHeight)

  }

  _onClick(event) {

    event.preventDefault();

    const hitTest = this.viewer.clientToWorld(
      event.canvasX,
      event.canvasY,
      true);

    if (hitTest) {
      /*  const markupInfo = {
          fragId: hitTest.fragId,
          point: hitTest.point,
          dbId: hitTest.dbId
        };*/
      this._addLabelByClick(hitTest);
      return true
    }
  }

  _addLabelByClick(hitTest, optionsElement = {}, type) {

    const mesh = this.viewer.impl.getRenderProxy(this.viewer.model, hitTest.fragId);

    if (!mesh) {
      return false;
    }

    // const child1 = this._createMesh();
    const child = this._createCSS2dObject(optionsElement);
    child.userData.parentDbId = mesh.dbId;
    child.userData.type = type;
    if (optionsElement.others) {
      child.userData.others = optionsElement.others;
    }

    /*
        this.viewer.impl.scene.add(child);
        child.position.set(hitTest.point.x + 1, hitTest.point.y + 1, hitTest.point.z + 1);
    */

    mesh.add(child);
    child.position.set(hitTest.point.x, hitTest.point.y, hitTest.point.z);

    this.container.add(mesh);

    this.viewer.impl.invalidate(true);
    this.labelRenderer.render(this.container, this.viewer.impl.camera);
    this.list.push(child);
  }

  _createCSS2dObject(optionsElement = {}) {
    const div = document.createElement('div');

    div.className = optionsElement.className || 'markup-item';
    div.innerHTML = optionsElement.innerHTML || '<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="30" height="30"><path d="M512 85.333333c-164.949333 0-298.666667 133.738667-298.666667 298.666667 0 164.949333 298.666667 554.666667 298.666667 554.666667s298.666667-389.717333 298.666667-554.666667c0-164.928-133.717333-298.666667-298.666667-298.666667z m0 448a149.333333 149.333333 0 1 1 0-298.666666 149.333333 149.333333 0 0 1 0 298.666666z" fill="#FF3D00"></path></svg>';
    //div.style.marginTop = '-1em';
    const obj = new THREE.CSS2DObject(div);
    div.setAttribute('data-co-id', obj.id);
    return obj;
  }

  _createMesh() {
    const material = new THREE.MeshLambertMaterial({color: 0xFEBD17, needsUpdate: true});
    this.viewer.impl.matman().addMaterial('SBD-Material-' + 'orange', material, true);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), material);
    const meshModel = new THREE.Object3D();
    meshModel.add(mesh);

    return meshModel
  }

  createCSS2DRenderer() {

    this.labelRenderer = new THREE.CSS2DRenderer();
    this.labelRenderer.setSize(this.viewer.clientContainer.clientWidth, this.viewer.clientContainer.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = 0;
    this.labelRenderer.domElement.style.left = 0;

    this.labelRenderer.domElement.className = 'markup-container';

    this.viewer.clientContainer.appendChild(this.labelRenderer.domElement);
    //this.viewer.impl.sceneUpdated(true)

  }

}

Autodesk.Viewing.theExtensionManager.registerExtension(MarkupExtension.ExtensionId, MarkupExtension);